import { describe, expect, it } from 'vitest'
import { cookieMatchesDomain, parseNetscape } from '../src/main/browserCookies'

const jar = [
  '# Netscape HTTP Cookie File',
  '#HttpOnly_.learn.deeplearning.ai\tTRUE\t/\tTRUE\t1893456000\t__Secure-next-auth.session-token\tabc\tdef',
  'learn.deeplearning.ai\tFALSE\t/\tTRUE\t0\t__Host-next-auth.csrf-token\txyz',
  '.google.com\tTRUE\t/\tTRUE\t1893456000\tSID\tsecret',
  '.evil-deeplearning.ai\tTRUE\t/\tFALSE\t0\tx\ty',
  ''
].join('\n')

describe('browser cookie import', () => {
  it('parses Netscape cookie files incl. HttpOnly prefix and tabs in values', () => {
    const c = parseNetscape(jar)
    expect(c).toHaveLength(4)
    expect(c[0]).toMatchObject({ domain: '.learn.deeplearning.ai', httpOnly: true, secure: true, name: '__Secure-next-auth.session-token', value: 'abc\tdef' })
    expect(c[1]).toMatchObject({ includeSubdomains: false, expires: 0, httpOnly: false })
  })
  it('keeps only cookies of the target site (no google.com, no look-alike domains)', () => {
    const kept = parseNetscape(jar).filter((c) => cookieMatchesDomain(c.domain, 'deeplearning.ai'))
    expect(kept.map((c) => c.name)).toEqual(['__Secure-next-auth.session-token', '__Host-next-auth.csrf-token'])
  })
})

import { browserIdFromDesktop } from '../src/main/browserCookies'

describe('default browser mapping', () => {
  it('maps desktop files to browser ids', () => {
    expect(browserIdFromDesktop('brave-browser.desktop')).toBe('brave')
    expect(browserIdFromDesktop('com.brave.Browser.desktop')).toBe('brave-flatpak')
    expect(browserIdFromDesktop('org.mozilla.firefox.desktop')).toBe('firefox-flatpak')
    expect(browserIdFromDesktop('firefox.desktop')).toBe('firefox')
    expect(browserIdFromDesktop('com.google.Chrome.desktop')).toBe('chrome-flatpak')
    expect(browserIdFromDesktop('google-chrome.desktop')).toBe('chrome')
    expect(browserIdFromDesktop('org.chromium.Chromium.desktop')).toBe('chromium-flatpak')
    expect(browserIdFromDesktop('konqueror.desktop')).toBeNull()
  })
})
