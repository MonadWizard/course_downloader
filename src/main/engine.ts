import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Collection, Job, MediaSource, Settings } from '@shared/types'
import { relativeOutBase } from '@shared/naming'
import { ffmpegPath, ytdlpPath } from './binaries'
import { makeContext, type Logger } from './context'
import { AuthRequiredError, extractorById, SkipError } from './extractors'
import type { ExtractorContext } from './extractors/types'
import { load, save } from './store'
import { BROWSER_UA } from './auth'

const MEDIA_EXT = ['.mp4', '.mkv', '.webm', '.m4a', '.mp3', '.mov']
const TEXT_EXT = ['.html', '.md', '.txt']

export function formatSelector(q: Settings['quality']): string {
  if (q === 'best') return 'bv*+ba/b'
  return `bv*[height<=${q}]+ba/b[height<=${q}]/bv*+ba/b`
}

/** Existing finished output for a job (ignores .part / .ytdl leftovers). */
export function findOutput(outBase: string): string | null {
  const dir = dirname(outBase)
  if (!existsSync(dir)) return null
  const base = basename(outBase)
  for (const f of readdirSync(dir)) {
    if (!f.startsWith(base)) continue
    const rest = f.slice(base.length)
    if ([...MEDIA_EXT, ...TEXT_EXT].includes(rest.toLowerCase())) return join(dir, f)
  }
  return null
}

