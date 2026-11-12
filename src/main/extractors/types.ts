import type { Collection, DownloadMode, MediaItem, MediaSource } from '@shared/types'

/** Thrown when content needs a (better) login. The UI then offers a Login button. */
export class AuthRequiredError extends Error {
  constructor(
    public siteId: string,
    message = 'Login required'
  ) {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

/** Thrown for content the app intentionally does not download (DRM, labs, quizzes…). */
export class SkipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkipError'
  }
}

export interface SniffResult {
  /** Media requests seen while the page played, best guess first. */
  media: { url: string; kind: 'hls' | 'dash' | 'file'; headers: Record<string, string> }[]
  licenseRequests: string[]
  title: string
  finalUrl: string
  /** Same-site links found on the page, in document order. */
  links: { href: string; text: string }[]
  /** href of a detected "next lesson" link/button, if any. */
  nextHref?: string
}

/**
 * Everything an extractor may use. Implemented with Electron in the app and
 * with plain Node/mocks in tests – extractors must not import "electron".
 */
export interface ExtractorContext {
  siteId: string
  loggedIn: boolean
  /** fetch() that carries the site's login cookies. */
  fetch(url: string, init?: RequestInit): Promise<Response>
  /** Path to a Netscape cookies.txt for yt-dlp (exists only when logged in). */
  cookiesFile?: string
  /** Run yt-dlp with args, returning stdout. Throws with stderr on failure. */
  ytdlp(args: string[]): Promise<string>
  /** Open a page in a hidden browser with the site session and sniff media. */
  sniff?(url: string, opts?: { waitMs?: number }): Promise<SniffResult>
  log(msg: string): void
}

/** A companion file saved next to a lesson (notebook, data file…). `name` may contain "/" sub-folders. */
export interface ExtraFile {
  name: string
  data: string | Buffer
}

export interface Extractor {
  id: string
  /** Human readable platform name. */
  name: string
  /** Does this extractor own this URL? */
  match(url: URL): boolean
  /** Site key used for the login session (cookie partition). */
  siteId(url: URL): string
  loginUrl(url: URL): string
  analyze(url: string, mode: DownloadMode, ctx: ExtractorContext): Promise<Collection>
  resolve(item: MediaItem, ctx: ExtractorContext): Promise<MediaSource>
  /** Optional companion files for an item (e.g. the notebook next to a video). Failures are non-fatal. */
  extras?(item: MediaItem, ctx: ExtractorContext): Promise<ExtraFile[]>
  /** 'course': extras are shared by the whole course (saved once to "<Course>/Lab files"). */
  extrasScope?: 'course' | 'item'
  /** Sub-folder inside "<Course>/Lab files" for course-scoped extras. */
  extrasSubdir?: string
}
