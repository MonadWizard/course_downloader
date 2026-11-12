import { app } from 'electron'
import type { DownloadMode, Job } from '@shared/types'
import { ensureSite } from './auth'
import { ensureYtDlp } from './binaries'
import { makeContext } from './context'
import { Engine } from './engine'
import { analyzeUrl, AuthRequiredError, primaryExtractor } from './extractors'
import { load, save } from './store'

/**
 * Headless mode:
 *   course-downloader --cli <url> [--mode single|playlist|course] [--out DIR] [--only 1,2,5] [--list]
 * Uses the same sessions/logins as the GUI (log in once in the GUI first).
 */
export function cliArgs(argv: string[]): Record<string, string | boolean> | null {
  const i = argv.indexOf('--cli')
  if (i < 0) return null
  const out: Record<string, string | boolean> = { url: argv[i + 1] ?? '' }
  for (let k = i + 2; k < argv.length; k++) {
    const a = argv[k]
    if (!a.startsWith('--')) continue
    const next = argv[k + 1]
    if (next && !next.startsWith('--')) {
      out[a.slice(2)] = next
      k++
    } else out[a.slice(2)] = true
  }
  return out
}

export async function runCli(opts: Record<string, string | boolean>): Promise<number> {
  const print = (s: string): void => void process.stdout.write(`${s}\n`)
  const url = String(opts.url)
  const mode = (opts.mode as DownloadMode) || 'course'
  if (opts.out) {
    load().settings.outputDir = String(opts.out)
    save(true)
  }
  const u = new URL(url)
  const ext = primaryExtractor(u)
  const siteId = ext.siteId(u)
  ensureSite(siteId, ext.name, ext.loginUrl(u))
  await ensureYtDlp(false, print).catch((e) => print(`yt-dlp unavailable: ${e.message} (falling back to ffmpeg)`))

  let col
  try {
    col = await analyzeUrl(url, mode, await makeContext(siteId, print))
  } catch (e) {
    if (e instanceof AuthRequiredError) print(`LOGIN REQUIRED for ${siteId}: ${e.message}\nOpen Course Downloader → Sites & logins and log in, then retry.`)
    else print(`ERROR: ${(e as Error).message}`)
    return 2
  }
  print(`${col.title}  (${col.items.length} items, ${col.siteName})`)
  for (const it of col.items) print(`  ${String(it.index).padStart(3)}  [${it.type}${it.locked ? ', locked' : ''}]  ${it.module ? it.module + ' / ' : ''}${it.title}`)
  if (opts.list) return 0

  const only = typeof opts.only === 'string' ? new Set(opts.only.split(',').map(Number)) : null
  const ids = col.items.filter((i) => (only ? only.has(i.index) : i.type === 'video' || i.type === 'reading')).map((i) => i.id)

  return new Promise((resolve) => {
    let last = ''
    const engine = new Engine((jobs: Job[]) => {
      const mine = jobs.filter((j) => j.groupId === engine.scope)
      const line = mine
        .filter((j) => j.status === 'downloading')
        .map((j) => `#${j.item.index} ${Math.round(j.progress * 100)}% ${j.speed ?? ''}`)
        .join(' | ')
      if (line && line !== last) print(line)
      last = line
      for (const j of mine) {
        const key = `${j.id}:${j.status}`
        if (['done', 'error', 'skipped', 'login-required'].includes(j.status) && !reported.has(key)) {
          reported.add(key)
          print(`${j.status.toUpperCase().padEnd(14)} #${j.item.index} ${j.item.title}${j.message ? `  → ${j.message}` : ''}`)
        }
      }
      if (mine.length && mine.every((j) => ['done', 'error', 'skipped', 'login-required', 'paused'].includes(j.status))) {
        resolve(mine.some((j) => j.status === 'error') ? 1 : 0)
      }
    }, print)
    const reported = new Set<string>()
    engine.scope = '__pending__'
    const gid = engine.enqueue(col, ids)
    engine.scope = gid
    engine.pump()
    app.on('before-quit', () => engine.stopAll())
  })
}
