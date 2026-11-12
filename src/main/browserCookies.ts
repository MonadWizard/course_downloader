import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserProfile } from '@shared/types'

/**
 * "Use my browser login": Google (and some other identity providers) refuse to
 * sign in inside embedded browsers such as Electron ("This browser or app may
 * not be secure"). Instead the user signs in to the course site in their normal
 * browser, and we import ONLY that site's cookies from the browser profile into
 * the site's private session. yt-dlp's --cookies-from-browser does the profile
 * reading / decryption (KWallet, GNOME keyring, …).
 */

const H = homedir()

interface Candidate {
  id: string
  label: string
  spec: string
  path: string
}

function candidates(): Candidate[] {
  const v = (app: string, sub: string): string => join(H, '.var/app', app, sub)
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return ['firefox', 'chrome', 'edge', 'brave', 'chromium', 'opera', 'vivaldi'].map((b) => ({
      id: b,
      label: b[0].toUpperCase() + b.slice(1),
      spec: b,
      path: ''
    }))
  }
  return [
    { id: 'firefox', label: 'Firefox', spec: 'firefox', path: join(H, '.mozilla/firefox') },
    { id: 'firefox-flatpak', label: 'Firefox (Flatpak)', spec: `firefox:${v('org.mozilla.firefox', '.mozilla/firefox')}`, path: v('org.mozilla.firefox', '.mozilla/firefox') },
    { id: 'librewolf-flatpak', label: 'LibreWolf (Flatpak)', spec: `firefox:${v('io.gitlab.librewolf-community', '.librewolf')}`, path: v('io.gitlab.librewolf-community', '.librewolf') },
    { id: 'waterfox-flatpak', label: 'Waterfox (Flatpak)', spec: `firefox:${v('net.waterfox.waterfox', '.waterfox')}`, path: v('net.waterfox.waterfox', '.waterfox') },
    { id: 'chrome', label: 'Google Chrome', spec: 'chrome', path: join(H, '.config/google-chrome') },
    { id: 'chrome-flatpak', label: 'Google Chrome (Flatpak)', spec: `chrome:${v('com.google.Chrome', 'config/google-chrome')}`, path: v('com.google.Chrome', 'config/google-chrome') },
    { id: 'chrome-dev-flatpak', label: 'Chrome Dev (Flatpak)', spec: `chrome:${v('com.google.ChromeDev', 'config/google-chrome-unstable')}`, path: v('com.google.ChromeDev', 'config/google-chrome-unstable') },
    { id: 'chromium', label: 'Chromium', spec: 'chromium', path: join(H, '.config/chromium') },
    { id: 'chromium-flatpak', label: 'Chromium (Flatpak)', spec: `chromium:${v('org.chromium.Chromium', 'config/chromium')}`, path: v('org.chromium.Chromium', 'config/chromium') },
    { id: 'ungoogled-flatpak', label: 'Ungoogled Chromium (Flatpak)', spec: `chromium:${v('io.github.ungoogled_software.ungoogled_chromium', 'config/chromium')}`, path: v('io.github.ungoogled_software.ungoogled_chromium', 'config/chromium') },
    { id: 'brave', label: 'Brave', spec: 'brave', path: join(H, '.config/BraveSoftware/Brave-Browser') },
    { id: 'brave-flatpak', label: 'Brave (Flatpak)', spec: `brave:${v('com.brave.Browser', 'config/BraveSoftware/Brave-Browser')}`, path: v('com.brave.Browser', 'config/BraveSoftware/Brave-Browser') },
    { id: 'edge', label: 'Microsoft Edge', spec: 'edge', path: join(H, '.config/microsoft-edge') },
    { id: 'vivaldi', label: 'Vivaldi', spec: 'vivaldi', path: join(H, '.config/vivaldi') },
    { id: 'opera', label: 'Opera', spec: 'opera', path: join(H, '.config/opera') }
  ]
}

export function detectBrowsers(): BrowserProfile[] {
  return candidates()
    .filter((c) => !c.path || existsSync(c.path))
    .map(({ id, label }) => ({ id, label }))
}

export function browserSpec(id: string): string {
  const c = candidates().find((x) => x.id === id)
  if (!c) throw new Error(`Unknown browser ${id}`)
  return c.spec
}

export interface NetscapeCookie {
  domain: string
  includeSubdomains: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  expires: number
  name: string
  value: string
}

export function parseNetscape(text: string): NetscapeCookie[] {
  const out: NetscapeCookie[] = []
  for (let line of text.split(/\r?\n/)) {
    let httpOnly = false
    if (line.startsWith('#HttpOnly_')) {
      httpOnly = true
      line = line.slice('#HttpOnly_'.length)
    } else if (!line.trim() || line.startsWith('#')) continue
    const f = line.split('\t')
    if (f.length < 7) continue
    out.push({
      domain: f[0],
      includeSubdomains: f[1] === 'TRUE',
      path: f[2] || '/',
      secure: f[3] === 'TRUE',
      expires: Number(f[4]) || 0,
      name: f[5],
      value: f.slice(6).join('\t'),
      httpOnly
    })
  }
  return out
}

/** Cookie belongs to `domain` or one of its subdomains. */
export function cookieMatchesDomain(cookieDomain: string, domain: string): boolean {
  const d = cookieDomain.replace(/^\./, '').toLowerCase()
  const want = domain.toLowerCase()
  return d === want || d.endsWith(`.${want}`)
}

