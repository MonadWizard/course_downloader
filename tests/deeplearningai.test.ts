import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { courseToItems, deeplearningai, parseCourseSlug, readingToSource, videoToSource } from '../src/main/extractors/deeplearningai'
import { AuthRequiredError, type ExtractorContext } from '../src/main/extractors/types'

const fixture = (n: string): any => JSON.parse(readFileSync(join(__dirname, 'fixtures', n), 'utf8'))
const course = fixture('dlai-getCourseBySlug.json').result.data.json
const video = fixture('dlai-getLessonVideo.json').result.data.json
const LESSON =
  'https://learn.deeplearning.ai/courses/evaluating-and-improving-agentic-applications/lesson/53tpudpi/a-conversation-between-laurie-voss-and-andrew-ng'

function ctx(routes: Record<string, unknown>): ExtractorContext {
  return {
    siteId: 'deeplearningai',
    loggedIn: false,
    log: () => {},
    ytdlp: async () => '',
    fetch: async (url: string) => {
      const proc = /trpc\/([^?]+)/.exec(url)![1]
      return new Response(JSON.stringify(routes[proc]), { status: 200 })
    }
  }
}

describe('deeplearning.ai', () => {
  it('parses course slug and lesson id from URLs', () => {
    expect(parseCourseSlug(new URL(LESSON))).toEqual({ slug: 'evaluating-and-improving-agentic-applications', lessonId: '53tpudpi' })
    expect(parseCourseSlug(new URL('https://www.deeplearning.ai/short-courses/foo-bar/'))).toEqual({ slug: 'foo-bar' })
    expect(deeplearningai.match(new URL(LESSON))).toBe(true)
    expect(deeplearningai.match(new URL('https://www.deeplearning.ai/the-batch/'))).toBe(false)
  })

  it('orders the whole course by modules', () => {
    const items = courseToItems(course, course.slug)
    expect(items).toHaveLength(52)
    expect(items.filter((i) => i.type === 'video')).toHaveLength(28)
    expect(new Set(items.map((i) => i.module)).size).toBe(5)
    expect(items[0]).toMatchObject({ id: '53tpudpi', module: 'Module 1 - Foundations of Evals', moduleIndex: 1, indexInModule: 1, type: 'video' })
    expect(items.find((i) => i.id === 'nap9iymg')).toMatchObject({ locked: true, type: 'notebook' })
    expect(items.find((i) => i.id === 'a4ui1p')).toMatchObject({ moduleIndex: 2, indexInModule: 1 })
    expect(items.map((i) => i.index)).toEqual(items.map((_, i) => i + 1))
  })

  it('maps the lesson video to an HLS source with subtitles', () => {
    const src = videoToSource(video)
    expect(src.kind).toBe('hls')
    expect(src.url).toMatch(/master\.m3u8/)
    expect(src.subtitles?.[0]).toMatchObject({ ext: 'vtt' })
  })

  it('analyzes a full course and a single lesson through the API', async () => {
    const c = ctx({ 'course.getCourseBySlug': { result: { data: { json: course } } } })
    const full = await deeplearningai.analyze(LESSON, 'course', c)
    expect(full.title).toBe('Evaluating and Improving Agentic Applications')
    expect(full.items).toHaveLength(52)
    expect(full.loginSuggested).toBe(true)
    const one = await deeplearningai.analyze(LESSON, 'single', c)
    expect(one.items).toHaveLength(1)
    expect(one.items[0].id).toBe('53tpudpi')
  })

  it('turns tRPC UNAUTHORIZED into AuthRequiredError', async () => {
    const c = ctx({
      'course.getReadingMaterial': { error: { json: { message: 'UNAUTHORIZED', data: { code: 'UNAUTHORIZED', httpStatus: 401 } } } }
    })
    const item = courseToItems(course, course.slug).find((i) => i.type === 'reading')!
    await expect(deeplearningai.resolve(item, c)).rejects.toBeInstanceOf(AuthRequiredError)
  })

  it('extracts reading material text', () => {
    const src = readingToSource({ id: 'x', content: '<h1>Hello</h1><p>How tracing works in detail.</p>' }, 'Reading')
    expect(src.textExt).toBe('html')
    expect(src.text).toContain('How tracing works')
  })
})

import { mapType, scanLabPayload } from '../src/main/extractors/deeplearningai'

describe('deeplearning.ai video + notebook lessons', () => {
  it('treats video_notebook lessons as videos', () => {
    expect(mapType('video_notebook')).toBe('video')
    expect(mapType('notebook')).toBe('notebook')
    expect(mapType('graded_notebook')).toBe('notebook')
  })
  it('resolves a stored "notebook" job of a video_notebook lesson as video (retry of old jobs)', async () => {
    const item = { id: 'cxr0v', index: 8, title: 'Building multi-agent systems', type: 'notebook' as const, data: { lessonType: 'video_notebook', videoId: 10173265, programId: 1 } }
    const c: any = {
      siteId: 'deeplearningai', loggedIn: false, log: () => {}, ytdlp: async () => '',
      fetch: async () => new Response(JSON.stringify({ result: { data: { json: video } } }))
    }
    const src = await deeplearningai.resolve(item, c)
    expect(src.kind).toBe('hls')
  })
  it('sends {materialId} to getReadingMaterial', async () => {
    let seen = ''
    const c: any = {
      siteId: 'deeplearningai', loggedIn: true, log: () => {}, ytdlp: async () => '',
      fetch: async (u: string) => {
        seen = decodeURIComponent(u)
        return new Response(JSON.stringify({ result: { data: { json: { content: '<p>Some long reading material text here</p>' } } } }))
      }
    }
    const item = courseToItems(course, course.slug).find((i) => i.type === 'reading')!
    await deeplearningai.resolve(item, c)
    expect(seen).toContain('"materialId"')
  })
  it('finds notebooks and lab URLs in a lab payload', () => {
    const r = scanLabPayload({ url: 'https://lab.example/user/x/lab/tree/L1.ipynb?token=abc', saveNotebook: { content: '{"cells":[],"nbformat":4}', name: 'L1.ipynb' } })
    expect(r.urls[0]).toMatch(/token=abc/)
    expect(r.notebooks).toHaveLength(1)
  })
})
