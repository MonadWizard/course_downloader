import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Job, Settings } from '@shared/types'

/**
 * Tiny JSON persistence in the user-data dir (~/.config/Course Downloader on Linux).
 * Writes are atomic (tmp + rename) and debounced.
 */

export interface SiteRecord {
  id: string
  name: string
  loginUrl: string
  loggedInAt?: number
}

interface Db {
  settings: Settings
  jobs: Job[]
  sites: Record<string, SiteRecord>
}

const dir = (): string => app.getPath('userData')
const file = (): string => join(dir(), 'coursegrab.json')

export function defaultSettings(): Settings {
  return {
    outputDir: join(app.getPath('videos'), 'Course Downloader'),
    concurrency: 2,
    quality: 'best',
    subtitles: true,
    saveReadings: true,
    autoUpdateYtDlp: true,
    loginBrowser: 'default'
  }
}

const builtinSites: Record<string, SiteRecord> = {
  deeplearningai: { id: 'deeplearningai', name: 'DeepLearning.AI', loginUrl: 'https://learn.deeplearning.ai/' },
  udemy: { id: 'udemy', name: 'Udemy', loginUrl: 'https://www.udemy.com/join/login-popup/' },
  'youtube.com': { id: 'youtube.com', name: 'YouTube', loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube' }
}

let db: Db | null = null
let timer: NodeJS.Timeout | null = null

export function load(): Db {
  if (db) return db
  let raw: Partial<Db> = {}
  try {
    if (existsSync(file())) raw = JSON.parse(readFileSync(file(), 'utf8'))
  } catch (e) {
    console.error('course-downloader: could not read store, starting fresh', e)
  }
  db = {
    settings: { ...defaultSettings(), ...(raw.settings ?? {}) },
    jobs: raw.jobs ?? [],
    sites: { ...builtinSites, ...(raw.sites ?? {}) }
  }
  return db
}

export function save(immediate = false): void {
  const write = (): void => {
    timer = null
    if (!db) return
    mkdirSync(dir(), { recursive: true })
    const tmp = `${file()}.tmp`
    writeFileSync(tmp, JSON.stringify(db, null, 2))
    renameSync(tmp, file())
  }
  if (immediate) {
    if (timer) clearTimeout(timer)
    write()
    return
  }
  if (!timer) timer = setTimeout(write, 500)
}