function fmtBytes(n?: number): string {
  if (!n || !isFinite(n)) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`
}

function fmtEta(s?: number): string {
  if (s === undefined || s === null || !isFinite(s)) return ''
  const m = Math.floor(s / 60)
  return m ? `${m}m ${Math.floor(s % 60)}s` : `${Math.floor(s)}s`
}

export class Engine {
  private procs = new Map<string, ChildProcess>()
  private active = new Set<string>()
  private emitTimer: NodeJS.Timeout | null = null
  private stopping = false
  /** When set, only jobs of this group are started (used by the CLI). */
  scope: string | null = null

  constructor(
    private onChange: (jobs: Job[]) => void,
    private log: Logger
  ) {
    const db = load()
    for (const j of db.jobs) {
      if (j.status === 'resolving' || j.status === 'downloading') j.status = 'queued'
    }
    save()
  }

  get jobs(): Job[] {
    return load().jobs
  }

  private changed(immediate = false): void {
    save()
    if (immediate) {
      this.onChange(this.jobs)
      return
    }
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      this.onChange(this.jobs)
    }, 250)
  }

  private update(job: Job, patch: Partial<Job>, immediate = false): void {
    Object.assign(job, patch, { updatedAt: Date.now() })
    this.changed(immediate)
  }

  enqueue(col: Collection, itemIds: string[]): string {
    const { settings } = load()
    const groupId = randomUUID()
    const wanted = new Set(itemIds)
    for (const item of col.items) {
      if (!wanted.has(item.id)) continue
      const outBase = join(settings.outputDir, ...relativeOutBase(col, item).split('/'))
      const job: Job = {
        id: randomUUID(),
        groupId,
        groupTitle: col.title,
        extractor: col.extractor,
        siteId: col.siteId,
        item,
        outBase,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      if (item.type === 'notebook' || item.type === 'quiz') {
        job.status = 'skipped'
        job.message = item.type === 'quiz' ? 'Quiz – not downloadable' : 'Lab notebook – open on the website'
      } else if (item.type === 'reading' && !settings.saveReadings) {
        job.status = 'skipped'
        job.message = 'Readings disabled in settings'
      }
      load().jobs.push(job)
    }
    this.changed(true)
    this.pump()
    return groupId
  }

  pump(): void {
    const { settings, jobs } = load()
    for (const job of jobs) {
      if (this.active.size >= Math.max(1, settings.concurrency)) break
      if (job.status !== 'queued' || this.active.has(job.id)) continue
      if (this.scope && job.groupId !== this.scope) continue
      this.active.add(job.id)
      this.run(job).finally(() => {
        this.active.delete(job.id)
        this.procs.delete(job.id)
        this.pump()
      })
    }
  }

  private async run(job: Job): Promise<void> {
    const existing = findOutput(job.outBase)
    if (existing) {
      this.update(job, { status: 'done', progress: 1, message: existing }, true)
      return
    }
    this.update(job, { status: 'resolving', message: 'Finding media…', progress: 0 }, true)
    try {
      const ctx = await makeContext(job.siteId, this.log)
      const src = await extractorById(job.extractor).resolve(job.item, ctx)
      if (load().jobs.find((j) => j.id === job.id)?.status !== 'resolving') return // paused/removed meanwhile
      mkdirSync(dirname(job.outBase), { recursive: true })
      this.update(job, { status: 'downloading', message: undefined }, true)
      const out = await this.download(job, src, ctx)
      await this.subtitles(job, src, ctx)
      this.update(job, { status: 'done', progress: 1, speed: undefined, eta: undefined, message: out }, true)
    } catch (e) {
      const cur = load().jobs.find((j) => j.id === job.id)
      if (!cur || cur.status === 'paused' || this.stopping) return
      if (e instanceof AuthRequiredError) this.update(job, { status: 'login-required', message: e.message }, true)
      else if (e instanceof SkipError) this.update(job, { status: 'skipped', message: e.message }, true)
      else {
        const msg = String((e as Error)?.message ?? e)
        this.log(`[${job.item.title}] ${msg}`)
        this.update(job, { status: 'error', message: msg.split('\n').filter(Boolean).slice(-2).join(' ') }, true)
      }
    }
  }

  private async download(job: Job, src: MediaSource, ctx: ExtractorContext): Promise<string> {
    if (src.kind === 'text') {
      const file = `${job.outBase}.${src.textExt ?? 'html'}`
      writeFileSync(file, src.text ?? '')
      return file
    }
    if (ytdlpPath()) {
      try {
        return await this.ytdlp(job, src, ctx, load().settings.subtitles && src.kind === 'ytdlp')
      } catch (e) {
        if (/subtitle/i.test(String((e as Error).message))) return this.ytdlp(job, src, ctx, false)
        throw e
      }
    }
    if (src.kind === 'ytdlp') throw new Error('yt-dlp is not installed (Settings → Install yt-dlp)')
    return this.ffmpeg(job, src)
  }

  private ytdlp(job: Job, src: MediaSource, ctx: ExtractorContext, subs: boolean): Promise<string> {
    const { settings } = load()
    const args = [
      '--newline',
      '--no-warnings',
      '--no-playlist',
      '--continue',
      '--progress',
      '--progress-template',
      'download:CGPROG %(progress)j',
      '--print',
      'after_move:CGFILE %(filepath)s',
      '-N',
      '8',
      '-f',
      formatSelector(settings.quality),
      '--merge-output-format',
      'mp4',
      '-o',
      `${job.outBase.replace(/%/g, '%%')}.%(ext)s`
    ]
    const ff = ffmpegPath()
    if (ff) args.push('--ffmpeg-location', ff)
    if (ctx.cookiesFile) args.push('--cookies', ctx.cookiesFile)
    for (const [k, v] of Object.entries(src.headers ?? {})) {
      if (k.toLowerCase() === 'user-agent') args.push('--user-agent', v)
      else args.push('--add-headers', `${k}:${v}`)
    }
    if (src.kind !== 'ytdlp' && !Object.keys(src.headers ?? {}).some((k) => k.toLowerCase() === 'user-agent')) {
      args.push('--user-agent', BROWSER_UA)
    }
    if (subs) args.push('--write-subs', '--sub-langs', 'en.*,en', '--convert-subs', 'srt')
    args.push(src.url)

    return new Promise((resolve, reject) => {
      const p = spawn(ytdlpPath()!, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      this.procs.set(job.id, p)
      let file = ''
      let errTail = ''
      const onLine = (line: string): void => {
        if (line.startsWith('CGPROG ')) {
          try {
            const pr = JSON.parse(line.slice(7))
            const total = pr.total_bytes || pr.total_bytes_estimate
            let frac = total ? pr.downloaded_bytes / total : 0
            if (!frac && pr.fragment_count) frac = (pr.fragment_index ?? 0) / pr.fragment_count
            this.update(job, {
              progress: Math.min(0.999, frac || job.progress),
              speed: pr.speed ? `${fmtBytes(pr.speed)}/s` : job.speed,
              eta: fmtEta(pr.eta)
            })
          } catch {
            /* partial line */
          }
        } else if (line.startsWith('CGFILE ')) file = line.slice(7).trim()
        else if (line.trim()) errTail = (errTail + '\n' + line).slice(-2000)
      }
      const split = (buf: { rest: string }) => (chunk: Buffer) => {
        const lines = (buf.rest + chunk.toString()).split(/\r?\n/)
        buf.rest = lines.pop() ?? ''
        lines.forEach(onLine)
      }
      p.stdout.on('data', split({ rest: '' }))
      p.stderr.on('data', split({ rest: '' }))
      p.on('error', reject)
      p.on('close', (code) => {
        if (code === 0) resolve(file || findOutput(job.outBase) || job.outBase)
        else reject(new Error(errTail.trim() || `yt-dlp exited with ${code}`))
      })
    })
  }

  /** Fallback when yt-dlp is missing: remux the stream with ffmpeg. */
  private ffmpeg(job: Job, src: MediaSource): Promise<string> {
    const ff = ffmpegPath()
    if (!ff) throw new Error('Neither yt-dlp nor ffmpeg is available')
    const out = `${job.outBase}.mp4`
    const headers = Object.entries(src.headers ?? {})
      .filter(([k]) => k.toLowerCase() !== 'user-agent')
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join('')
    const args = ['-y', '-nostats', '-progress', 'pipe:1', '-user_agent', BROWSER_UA]
    if (headers) args.push('-headers', headers)
    args.push('-i', src.url, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', `${out}.part.mp4`)
    const duration = src.durationSec ?? job.item.durationSec ?? 0
    return new Promise((resolve, reject) => {
      const p = spawn(ff, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      this.procs.set(job.id, p)
      let err = ''
      p.stdout.on('data', (c: Buffer) => {
        const m = /out_time_us=(\d+)/.exec(c.toString())
        if (m && duration) this.update(job, { progress: Math.min(0.999, Number(m[1]) / 1e6 / duration) })
      })
      p.stderr.on('data', (c: Buffer) => (err = (err + c.toString()).slice(-1500)))
      p.on('error', reject)
      p.on('close', async (code) => {
        if (code !== 0) return reject(new Error(err.trim() || `ffmpeg exited with ${code}`))
        const { renameSync } = await import('node:fs')
        renameSync(`${out}.part.mp4`, out)
        resolve(out)
      })
    })
  }

  private async subtitles(job: Job, src: MediaSource, ctx: ExtractorContext): Promise<void> {
    if (!load().settings.subtitles || !src.subtitles?.length) return
    for (const s of src.subtitles) {
      try {
        const res = await ctx.fetch(s.url)
        if (res.ok) writeFileSync(`${job.outBase}.${s.lang.replace(/[^a-z0-9-]/gi, '')}.${s.ext}`, await res.text())
      } catch (e) {
        this.log(`subtitle failed for ${job.item.title}: ${(e as Error).message}`)
      }
    }
  }

  pause(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job || !['queued', 'resolving', 'downloading'].includes(job.status)) return
    this.update(job, { status: 'paused', speed: undefined, eta: undefined }, true)
    this.procs.get(id)?.kill('SIGTERM')
  }

  resume(id: string): void {
    const job = this.jobs.find((j) => j.id === id)
    if (!job || ['done', 'downloading', 'resolving'].includes(job.status)) return
    this.update(job, { status: 'queued', message: undefined }, true)
    this.pump()
  }

  remove(id: string): void {
    this.pause(id)
    const db = load()
    db.jobs = db.jobs.filter((j) => j.id !== id)
    this.changed(true)
  }

  clearFinished(): void {
    const db = load()
    db.jobs = db.jobs.filter((j) => !['done', 'skipped'].includes(j.status))
    this.changed(true)
  }

  /** After a successful login, retry everything that was waiting for it. */
  retryLoginRequired(siteId: string): void {
    for (const j of this.jobs) {
      if (j.siteId === siteId && (j.status === 'login-required' || j.status === 'error')) {
        Object.assign(j, { status: 'queued', message: undefined })
      }
    }
    this.changed(true)
    this.pump()
  }

  stopAll(): void {
    this.stopping = true
    for (const j of this.jobs) if (j.status === 'downloading' || j.status === 'resolving') j.status = 'queued'
    save(true)
    for (const p of this.procs.values()) p.kill('SIGTERM')
  }
}
