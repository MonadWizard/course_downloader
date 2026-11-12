import type { Collection, MediaItem } from './types'

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/** Make a string safe as a single path segment on Linux, Windows and Android. */
export function sanitize(name: string, maxLen = 120): string {
  let s = (name ?? '').replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(/[. ]+$/, '') // Windows: no trailing dot/space
  if (RESERVED.test(s)) s = `_${s}`
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s || 'untitled'
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/**
 * Relative output path (without extension) for an item, using "/" separators.
 *  course:   <Course>/<MM - Module>/<NN - Title>
 *  playlist: <Playlist>/<NN - Title>
 *  single:   <Title>
 */
export function relativeOutBase(col: Pick<Collection, 'mode' | 'title' | 'items'>, item: MediaItem): string {
  const width = Math.max(2, String(col.items.length).length)
  if (col.mode === 'single') return sanitize(item.title)
  const root = sanitize(col.title)
  if (col.mode === 'playlist' || !item.module) {
    return `${root}/${pad(item.index, width)} - ${sanitize(item.title)}`
  }
  const mod = `${pad(item.moduleIndex ?? 1)} - ${sanitize(item.module)}`
  const pos = item.indexInModule ?? item.index
  return `${root}/${mod}/${pad(pos)} - ${sanitize(item.title)}`
}
