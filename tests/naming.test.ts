import { describe, expect, it } from 'vitest'
import { relativeOutBase, sanitize } from '../src/shared/naming'
import type { MediaItem } from '../src/shared/types'

const item = (p: Partial<MediaItem>): MediaItem => ({ id: '1', index: 1, title: 'T', type: 'video', ...p })

describe('naming', () => {
  it('sanitizes for all platforms', () => {
    expect(sanitize('a/b:c*d?"e<f>|g')).toBe('a b c d e f g')
    expect(sanitize('CON')).toBe('_CON')
    expect(sanitize('trailing. ')).toBe('trailing')
    expect(sanitize('')).toBe('untitled')
  })
  it('builds course / playlist / single paths', () => {
    const items = Array.from({ length: 12 }, (_, i) => item({ index: i + 1 }))
    expect(
      relativeOutBase(
        { mode: 'course', title: 'My: Course', items },
        item({ title: 'Intro', module: 'Module 1 - Basics', moduleIndex: 1, indexInModule: 3, index: 3 })
      )
    ).toBe('My Course/01 - Module 1 - Basics/03 - Intro')
    expect(relativeOutBase({ mode: 'playlist', title: 'PL', items }, item({ index: 4, title: 'Vid' }))).toBe('PL/04 - Vid')
    expect(relativeOutBase({ mode: 'single', title: 'x', items }, item({ title: 'One/Two' }))).toBe('One Two')
  })
})
