import type { Collection, DownloadMode, ItemType, MediaItem, MediaSource, SubtitleTrack } from '@shared/types'
import { AuthRequiredError, SkipError, type Extractor, type ExtractorContext } from './types'

/**
 * learn.deeplearning.ai
 *
 * The platform is a Next.js app with a tRPC API:
 *   GET /api/trpc/course.getCourseBySlug?input={"json":{"courseSlug":"..."}}  → whole course outline
 *   GET /api/trpc/course.getLessonVideo?input={"json":{"videoId":123}}        → HLS master + VTT
 *   GET /api/trpc/course.getReadingMaterial?input={"json":{"readingMaterialId":"..."}} (login)
 * Free lessons work anonymously; "locked"/pro lessons and readings need the
 * next-auth session cookie, which the login window provides.
 */

const BASE = 'https://learn.deeplearning.ai'
const SITE = 'deeplearningai'

interface DlaiLesson {
  index: number
  slug: string
  name: string
  type: string
  videoId: number | null
  time: number | null
  accessControl?: string
  requiredUserTier?: string | null
  readingMaterialId?: string | null
}

interface DlaiCourse {
  courseId: number
  name: string
  slug: string
  lessons: Record<string, DlaiLesson>
  subtopics?: Record<string, { name: string; lessonKeys: string[] }>
  listing?: { moduleLabel?: string; name: string; content: { key: string; type: 'lesson' | 'subtopic' }[] }[]
}

export function parseCourseSlug(u: URL): { slug: string; lessonId?: string } | null {
  const parts = u.pathname.split('/').filter(Boolean)
  // learn.deeplearning.ai/courses/<slug>[/lesson/<id>/<name>]
  const ci = parts.indexOf('courses')
  if (ci >= 0 && parts[ci + 1]) {
    const li = parts.indexOf('lesson')
    return { slug: parts[ci + 1], lessonId: li >= 0 ? parts[li + 1] : undefined }
  }
  // www.deeplearning.ai/short-courses/<slug>/  (marketing page, same slug)
  const si = parts.findIndex((p) => p === 'short-courses' || p === 'courses')
  if (si >= 0 && parts[si + 1]) return { slug: parts[si + 1] }
  return null
}

function mapType(t: string): ItemType {
  if (t === 'video') return 'video'
  if (t === 'reading_material') return 'reading'
  if (t.includes('notebook')) return 'notebook'
  if (t === 'quiz') return 'quiz'
  return 'other'
}

