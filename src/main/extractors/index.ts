import type { Collection, DownloadMode } from '@shared/types'
import { crawlerExtractor } from './crawler'
import { deeplearningai } from './deeplearningai'
import { AuthRequiredError, type Extractor, type ExtractorContext } from './types'
import { udemy } from './udemy'
import { ytdlpExtractor } from './ytdlp'

/** Dedicated platform extractors, tried first. Add new sites here. */
export const platformExtractors: Extractor[] = [deeplearningai, udemy]
export const allExtractors: Extractor[] = [...platformExtractors, ytdlpExtractor, crawlerExtractor]

export function extractorById(id: string): Extractor {
  const e = allExtractors.find((x) => x.id === id)
  if (!e) throw new Error(`Unknown extractor ${id}`)
  return e
}

/** The extractor whose site/session a URL belongs to (platform or generic). */
export function primaryExtractor(url: URL): Extractor {
  return platformExtractors.find((e) => e.match(url)) ?? ytdlpExtractor
}

function unsupportedByYtdlp(msg: string): boolean {
  return /unsupported url|no video formats|unable to extract|no media found|is not a valid url/i.test(msg)
}

/**
 * Analyze a URL:
 *  1. dedicated platform extractor, if any;
 *  2. otherwise yt-dlp;
 *  3. if yt-dlp can't handle it (or finds a single page for a "course"),
 *     fall back to the browser crawler (scrape lesson → next lesson).
 * AuthRequiredError propagates so the UI can ask for login and retry.
 */
export async function analyzeUrl(url: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection> {
  const u = new URL(url)
  const platform = platformExtractors.find((e) => e.match(u))
  if (platform) return platform.analyze(url, mode, ctx)

  let ytErr: unknown
  try {
    const col = await ytdlpExtractor.analyze(url, mode, ctx)
    if (!(mode === 'course' && col.items.length <= 1 && ctx.sniff)) return col
    ctx.log('yt-dlp found a single video; trying the course crawler for more lessons…')
  } catch (e) {
    if (e instanceof AuthRequiredError && !ctx.loggedIn) throw e
    ytErr = e
    ctx.log(`yt-dlp could not handle the URL: ${String((e as Error)?.message ?? e).split('\n')[0]}`)
  }
  if (!ctx.sniff) throw ytErr
  try {
    return await crawlerExtractor.analyze(url, mode, ctx)
  } catch (e) {
    if (e instanceof AuthRequiredError) throw e
    if (ytErr && !unsupportedByYtdlp(String((ytErr as Error)?.message))) throw ytErr
    throw e
  }
}

export { AuthRequiredError, SkipError } from './types'
export type { Extractor, ExtractorContext } from './types'
