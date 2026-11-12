import { sanitize } from '@shared/naming'
import type { Collection, DownloadMode, ItemType, MediaItem, MediaSource, SubtitleTrack } from '@shared/types'
import { AuthRequiredError, SkipError, type ExtraFile, type Extractor, type ExtractorContext } from './types'

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
  programId?: number | null
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

export function mapType(t: string): ItemType {
  // "video_notebook" = video with a Jupyter notebook side by side → download the video (+ notebook as extra).
  if (t === 'video' || t.startsWith('video')) return 'video'
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
        courseId: course.courseId,
        programId: lesson.programId ?? null,
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

/** Short description of a JSON payload's shape for the activity log (no values). */
export function shapeOf(o: unknown, depth = 0): string {
  if (Array.isArray(o)) return `[${o.length ? shapeOf(o[0], depth + 1) : ''}]`
  if (o && typeof o === 'object') {
    if (depth > 2) return '{…}'
    return `{${Object.entries(o)
      .slice(0, 15)
      .map(([k, v]) => `${k}:${shapeOf(v, depth + 1)}`)
      .join(',')}}`
  }
  return typeof o
}

function safeRel(path: string): string {
  return path
    .split(/[\\/]+/)
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/')
}

/** Inline notebooks ({cells:[…]}) and URLs anywhere inside a payload. */
export function scanLabPayload(o: unknown): { notebooks: { name?: string; nb: unknown }[]; urls: string[] } {
  const notebooks: { name?: string; nb: unknown }[] = []
  const urls: string[] = []
  const walk = (v: unknown, key?: string, parent?: any): void => {
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v)) urls.push(v)
      else if (v.trimStart().startsWith('{') && v.includes('"cells"')) {
        try {
          const nb = JSON.parse(v)
          if (Array.isArray(nb?.cells)) notebooks.push({ name: parent?.name ?? parent?.path ?? key, nb })
        } catch {
          /* not JSON */
        }
      }
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key, parent))
    else if (v && typeof v === 'object') {
      const obj = v as any
      if (Array.isArray(obj.cells) && (obj.nbformat || obj.metadata)) notebooks.push({ name: parent?.name ?? parent?.path ?? key, nb: obj })
      else for (const [k, x] of Object.entries(obj)) walk(x, k, obj)
    }
  }
  walk(o)
  return { notebooks, urls }
}

/** Download notebook + files from a Jupyter server via its contents API. */
async function jupyterFiles(ctx: ExtractorContext, labUrl: string): Promise<ExtraFile[]> {
  const u = new URL(labUrl)
  const token = u.searchParams.get('token')
  const m = /^(.*?)\/(lab|tree|notebooks|voila|edit)(\/|$)/.exec(u.pathname)
  const base = `${u.origin}${(m ? m[1] : u.pathname).replace(/\/$/, '')}`
  const q = (extra = ''): string => `?content=1${extra}${token ? `&token=${encodeURIComponent(token)}` : ''}`
  const files: ExtraFile[] = []
  let total = 0
  const get = async (path: string, extra = ''): Promise<any> => {
    const res = await ctx.fetch(`${base}/api/contents/${path.split('/').map(encodeURIComponent).join('/')}${q(extra)}`, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`Jupyter contents HTTP ${res.status}`)
    return res.json()
  }
  const walk = async (path: string, depth: number): Promise<void> => {
    const dir = await get(path)
    for (const e of dir?.content ?? []) {
      if (!e?.name || e.name.startsWith('.') || e.name === '__pycache__') continue
      if (e.type === 'directory' && depth < 3) await walk(e.path, depth + 1)
      else if (e.type === 'notebook') {
        const nb = await get(e.path)
        files.push({ name: safeRel(e.path), data: JSON.stringify(nb.content, null, 1) })
      } else if (e.type === 'file' && (e.size ?? 0) < 50e6 && total < 300e6) {
        const f = await get(e.path, '&format=base64&type=file')
        const buf = Buffer.from(String(f.content ?? ''), f.format === 'base64' ? 'base64' : 'utf8')
        total += buf.length
        files.push({ name: safeRel(e.path), data: buf })
      }
    }
  }
  await walk('', 0)
  return files
}