async function trpc<T>(ctx: ExtractorContext, proc: string, input: unknown): Promise<T> {
  const url = `${BASE}/api/trpc/${proc}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
  const res = await ctx.fetch(url, { headers: { accept: 'application/json' } })
  let body: any
  try {
    body = await res.json()
  } catch {
    if (res.status === 401 || res.status === 403) throw new AuthRequiredError(SITE)
    throw new Error(`deeplearning.ai ${proc}: HTTP ${res.status}`)
  }
  const err = body?.error?.json
  if (err) {
    const code = err.data?.code
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || err.data?.httpStatus === 401 || err.data?.httpStatus === 403) {
      throw new AuthRequiredError(SITE, `deeplearning.ai: ${err.message || code}`)
    }
    throw new Error(`deeplearning.ai ${proc}: ${err.message || code}`)
  }
  return body?.result?.data?.json as T
}

/** Turn the course JSON into ordered items grouped by module (pure, unit-tested). */
export function courseToItems(course: DlaiCourse, slug: string): MediaItem[] {
  const ordered: { lesson: DlaiLesson; module?: string; moduleIndex?: number }[] = []
  const seen = new Set<string>()
  const push = (key: string, module?: string, moduleIndex?: number): void => {
    const lesson = course.lessons[key]
    if (!lesson || seen.has(key)) return
    seen.add(key)
    ordered.push({ lesson, module, moduleIndex })
  }

  ;(course.listing ?? []).forEach((mod, mi) => {
    const modName = mod.moduleLabel ? `${mod.moduleLabel} - ${mod.name}` : mod.name
    for (const c of mod.content) {
      if (c.type === 'lesson') push(c.key, modName, mi + 1)
      else for (const k of course.subtopics?.[c.key]?.lessonKeys ?? []) push(k, modName, mi + 1)
    }
  })
  // Anything not referenced by the listing, in platform index order.
  Object.values(course.lessons)
    .sort((a, b) => a.index - b.index)
    .forEach((l) => push(l.slug))

  const perModule = new Map<number, number>()
  return ordered.map(({ lesson, module, moduleIndex }, i) => {
    const mi = moduleIndex ?? 0
    const pos = (perModule.get(mi) ?? 0) + 1
    perModule.set(mi, pos)
    const nameSlug = lesson.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    return {
      id: lesson.slug,
      index: i + 1,
      title: lesson.name.trim(),
      type: mapType(lesson.type),
      module,
      moduleIndex,
      indexInModule: pos,
      durationSec: lesson.time ?? undefined,
      url: `${BASE}/courses/${slug}/lesson/${lesson.slug}/${nameSlug}`,
      locked: lesson.accessControl !== undefined && lesson.accessControl !== 'full',
      data: {
        lessonType: lesson.type,
        videoId: lesson.videoId,
        readingMaterialId: lesson.readingMaterialId ?? null,
        tier: lesson.requiredUserTier ?? null
      }
    } satisfies MediaItem
  })
}

export function videoToSource(video: any): MediaSource {
  const v = video?.video ?? video
  const url: string | undefined = v?.srcSet?.[0]?.src || v?.mp4Url || v?.webmUrl || v?.mp4360pUrl
  if (!url) throw new Error('deeplearning.ai: no video URL in response')
  const subtitles: SubtitleTrack[] = []
  for (const t of v.tracks ?? []) {
    if (t?.src) subtitles.push({ lang: String(t.srcLang || t.label || 'en'), url: t.src, ext: 'vtt' })
  }
  if (!subtitles.length && typeof v.subtitle === 'string') {
    try {
      for (const [lang, s] of Object.entries<any>(JSON.parse(v.subtitle))) {
        if (s?.URI) subtitles.push({ lang, url: s.URI, ext: 'vtt' })
      }
    } catch {
      /* ignore */
    }
  }
  return {
    url,
    kind: /\.m3u8(\?|$)/.test(url) ? 'hls' : 'file',
    headers: { Referer: `${BASE}/`, Origin: BASE },
    subtitles
  }
}

/** Find the most likely body text in an unknown reading-material payload. */
export function readingToSource(payload: unknown, title: string): MediaSource {
  let best = ''
  const walk = (o: unknown): void => {
    if (typeof o === 'string') {
      if (o.length > best.length) best = o
    } else if (Array.isArray(o)) o.forEach(walk)
    else if (o && typeof o === 'object') Object.values(o).forEach(walk)
  }
  walk(payload)
  if (best.length < 20) throw new SkipError('Reading material is empty or not accessible')
  const isHtml = /<\/?(p|div|h\d|ul|li|span|img|a)\b/i.test(best)
  const text = isHtml
    ? `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${best}</body></html>`
    : best
  return { url: '', kind: 'text', text, textExt: isHtml ? 'html' : 'md' }
}

export const deeplearningai: Extractor = {
  id: 'deeplearningai',
  name: 'DeepLearning.AI',
  match: (u) => /(^|\.)deeplearning\.ai$/.test(u.hostname) && parseCourseSlug(u) !== null,
  siteId: () => SITE,
  loginUrl: () => `${BASE}/`,

  async analyze(rawUrl: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection> {
    const parsed = parseCourseSlug(new URL(rawUrl))
    if (!parsed) throw new Error('Not a deeplearning.ai course URL')
    const course = await trpc<DlaiCourse>(ctx, 'course.getCourseBySlug', { courseSlug: parsed.slug })
    if (!course?.lessons) throw new AuthRequiredError(SITE, 'Course not available (login or enrollment needed)')
    let items = courseToItems(course, parsed.slug)
    if (mode === 'single') {
      const one = items.find((i) => i.id === parsed.lessonId) ?? items.find((i) => i.type === 'video')
      items = one ? [{ ...one, index: 1 }] : []
    }
    const locked = items.some((i) => i.locked)
    return {
      extractor: 'deeplearningai',
      siteId: SITE,
      siteName: 'DeepLearning.AI',
      mode,
      title: course.name,
      url: rawUrl,
      items,
      loggedIn: ctx.loggedIn,
      loginSuggested: locked && !ctx.loggedIn
    }
  },

  async resolve(item: MediaItem, ctx: ExtractorContext): Promise<MediaSource> {
    const d = item.data ?? {}
    if (item.type === 'video' && d.videoId) {
      const video = await trpc<any>(ctx, 'course.getLessonVideo', { videoId: d.videoId })
      return videoToSource(video)
    }
    if (item.type === 'reading' && d.readingMaterialId) {
      const r = await trpc<unknown>(ctx, 'course.getReadingMaterial', { readingMaterialId: d.readingMaterialId })
      return readingToSource(r, item.title)
    }
    if (item.type === 'notebook') throw new SkipError('Lab notebook (hosted Jupyter) – open it on the website')
    if (item.type === 'quiz') throw new SkipError('Quiz – not downloadable')
    throw new SkipError(`Unsupported lesson type: ${String(d.lessonType)}`)
  }
}
