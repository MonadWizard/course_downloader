// Downloads a standalone yt-dlp into resources/bin so it ships inside the installer.
// Usage: node scripts/fetch-binaries.mjs [linux|win|mac]
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const target = process.argv[2] ?? (process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux')
const asset = { linux: 'yt-dlp_linux', win: 'yt-dlp.exe', mac: 'yt-dlp_macos' }[target]
const name = target === 'win' ? 'yt-dlp.exe' : 'yt-dlp'
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`
const dir = join(import.meta.dirname, '..', 'resources', 'bin')
mkdirSync(dir, { recursive: true })
console.log(`Downloading ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const file = join(dir, name)
writeFileSync(file, Buffer.from(await res.arrayBuffer()))
if (target !== 'win') chmodSync(file, 0o755)
console.log(`Saved ${file}`)
