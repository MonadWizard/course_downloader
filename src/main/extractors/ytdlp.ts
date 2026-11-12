import type { Collection, DownloadMode, MediaItem, MediaSource } from '@shared/types'
import { AuthRequiredError, type Extractor, type ExtractorContext } from './types'

/** yt-dlp errors that mean "log in / pass cookies and try again". */
export function isAuthError(msg: string): boolean {
  return /sign in|log ?in|login required|cookies|members-only|private video|premium|HTTP Error 40[13]|confirm your age|account/i.test(
    msg
  )
}

export function hostSiteId(u: URL): string {
  return u.hostname.replace(/^(www|m|music|learn|app)\./, '')
}

function entryUrl(e: any): string | undefined {
  if (e?.url && /^https?:/.test(e.url)) return e.url
  if (e?.webpage_url) return e.webpage_url
  if (e?.ie_key === 'Youtube' && e?.id) return `https://www.youtube.com/watch?v=${e.id}`
  return e?.url
}

export function infoToCollection(info: any, url: string, mode: DownloadMode, siteId: string, loggedIn: boolean): Collection {
  const entries: any[] = Array.isArray(info?.entries) ? info.entries.filter(Boolean) : []
  const isList = entries.length > 0
  const items: MediaItem[] = isList
    ? entries.map((e, i) => ({
        id: String(e.id ?? i),
        index: i + 1,
        title: String(e.title ?? `Video ${i + 1}`),
        type: 'video' as const,
        durationSec: e.duration ?? undefined,
        url: entryUrl(e)
      }))
    : [
        {
          id: String(info.id ?? '1'),
          index: 1,
          title: String(info.title ?? 'video'),
          type: 'video' as const,
          durationSec: info.duration ?? undefined,
          url: info.webpage_url ?? url
        }
      ]
  return {
    extractor: 'ytdlp',
    siteId,
    siteName: String(info?.extractor_key ?? siteId),
    mode: isList ? (mode === 'single' ? 'playlist' : mode) : 'single',
    title: String(info?.title ?? info?.playlist_title ?? 'Downloads'),
    url,
    items,
    loggedIn
  }
}

export const ytdlpExtractor: Extractor = {
  id: 'ytdlp',
  name: 'yt-dlp (YouTube & 1800+ sites)',
  match: () => true,
  siteId: hostSiteId,
  loginUrl: (u) => `${u.protocol}//${u.host}/`,

  async analyze(url: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection> {
    const args = ['-J', '--no-warnings', '--ignore-no-formats-error']
    if (mode === 'single') args.push('--no-playlist')
    else args.push('--flat-playlist', '--yes-playlist')
    if (ctx.cookiesFile) args.push('--cookies', ctx.cookiesFile)
    args.push('--', url)
    let out: string
    try {
      out = await ctx.ytdlp(args)
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (isAuthError(msg)) throw new AuthRequiredError(ctx.siteId, msg.split('\n').find((l) => /ERROR/.test(l)) ?? msg)
      throw e
    }
    return infoToCollection(JSON.parse(out), url, mode, ctx.siteId, ctx.loggedIn)
  },

  async resolve(item: MediaItem): Promise<MediaSource> {
    if (!item.url) throw new Error('No URL for item')
    return { url: item.url, kind: 'ytdlp', durationSec: item.durationSec }
  }
}
