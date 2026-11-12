import type { Collection, DownloadMode, MediaItem, MediaSource } from '@shared/types'
import { detectDrm } from '../drm'
import { AuthRequiredError, SkipError, type Extractor, type ExtractorContext, type SniffResult } from './types'
import { hostSiteId } from './ytdlp'

/**
 * Generic "scrape and go to next" course crawler for sites without a dedicated
 * extractor. It opens the lesson page in a hidden browser that shares the
 * site's login session, records the media requests the player makes
 * (m3u8 / mpd / mp4), and discovers the other lessons either from the course
 * sidebar (sibling links) or by following "Next" links page by page.
 */

const MAX_PAGES = 400

function segs(u: URL): string[] {
  return u.pathname.split('/').filter(Boolean)
}

/** Links that look like siblings of the current lesson (same URL shape). */
export function siblingLessonLinks(current: string, links: { href: string; text: string }[]): { href: string; text: string }[] {
  const cur = new URL(current)
  const cs = segs(cur)
  const n = cs.length
  const parsed = links
    .map((l) => {
      try {
        return { ...l, u: new URL(l.href, cur) }
      } catch {
        return null
      }
    })
    .filter((x): x is { href: string; text: string; u: URL } => !!x && x.u.origin === cur.origin)

  for (let k = n - 1; k >= Math.max(1, n - 3); k--) {
    const prefix = cs.slice(0, k).join('/')
    const seen = new Set<string>()
    const out: { href: string; text: string }[] = []
    for (const l of parsed) {
      const ls = segs(l.u)
      if (ls.length !== n || ls.slice(0, k).join('/') !== prefix) continue
      const key = l.u.pathname.replace(/\/$/, '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ href: l.u.origin + l.u.pathname, text: l.text.trim() })
    }
    if (!seen.has(cur.pathname.replace(/\/$/, ''))) {
      // The current page should be in its own sibling list; add it in front.
      out.unshift({ href: cur.origin + cur.pathname, text: '' })
    }
    if (out.length >= 2) return out
  }
  return []
}

function itemFrom(href: string, title: string, index: number): MediaItem {
  return { id: href, index, title: title || `Lesson ${index}`, type: 'video', url: href }
}

async function sniffOrThrow(ctx: ExtractorContext, url: string): Promise<SniffResult> {
  if (!ctx.sniff) throw new Error('Browser sniffing is not available')
  return ctx.sniff(url)
}

export const crawlerExtractor: Extractor = {
  id: 'crawler',
  name: 'Generic course crawler',
  match: () => true,
  siteId: hostSiteId,
  loginUrl: (u) => `${u.protocol}//${u.host}/`,

  async analyze(url: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection> {
    const first = await sniffOrThrow(ctx, url)
    const base: Omit<Collection, 'items' | 'title'> = {
      extractor: 'crawler',
      siteId: ctx.siteId,
      siteName: new URL(url).hostname,
      mode,
      url,
      loggedIn: ctx.loggedIn
    }
    if (mode === 'single') {
      if (!first.media.length) {
        if (!ctx.loggedIn) throw new AuthRequiredError(ctx.siteId, 'No video found – login may be required')
        throw new Error('No playable video found on the page')
      }
      return { ...base, title: first.title, items: [itemFrom(first.finalUrl, first.title, 1)] }
    }

    // 1) Course sidebar / lesson list on the page.
    const siblings = siblingLessonLinks(first.finalUrl, first.links)
    if (siblings.length >= 2) {
      const items = siblings.map((l, i) => itemFrom(l.href, l.href === first.finalUrl ? first.title : l.text, i + 1))
      return { ...base, title: first.title.split(/[|\-–]/).pop()?.trim() || first.title, items }
    }

    // 2) Walk "Next" links page by page.
    const items: MediaItem[] = []
    const visited = new Set<string>()
    let page: SniffResult | null = first
    while (page && items.length < MAX_PAGES) {
      const key = page.finalUrl.split('#')[0]
      if (visited.has(key)) break
      visited.add(key)
      items.push(itemFrom(key, page.title, items.length + 1))
      ctx.log(`crawler: found lesson ${items.length}: ${page.title}`)
      if (!page.nextHref) break
      page = await sniffOrThrow(ctx, new URL(page.nextHref, page.finalUrl).href)
    }
    if (!first.media.length && items.length <= 1 && !ctx.loggedIn) {
      throw new AuthRequiredError(ctx.siteId, 'No lessons or videos found – login may be required')
    }
    return { ...base, title: first.title, items }
  },

  async resolve(item: MediaItem, ctx: ExtractorContext): Promise<MediaSource> {
    if (!item.url) throw new Error('No URL for item')
    const r = await sniffOrThrow(ctx, item.url)
    if (r.licenseRequests.length) throw new SkipError('DRM-protected (licence server request seen) – skipped')
    const best = r.media.find((m) => m.kind === 'hls') ?? r.media.find((m) => m.kind === 'dash') ?? r.media[0]
    if (!best) {
      if (!ctx.loggedIn) throw new AuthRequiredError(ctx.siteId, 'No video found – login may be required')
      throw new SkipError('No video on this page')
    }
    if (best.kind !== 'file') {
      try {
        const res = await ctx.fetch(best.url, { headers: best.headers })
        const drm = detectDrm(await res.text())
        if (drm.drm) throw new SkipError(`DRM-protected (${drm.system}) – skipped`)
      } catch (e) {
        if (e instanceof SkipError) throw e
      }
    }
    return { url: best.url, kind: best.kind, headers: best.headers }
  }
}
