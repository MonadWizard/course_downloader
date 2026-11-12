import { describe, expect, it } from 'vitest'
import { siblingLessonLinks } from '../src/main/extractors/crawler'
import { isAuthError, infoToCollection } from '../src/main/extractors/ytdlp'

describe('crawler sibling detection', () => {
  it('finds lesson links with the same URL shape', () => {
    const cur = 'https://x.com/course/abc/lesson/2'
    const links = [
      { href: 'https://x.com/about', text: 'About' },
      { href: 'https://x.com/course/abc/lesson/1', text: 'Intro' },
      { href: 'https://x.com/course/abc/lesson/2', text: 'Setup' },
      { href: 'https://x.com/course/abc/lesson/3', text: 'Next' },
      { href: 'https://other.com/course/abc/lesson/4', text: 'ext' }
    ]
    expect(siblingLessonLinks(cur, links).map((l) => l.text)).toEqual(['Intro', 'Setup', 'Next'])
  })
})

describe('yt-dlp helpers', () => {
  it('detects auth errors', () => {
    expect(isAuthError('ERROR: Sign in to confirm you’re not a bot')).toBe(true)
    expect(isAuthError('ERROR: Unsupported URL')).toBe(false)
  })
  it('turns a flat playlist into items', () => {
    const col = infoToCollection(
      { title: 'PL', entries: [{ id: 'a', title: 'A', ie_key: 'Youtube' }, { id: 'b', title: 'B', url: 'https://y/b' }] },
      'https://y/pl',
      'playlist',
      'youtube.com',
      false
    )
    expect(col.mode).toBe('playlist')
    expect(col.items.map((i) => i.url)).toEqual(['https://www.youtube.com/watch?v=a', 'https://y/b'])
  })
})