/** Notebook (and its data files) of a lesson. Requires login. */
export async function fetchNotebookFiles(item: MediaItem, ctx: ExtractorContext): Promise<ExtraFile[]> {
  const d = item.data ?? {}
  if (!d.programId) return []
  if (!ctx.loggedIn) throw new AuthRequiredError(SITE, 'Log in to download lesson notebooks')
  // The web app sends userId -1 (server uses the session) and polls while the lab container starts.
  let lab: unknown
  for (let attempt = 1; ; attempt++) {
    try {
      lab = await trpc<unknown>(ctx, 'course.getProgramLab', { programAssignmentId: d.programId, courseId: d.courseId, userId: -1 })
      if ((lab as any)?.url || attempt >= 24) break
    } catch (e) {
      if (e instanceof AuthRequiredError || attempt >= 24) throw e
    }
    if (attempt === 1) ctx.log(`notebook "${item.title}": waiting for the lab to start…`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  ctx.log(`notebook "${item.title}": lab response ${shapeOf(lab)}`)
  const { notebooks, urls } = scanLabPayload(lab)
  const files: ExtraFile[] = notebooks.map((n, i) => ({
    name: safeRel(String(n.name ?? '')).replace(/\.ipynb$/, '') ? `${safeRel(String(n.name)).replace(/\.ipynb$/, '')}.ipynb` : `notebook${i ? `-${i + 1}` : ''}.ipynb`,
    data: JSON.stringify(n.nb, null, 1)
  }))
  if (files.length) return files
  for (const url of urls) {
    try {
      const got = await jupyterFiles(ctx, url)
      if (got.length) return got
    } catch (e) {
      ctx.log(`notebook "${item.title}": ${url.split('?')[0]} → ${(e as Error).message}`)
    }
  }
  return []
}

/**
 * Jobs saved by older app versions may lack fields (courseId, programId…).
 * Re-read the course outline once and refresh the item's data in place.
 */
async function freshItemData(item: MediaItem, ctx: ExtractorContext): Promise<Record<string, any>> {
  const d = (item.data ?? {}) as Record<string, any>
  if ('programId' in d && 'courseId' in d) return d
  const parsed = item.url ? parseCourseSlug(new URL(item.url)) : null
  if (!parsed) return d
  const course = await trpc<DlaiCourse>(ctx, 'course.getCourseBySlug', { courseSlug: parsed.slug })
  const fresh = course?.lessons ? courseToItems(course, parsed.slug).find((i) => i.id === item.id) : undefined
  if (fresh?.data) item.data = { ...d, ...fresh.data }
  return (item.data ?? d) as Record<string, any>
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

  // The lab is one Jupyter workspace per course (all modules' notebooks + data).
  extrasScope: 'course',
  extrasSubdir: 'Labs',

  async extras(item: MediaItem, ctx: ExtractorContext): Promise<ExtraFile[]> {
    // Companion notebook of a "video_notebook" lesson (only when logged in).
    if (!item.data?.videoId || !item.data?.programId || !ctx.loggedIn) return []
    return fetchNotebookFiles(item, ctx)
  },

  async resolve(item: MediaItem, ctx: ExtractorContext): Promise<MediaSource> {
    const d = await freshItemData(item, ctx)
    if (d.videoId) {
      const video = await trpc<any>(ctx, 'course.getLessonVideo', { videoId: d.videoId })
      return videoToSource(video)
    }
    if (d.readingMaterialId) {
      const r = await trpc<unknown>(ctx, 'course.getReadingMaterial', { materialId: d.readingMaterialId })
      return readingToSource(r, item.title)
    }
    if (d.programId) {
      const graded = String(d.lessonType).startsWith('graded')
      let files: ExtraFile[]
      try {
        files = await fetchNotebookFiles(item, ctx)
      } catch (e) {
        if (graded && !(e instanceof AuthRequiredError)) {
          throw new SkipError(`Graded lab not accessible (${(e as Error).message}) – its notebook is usually in the course "Lab files" folder`)
        }
        throw e
      }
      if (!files.length) throw new SkipError('Notebook files not available (open the lab once on the website, then retry)')
      // Graded labs each have their own workspace (same file names) → own folder.
      // Ungraded labs share one course workspace → "Labs".
      return { url: '', kind: 'files', files, filesScope: 'course', filesSubdir: graded ? sanitize(item.title.replace(/:\s*/, ' - ')) : 'Labs' }
    }
    if (item.type === 'quiz') throw new SkipError('Quiz – not downloadable')
    throw new SkipError(`Unsupported lesson type: ${String(d.lessonType)}`)
  }
}
