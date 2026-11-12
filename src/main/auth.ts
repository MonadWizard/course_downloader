import { app, BrowserWindow, dialog, session, shell, type Cookie, type Session } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SiteInfo } from '@shared/types'
import { load, save, type SiteRecord } from './store'
import { ytdlpPath } from './binaries'
import { defaultBrowserId, launchBrowser, readBrowserCookies } from './browserCookies'

/**
 * One persistent browser session per site ("persist:site-<id>"), so logins
 * survive restarts and sites never share cookies. The same session is used by
 * the login window, the API fetches, the sniffer and (via cookies.txt) yt-dlp.
 */

// A normal desktop Chrome UA – some login pages (e.g. Google) refuse "Electron".
export const BROWSER_UA = `Mozilla/5.0 (${
  process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64'
}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`

/** Cookies whose presence means "logged in" for known sites. */
const SESSION_COOKIES: Record<string, RegExp> = {
  deeplearningai: /next-auth\.session-token/,
  udemy: /^access_token$/
}

const sessions = new Map<string, Session>()

export function siteSession(siteId: string): Session {
  let s = sessions.get(siteId)
  if (!s) {
    s = session.fromPartition(`persist:site-${siteId.replace(/[^a-z0-9.-]/gi, '_')}`)
    s.setUserAgent(BROWSER_UA)
    sessions.set(siteId, s)
  }
  return s
}

export function ensureSite(id: string, name: string, loginUrl: string): SiteRecord {
  const db = load()
  if (!db.sites[id]) {
    db.sites[id] = { id, name, loginUrl }
    save()
  }
  return db.sites[id]
}

export async function isLoggedIn(siteId: string): Promise<boolean> {
  const cookies = await siteSession(siteId).cookies.get({})
  const re = SESSION_COOKIES[siteId]
  if (re) return cookies.some((c) => re.test(c.name))
  // Generic site: we only consider it logged in after the user used the login window.
  return Boolean(load().sites[siteId]?.loggedInAt) && cookies.length > 0
}

export async function listSites(): Promise<SiteInfo[]> {
  const sites = Object.values(load().sites)
  return Promise.all(sites.map(async (s) => ({ id: s.id, name: s.name, loginUrl: s.loginUrl, loggedIn: await isLoggedIn(s.id) })))
}

/** Open a visible browser window; resolves when the user closes it. */
export function openLoginWindow(site: SiteRecord, parent?: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1100,
      height: 820,
      parent,
      title: `Login – ${site.name} (close this window when you are logged in)`,
      autoHideMenuBar: true,
      webPreferences: { session: siteSession(site.id), contextIsolation: true, sandbox: true }
    })
    // OAuth popups (Google, LinkedIn…) open in child windows of the same session.
    win.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { session: siteSession(site.id) } }
    }))
    win.on('page-title-updated', (e) => e.preventDefault())
    // Google refuses sign-in inside embedded browsers; explain the workaround.
    let warned = false
    const onNav = (_e: unknown, url: string): void => {
      if (warned || !/accounts\.google\.com\/.*(rejected|disallowed|unsupported)/i.test(url)) return
      warned = true
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Google sign-in is blocked in apps',
        message: 'Google does not allow signing in inside apps ("This browser or app may not be secure").',
        detail: `Do this instead:\n1. Open ${site.loginUrl} in your normal browser (Firefox, Chrome, Brave…) and sign in with Google there.\n2. Close this window.\n3. Click "Use my browser login" in Course Downloader and pick that browser.\n\nAlternatively, sign in with email + password if the site offers it.`
      })
    }
    win.webContents.on('did-navigate', onNav)
    win.webContents.on('did-create-window', (child) => child.webContents.on('did-navigate', onNav))
    win.on('closed', async () => {
      const db = load()
      if (db.sites[site.id]) db.sites[site.id].loggedInAt = Date.now()
      save()
      await siteSession(site.id).cookies.flushStore()
      resolve()
    })
    win.loadURL(site.loginUrl)
  })
}

export async function logout(siteId: string): Promise<void> {
  const s = siteSession(siteId)
  await s.clearStorageData()
  const db = load()
  if (db.sites[siteId]) delete db.sites[siteId].loggedInAt
  save()
}

function netscapeLine(c: Cookie): string {
  const domain = c.domain ?? ''
  const includeSub = domain.startsWith('.') ? 'TRUE' : 'FALSE'
  const expires = c.expirationDate ? Math.floor(c.expirationDate) : 0
  return [
    c.httpOnly ? `#HttpOnly_${domain}` : domain,
    includeSub,
    c.path ?? '/',
    c.secure ? 'TRUE' : 'FALSE',
    expires,
    c.name,
    c.value
  ].join('\t')
}

/** Export the site's cookies for yt-dlp (`--cookies`). Returns undefined when empty. */
export async function exportCookies(siteId: string): Promise<string | undefined> {
  const cookies = await siteSession(siteId).cookies.get({})
  if (!cookies.length) return undefined
  const dir = join(app.getPath('userData'), 'cookies')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = join(dir, `${siteId.replace(/[^a-z0-9.-]/gi, '_')}.txt`)
  const body = ['# Netscape HTTP Cookie File', '# Generated by Course Downloader – do not share', ...cookies.map(netscapeLine), ''].join('\n')
  writeFileSync(file, body, { mode: 0o600 })
  return file
}

