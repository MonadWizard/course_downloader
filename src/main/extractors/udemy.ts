import type { Collection, DownloadMode, MediaItem, MediaSource, SubtitleTrack } from '@shared/types'
import { AuthRequiredError, SkipError, type Extractor, type ExtractorContext } from './types'

/**
 * Udemy (experimental). Uses the same JSON API the web player uses, with the
 * logged-in session. Lectures that Udemy protects with Widevine DRM
 * (course_is_drmed / media_license_token) are skipped – never decrypted.
 */

const BASE = 'https://www.udemy.com'
const SITE = 'udemy'
const ASSET_FIELDS =
  'asset_type,length,media_sources,stream_urls,captions,media_license_token,course_is_drmed,title,filename,body,external_url'

export function parseUdemy(u: URL): { slug: string; lectureId?: string } | null {
  const m = /\/course\/([^/]+)(?:\/learn\/lecture\/(\d+))?/.exec(u.pathname)
  return m ? { slug: m[1], lectureId: m[2] } : null
}

async function api<T>(ctx: ExtractorContext, path: string): Promise<T> {
  const res = await ctx.fetch(`${BASE}${path}`, {
    headers: { accept: 'application/json, text/plain, */*', 'x-requested-with': 'XMLHttpRequest' }
  })
  if (res.status === 401 || res.status === 403) throw new AuthRequiredError(SITE, `Udemy: HTTP ${res.status} – login / enrollment required`)
  if (!res.ok) throw new Error(`Udemy API HTTP ${res.status}`)
  return (await res.json()) as T
}

export function curriculumToItems(results: any[], courseId: number): MediaItem[] {
  const items: MediaItem[] = []
  let module: string | undefined
  let moduleIndex = 0
  let inModule = 0
  for (const r of results) {
    if (r._class === 'chapter') {
      moduleIndex++
      inModule = 0
      module = String(r.title)
      continue
    }
    if (r._class !== 'lecture') continue
    inModule++
    const assetType = String(r.asset?.asset_type ?? 'Video')
    items.push({
      id: String(r.id),
      index: items.length + 1,
      title: String(r.title),
      type: assetType === 'Article' ? 'reading' : assetType.startsWith('Video') ? 'video' : 'other',
      module,
      moduleIndex: module ? moduleIndex : undefined,
      indexInModule: inModule,
      durationSec: r.asset?.length ?? undefined,
      locked: Boolean(r.asset?.course_is_drmed || r.asset?.media_license_token),
      data: { courseId, lectureId: r.id, assetType }
    })
  }
  return items
}

export function assetToSource(asset: any, title: string): MediaSource {
  if (!asset) throw new Error('Udemy: lecture has no asset')
  if (asset.course_is_drmed || asset.media_license_token) throw new SkipError('DRM-protected (Udemy Widevine) – skipped')
  if (asset.asset_type === 'Article') {
    return {
      url: '',
      kind: 'text',
      textExt: 'html',
      text: `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${asset.body ?? ''}</body></html>`
    }
  }
  const subtitles: SubtitleTrack[] = (asset.captions ?? [])
    .filter((c: any) => c?.url)
    .map((c: any) => ({ lang: String(c.locale_id ?? c.video_label ?? 'en'), url: c.url, ext: 'vtt' }))
  const hls = (asset.media_sources ?? []).find((s: any) => /mpegurl/i.test(s?.type ?? ''))
  if (hls?.src) return { url: hls.src, kind: 'hls', headers: { Referer: `${BASE}/` }, subtitles }
  const mp4s: any[] = [...(asset.media_sources ?? []), ...(asset.stream_urls?.Video ?? [])].filter(
    (s) => /mp4/i.test(s?.type ?? '') && (s.src || s.file)
  )
  mp4s.sort((a, b) => parseInt(b.label ?? '0') - parseInt(a.label ?? '0'))
  if (mp4s[0]) return { url: mp4s[0].src ?? mp4s[0].file, kind: 'file', headers: { Referer: `${BASE}/` }, subtitles }
  if (asset.external_url) return { url: asset.external_url, kind: 'ytdlp' }
  throw new SkipError(`Udemy: no downloadable media for ${asset.asset_type}`)
}

export const udemy: Extractor = {
  id: 'udemy',
  name: 'Udemy',
  match: (u) => /(^|\.)udemy\.com$/.test(u.hostname) && parseUdemy(u) !== null,
  siteId: () => SITE,
  loginUrl: () => `${BASE}/join/login-popup/`,

  async analyze(url: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection> {
    const p = parseUdemy(new URL(url))
    if (!p) throw new Error('Not a Udemy course URL')
    const course = await api<{ id: number; title: string }>(ctx, `/api-2.0/courses/${p.slug}/?fields[course]=id,title`)
    const results: any[] = []
    let next: string | null =
      `/api-2.0/courses/${course.id}/subscriber-curriculum-items/?page_size=200&fields[lecture]=title,object_index,asset&fields[chapter]=title,object_index&fields[asset]=asset_type,length,course_is_drmed,media_license_token`
    while (next) {
      const page: { results: any[]; next: string | null } = await api(ctx, next)
      results.push(...page.results)
      next = page.next ? page.next.replace(BASE, '') : null
    }
    let items = curriculumToItems(results, course.id)
    if (mode === 'single' && p.lectureId) items = items.filter((i) => i.id === p.lectureId).map((i) => ({ ...i, index: 1 }))
    return {
      extractor: 'udemy',
      siteId: SITE,
      siteName: 'Udemy',
      mode,
      title: course.title,
      url,
      items,
      loggedIn: ctx.loggedIn
    }
  },

  async resolve(item: MediaItem, ctx: ExtractorContext): Promise<MediaSource> {
    const { courseId, lectureId } = item.data as { courseId: number; lectureId: number }
    const lec = await api<any>(
      ctx,
      `/api-2.0/users/me/subscribed-courses/${courseId}/lectures/${lectureId}/?fields[lecture]=asset,title&fields[asset]=${ASSET_FIELDS}`
    )
    return assetToSource(lec.asset, item.title)
  }
}
