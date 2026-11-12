import { execFile } from 'node:child_process'
import type { ExtractorContext } from './extractors/types'
import { exportCookies, getCookie, isLoggedIn, siteSession } from './auth'
import { ffmpegPath, ytdlpPath } from './binaries'
import { sniff } from './sniffer'

export type Logger = (msg: string) => void

/** Run yt-dlp and collect stdout (JSON dumps can be large). */
export function runYtdlp(args: string[]): Promise<string> {
  const bin = ytdlpPath()
  if (!bin) return Promise.reject(new Error('yt-dlp is not installed yet (Settings → Install yt-dlp)'))
  const ff = ffmpegPath()
  const full = ff ? ['--ffmpeg-location', ff, ...args] : args
  return new Promise((resolve, reject) => {
    execFile(bin, full, { maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message))
      else resolve(stdout)
    })
  })
}

/** true when url's hostname is `domain` or a subdomain of it (https only). */
export function isHostOf(url: string, domain: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === domain || u.hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

/** Build the session-aware context an extractor works with. */
export async function makeContext(siteId: string, log: Logger): Promise<ExtractorContext> {
  const ses = siteSession(siteId)
  const loggedIn = await isLoggedIn(siteId)
  const cookiesFile = loggedIn ? await exportCookies(siteId) : undefined
  const extraHeaders: Record<string, string> = {}
  let authHost: string | null = null
  if (siteId === 'udemy') {
    const token = await getCookie(siteId, 'access_token')
    if (token) {
      authHost = 'udemy.com'
      extraHeaders.Authorization = `Bearer ${token}`
      extraHeaders['X-Udemy-Authorization'] = `Bearer ${token}`
    }
  }
  return {
    siteId,
    loggedIn,
    cookiesFile,
    log,
    fetch: (url, init) => {
      const headers = new Headers(init?.headers)
      // Site credentials (e.g. Udemy bearer token) only go to that site's own hosts.
      if (authHost && isHostOf(url, authHost)) {
        for (const [k, v] of Object.entries(extraHeaders)) if (!headers.has(k)) headers.set(k, v)
      }
      // session.fetch sends the site's cookies, like the real browser would.
      return ses.fetch(url, { ...init, headers, credentials: 'include' } as RequestInit)
    },
    ytdlp: runYtdlp,
    sniff: (url, opts) => sniff(ses, url, opts)
  }
}
