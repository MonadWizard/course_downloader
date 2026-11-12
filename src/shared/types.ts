// Types shared between the Electron main process and the React renderer.

export type DownloadMode = 'single' | 'playlist' | 'course'

export type ItemType = 'video' | 'reading' | 'notebook' | 'quiz' | 'other'

/** One downloadable unit of a course / playlist (a lesson, a video, a reading). */
export interface MediaItem {
  id: string
  /** 1-based position in the whole course / playlist. */
  index: number
  title: string
  type: ItemType
  /** Module / section name, if the source groups items. */
  module?: string
  /** 1-based module position. */
  moduleIndex?: number
  /** 1-based position inside its module. */
  indexInModule?: number
  durationSec?: number
  /** Page URL for the item (used by generic crawler / yt-dlp). */
  url?: string
  /** Platform reports this item needs login / a higher subscription tier. */
  locked?: boolean
  /** Opaque extractor-specific data needed to resolve the media later. */
  data?: Record<string, unknown>
}

export interface Collection {
  /** Extractor id, e.g. "deeplearningai", "ytdlp", "crawler". */
  extractor: string
  siteId: string
  siteName: string
  mode: DownloadMode
  title: string
  url: string
  items: MediaItem[]
  /** Items are locked and the user is not logged in: a login might unlock them. */
  loginSuggested?: boolean
  loggedIn?: boolean
}

export interface SubtitleTrack {
  lang: string
  url: string
  ext: string
}

export interface MediaSource {
  /** Manifest / file / page URL handed to the downloader. */
  url: string
  kind: 'hls' | 'dash' | 'file' | 'ytdlp' | 'text'
  headers?: Record<string, string>
  subtitles?: SubtitleTrack[]
  /** For kind === 'text': the content to write (reading materials). */
  text?: string
  textExt?: 'html' | 'md' | 'txt'
  durationSec?: number
}

export type JobStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'paused'
  | 'done'
  | 'skipped'
  | 'error'
  | 'login-required'

export interface Job {
  id: string
  groupId: string
  groupTitle: string
  extractor: string
  siteId: string
  item: MediaItem
  /** Output path without extension. */
  outBase: string
  status: JobStatus
  progress: number
  speed?: string
  eta?: string
  message?: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  outputDir: string
  concurrency: number
  quality: 'best' | '1080' | '720' | '480' | '360'
  subtitles: boolean
  saveReadings: boolean
  /** Include notebook / quiz placeholders? (they are skipped, just listed) */
  autoUpdateYtDlp: boolean
}

export interface SiteInfo {
  id: string
  name: string
  loginUrl: string
  loggedIn: boolean
}

export interface BinaryStatus {
  ytdlp: { path: string | null; version: string | null }
  ffmpeg: { path: string | null; version: string | null }
}

export interface AnalyzeRequest {
  url: string
  mode: DownloadMode
}

export type AnalyzeResponse =
  | { ok: true; collection: Collection }
  | { ok: false; error: string; loginRequired?: { siteId: string; siteName: string; loginUrl: string } }

export interface EnqueueRequest {
  collection: Collection
  itemIds: string[]
}

/** API exposed by the preload script on window.api */
export interface RendererApi {
  analyze(req: AnalyzeRequest): Promise<AnalyzeResponse>
  enqueue(req: EnqueueRequest): Promise<void>
  listJobs(): Promise<Job[]>
  pauseJob(id: string): Promise<void>
  resumeJob(id: string): Promise<void>
  retryJob(id: string): Promise<void>
  removeJob(id: string): Promise<void>
  clearFinished(): Promise<void>
  openPath(path: string): Promise<void>
  getSettings(): Promise<Settings>
  saveSettings(s: Partial<Settings>): Promise<Settings>
  chooseOutputDir(): Promise<string | null>
  listSites(): Promise<SiteInfo[]>
  login(siteIdOrUrl: string): Promise<SiteInfo>
  logout(siteId: string): Promise<void>
  binaryStatus(): Promise<BinaryStatus>
  installYtDlp(): Promise<BinaryStatus>
  onJobsChanged(cb: (jobs: Job[]) => void): () => void
  onLog(cb: (line: string) => void): () => void
}
