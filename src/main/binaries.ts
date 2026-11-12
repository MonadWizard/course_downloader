import { app, net } from 'electron'
import { execFile } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'
import type { BinaryStatus } from '@shared/types'

const run = promisify(execFile)
const isWin = process.platform === 'win32'
const exe = (n: string): string => (isWin ? `${n}.exe` : n)

/** Where the app keeps its own (updatable) yt-dlp. */
const userBinDir = (): string => join(app.getPath('userData'), 'bin')
/** Binaries shipped inside the installer (electron-builder extraResources). */
const bundledBinDir = (): string => join(process.resourcesPath ?? '', 'bin')

function onPath(name: string): string | null {
  for (const d of (process.env.PATH ?? '').split(delimiter)) {
    const p = join(d, exe(name))
    if (d && existsSync(p)) return p
  }
  return null
}

function find(name: string): string | null {
  for (const d of [userBinDir(), bundledBinDir(), join(app.getAppPath(), 'resources', 'bin')]) {
    const p = join(d, exe(name))
    if (existsSync(p)) return p
  }
  return onPath(name)
}

export function ytdlpPath(): string | null {
  return find('yt-dlp')
}
export function ffmpegPath(): string | null {
  return find('ffmpeg')
}

async function version(bin: string | null, args: string[]): Promise<string | null> {
  if (!bin) return null
  try {
    const { stdout } = await run(bin, args, { timeout: 15000 })
    return stdout.split('\n')[0].trim()
  } catch {
    return null
  }
}

export async function status(): Promise<BinaryStatus> {
  const y = ytdlpPath()
  const f = ffmpegPath()
  return {
    ytdlp: { path: y, version: await version(y, ['--version']) },
    ffmpeg: { path: f, version: (await version(f, ['-version']))?.replace(/^ffmpeg version (\S+).*/, '$1') ?? null }
  }
}

function ytdlpAsset(): string {
  if (isWin) return 'yt-dlp.exe'
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux'
}

/** Download the standalone yt-dlp build into the user bin dir. */
export async function installYtDlp(log: (m: string) => void = () => {}): Promise<string> {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpAsset()}`
  log(`Downloading yt-dlp from ${url}`)
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`yt-dlp download failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(userBinDir(), { recursive: true })
  const target = join(userBinDir(), exe('yt-dlp'))
  writeFileSync(`${target}.tmp`, buf)
  if (!isWin) chmodSync(`${target}.tmp`, 0o755)
  renameSync(`${target}.tmp`, target)
  log(`yt-dlp installed at ${target}`)
  return target
}

/** Ensure yt-dlp exists; update the app-managed copy when it does. */
export async function ensureYtDlp(autoUpdate: boolean, log: (m: string) => void): Promise<void> {
  const p = ytdlpPath()
  if (!p) {
    await installYtDlp(log)
    return
  }
  if (autoUpdate && p.startsWith(userBinDir())) {
    try {
      const { stdout } = await run(p, ['-U'], { timeout: 120000 })
      log(stdout.trim().split('\n').pop() ?? 'yt-dlp checked for updates')
    } catch (e) {
      log(`yt-dlp update check failed: ${(e as Error).message}`)
    }
  }
}