export async function getCookie(siteId: string, name: string): Promise<string | undefined> {
  const c = await siteSession(siteId).cookies.get({ name })
  return c[0]?.value
}

/** Cookie domain to import for a site id. */
export function siteDomain(siteId: string): string {
  const known: Record<string, string> = { deeplearningai: 'deeplearning.ai', udemy: 'udemy.com', 'youtube.com': 'youtube.com' }
  return known[siteId] ?? siteId
}

/**
 * Import the user's existing login for one site from their normal browser
 * (workaround for Google's "This browser or app may not be secure").
 * Only cookies of that site's domain are copied. Returns the number imported.
 */
export async function importBrowserLogin(siteId: string, browserId: string): Promise<number> {
  const bin = ytdlpPath()
  if (!bin) throw new Error('yt-dlp is not installed yet (Settings → Install yt-dlp)')
  const tmpRoot = join(app.getPath('userData'), 'tmp')
  mkdirSync(tmpRoot, { recursive: true, mode: 0o700 })
  const domain = siteDomain(siteId)
  const cookies = await readBrowserCookies(bin, tmpRoot, browserId, domain)
  const ses = siteSession(siteId)
  let n = 0
  for (const c of cookies) {
    const host = c.domain.replace(/^\./, '')
    const hostOnly = c.name.startsWith('__Host-') || !c.includeSubdomains
    try {
      await ses.cookies.set({
        url: `${c.secure ? 'https' : 'http'}://${host}${c.path}`,
        name: c.name,
        value: c.value,
        domain: hostOnly ? undefined : c.domain,
        path: c.path,
        secure: c.secure || c.name.startsWith('__Secure-') || c.name.startsWith('__Host-'),
        httpOnly: c.httpOnly,
        expirationDate: c.expires > 0 ? c.expires : undefined
      })
      n++
    } catch {
      /* skip cookies Chromium rejects */
    }
  }
  await ses.cookies.flushStore()
  if (n > 0) {
    const db = load()
    if (db.sites[siteId]) db.sites[siteId].loggedInAt = Date.now()
    save()
  }
  return n
}

export interface LoginOutcome {
  ok: boolean
  message: string
}

const pendingLogins = new Map<string, { finish: () => void; cancel: () => void }>()

/** User clicked "I've logged in" – import now and finish. */
export function confirmLogin(siteId: string): void {
  pendingLogins.get(siteId)?.finish()
}
export function cancelLogin(siteId: string): void {
  pendingLogins.get(siteId)?.cancel()
}

/**
 * Log in using the user's own browser: open the site's login page there, then
 * keep importing that site's cookies from the browser profile until a session
 * shows up (known sites) or until the user confirms (other sites).
 */
export async function loginWithBrowser(site: SiteRecord, browserId: string, timeoutMs = 10 * 60 * 1000): Promise<LoginOutcome> {
  pendingLogins.get(site.id)?.cancel()
  // Open in the chosen browser (system default → let the desktop handle it).
  if (browserId === (await defaultBrowserId()) || !(await launchBrowser(browserId, site.loginUrl))) {
    await shell.openExternal(site.loginUrl)
  }
  const autoDetect = Boolean(SESSION_COOKIES[site.id])

  return new Promise((resolve) => {
    let done = false
    let timer: NodeJS.Timeout | undefined
    let lastError = ''
    const end = (r: LoginOutcome): void => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      pendingLogins.delete(site.id)
      resolve(r)
    }
    const attempt = async (final: boolean): Promise<void> => {
      try {
        const n = await importBrowserLogin(site.id, browserId)
        if (done) return
        if (n > 0 && (await isLoggedIn(site.id))) return end({ ok: true, message: `Logged in to ${site.name} using your browser session.` })
        if (final) {
          end({
            ok: false,
            message: n
              ? `Found ${site.name} cookies in the browser, but no logged-in session yet. Finish logging in there (wait a few seconds), then click "I've logged in" again.`
              : `No ${site.name} cookies found in the browser yet. Log in there first, then click "I've logged in".`
          })
        }
      } catch (e) {
        lastError = String((e as Error).message ?? e)
        if (final) end({ ok: false, message: lastError })
      }
    }
    pendingLogins.set(site.id, {
      finish: () => void attempt(true),
      cancel: () => end({ ok: false, message: 'Login cancelled.' })
    })
    const deadline = Date.now() + timeoutMs
    const loop = async (): Promise<void> => {
      if (done) return
      if (autoDetect) await attempt(false)
      if (done) return
      if (Date.now() > deadline) return end({ ok: false, message: `Timed out waiting for the login.${lastError ? ` Last error: ${lastError}` : ''}` })
      timer = setTimeout(loop, 5000)
    }
    timer = setTimeout(loop, 3000)
  })
}