function runYtdlp(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 120000, maxBuffer: 32 * 1024 * 1024 }, (err, _out, stderr) =>
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stderr: String(stderr ?? '') })
    )
  })
}

/**
 * Read cookies for `domain` from a browser profile via yt-dlp.
 * The temporary full cookie dump lives in a private temp dir and is deleted immediately.
 */
export async function readBrowserCookies(ytdlp: string, tmpRoot: string, browserId: string, domain: string): Promise<NetscapeCookie[]> {
  const dir = mkdtempSync(join(tmpRoot, 'cookie-import-'))
  const file = join(dir, 'cookies.txt')
  try {
    const base = ['--ignore-config', '--no-warnings', '--cookies-from-browser', browserSpec(browserId), '--cookies', file]
    let r = await runYtdlp(ytdlp, base)
    if (!existsSync(file)) {
      // Older yt-dlp versions only save the jar after processing a URL.
      r = await runYtdlp(ytdlp, [...base, '--simulate', '--skip-download', '--', `https://${domain}/`])
    }
    if (!existsSync(file)) {
      const msg = r.stderr.split('\n').filter((l) => /error/i.test(l)).pop() ?? r.stderr.trim()
      throw new Error(`Could not read cookies from the browser. ${msg || ''} Close the browser completely and try again.`.trim())
    }
    return parseNetscape(readFileSync(file, 'utf8')).filter((c) => cookieMatchesDomain(c.domain, domain) && c.value)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Map a desktop-file / ProgId of the default browser to one of our browser ids. */
export function browserIdFromDesktop(desktop: string): string | null {
  const d = desktop.toLowerCase()
  const rules: [RegExp, string][] = [
    [/org\.mozilla\.firefox/, 'firefox-flatpak'],
    [/librewolf/, 'librewolf-flatpak'],
    [/waterfox/, 'waterfox-flatpak'],
    [/firefox/, 'firefox'],
    [/com\.brave\.browser/, 'brave-flatpak'],
    [/brave/, 'brave'],
    [/com\.google\.chromedev/, 'chrome-dev-flatpak'],
    [/com\.google\.chrome/, 'chrome-flatpak'],
    [/google-chrome|chromehtml/, 'chrome'],
    [/ungoogled/, 'ungoogled-flatpak'],
    [/org\.chromium\.chromium/, 'chromium-flatpak'],
    [/chromium/, 'chromium'],
    [/edge|msedgehtm/, 'edge'],
    [/vivaldi/, 'vivaldi'],
    [/opera/, 'opera']
  ]
  return rules.find(([re]) => re.test(d))?.[1] ?? null
}

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 5000 }, (_e, out) => resolve(String(out ?? '').trim())))
}

/** The user's default web browser as a browser id (null if unknown / unsupported). */
export async function defaultBrowserId(): Promise<string | null> {
  if (process.platform === 'linux') {
    const desktop = (await exec('xdg-settings', ['get', 'default-web-browser'])) || (await exec('xdg-mime', ['query', 'default', 'x-scheme-handler/https']))
    return desktop ? browserIdFromDesktop(desktop) : null
  }
  if (process.platform === 'win32') {
    const out = await exec('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId'])
    const progId = /ProgId\s+REG_SZ\s+(\S+)/i.exec(out)?.[1] ?? ''
    return progId ? browserIdFromDesktop(progId.replace(/^firefoxurl.*/i, 'firefox').replace(/^bravehtml/i, 'brave')) : null
  }
  return null
}

const LAUNCH: Record<string, string[][]> = {
  firefox: [['firefox']],
  'firefox-flatpak': [['flatpak', 'run', 'org.mozilla.firefox']],
  'librewolf-flatpak': [['flatpak', 'run', 'io.gitlab.librewolf-community']],
  'waterfox-flatpak': [['flatpak', 'run', 'net.waterfox.waterfox']],
  chrome: [['google-chrome'], ['google-chrome-stable']],
  'chrome-flatpak': [['flatpak', 'run', 'com.google.Chrome']],
  'chrome-dev-flatpak': [['flatpak', 'run', 'com.google.ChromeDev']],
  chromium: [['chromium-browser'], ['chromium']],
  'chromium-flatpak': [['flatpak', 'run', 'org.chromium.Chromium']],
  'ungoogled-flatpak': [['flatpak', 'run', 'io.github.ungoogled_software.ungoogled_chromium']],
  brave: [['brave-browser'], ['brave']],
  'brave-flatpak': [['flatpak', 'run', 'com.brave.Browser']],
  edge: [['microsoft-edge'], ['microsoft-edge-stable']],
  vivaldi: [['vivaldi'], ['vivaldi-stable']],
  opera: [['opera']]
}

/** Launch a specific browser with a URL (Linux). Returns false if it could not be started. */
export async function launchBrowser(browserId: string, url: string): Promise<boolean> {
  if (process.platform !== 'linux') return false
  const { spawn } = await import('node:child_process')
  for (const cmd of LAUNCH[browserId] ?? []) {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(cmd[0], [...cmd.slice(1), url], { detached: true, stdio: 'ignore' })
      p.once('error', () => resolve(false))
      p.once('spawn', () => {
        p.unref()
        resolve(true)
      })
    })
    if (ok) return true
  }
  return false
}
