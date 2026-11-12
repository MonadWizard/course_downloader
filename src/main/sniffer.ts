import { BrowserWindow, type Session } from 'electron'
import { isLicenseRequestUrl } from './drm'
import type { SniffResult } from './extractors/types'

/**
 * Opens a page in a hidden, muted window that shares the site session, lets the
 * player start, and records media manifests / files requested by the page
 * (including iframes such as Vimeo/Wistia/JW players).
 */

type Media = SniffResult['media'][number]
interface Collector {
  media: Media[]
  license: string[]
}

const collectors = new Map<number, Collector>()
const hooked = new WeakSet<Session>()
const KEEP_HEADERS = ['referer', 'origin', 'user-agent', 'authorization', 'x-requested-with']

export function classifyMediaUrl(url: string, contentType = '', resourceType = ''): Media['kind'] | null {
  const path = url.split('?')[0].toLowerCase()
  const ct = contentType.toLowerCase()
  if (path.endsWith('.m3u8') || ct.includes('mpegurl')) return 'hls'
  if (path.endsWith('.mpd') || ct.includes('dash+xml')) return 'dash'
  if (/\.(ts|m4s|aac|vtt|key)$/.test(path)) return null // segments, not the stream itself
  if (/\.(mp4|webm|mov|m4v)$/.test(path) || ct.startsWith('video/') || resourceType === 'media') return 'file'
  return null
}

function hook(ses: Session): void {
  if (hooked.has(ses)) return
  hooked.add(ses)
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const col = details.webContentsId !== undefined ? collectors.get(details.webContentsId) : undefined
    if (col) {
      if (isLicenseRequestUrl(details.url) && details.method === 'POST') col.license.push(details.url)
      const kind = classifyMediaUrl(details.url, '', details.resourceType)
      if (kind && !col.media.some((m) => m.url === details.url)) {
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(details.requestHeaders)) {
          if (KEEP_HEADERS.includes(k.toLowerCase())) headers[k] = String(v)
        }
        col.media.push({ url: details.url, kind, headers })
      }
    }
    cb({ requestHeaders: details.requestHeaders })
  })
  ses.webRequest.onHeadersReceived((details, cb) => {
    const col = details.webContentsId !== undefined ? collectors.get(details.webContentsId) : undefined
    if (col) {
      const ct = String(Object.entries(details.responseHeaders ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '')
      const kind = classifyMediaUrl(details.url, ct, details.resourceType)
      if (kind && !col.media.some((m) => m.url === details.url)) col.media.push({ url: details.url, kind, headers: {} })
    }
    cb({})
  })
}

const PAGE_SCRIPT = `(() => {
  for (const v of document.querySelectorAll('video,audio')) { try { v.muted = true; v.play().catch(()=>{}) } catch {} }
  const btn = [...document.querySelectorAll('button,[role=button],.vjs-big-play-button,.plyr__control--overlaid')]
    .find(b => /play/i.test((b.getAttribute('aria-label')||'') + ' ' + (b.className||'') + ' ' + (b.textContent||'')));
  if (btn && !document.querySelector('video:not([paused])')) { try { btn.click() } catch {} }
  const links = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: (a.innerText || a.title || '').trim().slice(0, 200) }));
  let next = document.querySelector('a[rel=next], link[rel=next]');
  if (!next) next = [...document.querySelectorAll('a[href]')].find(a => /^\\s*(next( lesson| lecture| video| unit)?|continue)\\s*[›»>→]?\\s*$/i.test(a.innerText || a.getAttribute('aria-label') || ''));
  const h1 = document.querySelector('h1');
  return { title: (h1 && h1.innerText.trim()) || document.title, links, nextHref: next ? next.href : undefined };
})()`

export async function sniff(ses: Session, url: string, opts: { waitMs?: number } = {}): Promise<SniffResult> {
  hook(ses)
  const waitMs = opts.waitMs ?? 15000
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { session: ses, contextIsolation: true, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  })
  win.webContents.setAudioMuted(true)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const col: Collector = { media: [], license: [] }
  collectors.set(win.webContents.id, col)
  try {
    await win.loadURL(url).catch(() => undefined)
    const start = Date.now()
    let page: { title: string; links: SniffResult['links']; nextHref?: string } = { title: '', links: [] }
    // Poll: nudge the player, stop shortly after a manifest shows up.
    let firstMediaAt = 0
    while (Date.now() - start < waitMs) {
      page = (await win.webContents.executeJavaScript(PAGE_SCRIPT, true).catch(() => page)) ?? page
      if (col.media.length && !firstMediaAt) firstMediaAt = Date.now()
      if (firstMediaAt && Date.now() - firstMediaAt > 2500) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    const rank = { hls: 0, dash: 1, file: 2 }
    return {
      media: [...col.media].sort((a, b) => rank[a.kind] - rank[b.kind]),
      licenseRequests: col.license,
      title: page.title || win.webContents.getTitle(),
      finalUrl: win.webContents.getURL() || url,
      links: page.links,
      nextHref: page.nextHref
    }
  } finally {
    collectors.delete(win.webContents.id)
    win.destroy()
  }
}
