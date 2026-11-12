import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AnalyzeRequest, AnalyzeResponse, EnqueueRequest, Settings } from '@shared/types'
import { cancelLogin, confirmLogin, ensureSite, isLoggedIn, listSites, loginWithBrowser, logout, openLoginWindow } from './auth'
import { defaultBrowserId, detectBrowsers } from './browserCookies'
import type { LoginMethodInfo, LoginResult } from '@shared/types'
import { ensureYtDlp, installYtDlp, status as binaryStatus } from './binaries'
import { makeContext } from './context'
import { Engine } from './engine'
import { analyzeUrl, AuthRequiredError, primaryExtractor } from './extractors'
import { ytdlpExtractor } from './extractors/ytdlp'
import { load, save } from './store'
import { cliArgs, runCli } from './cli'

app.setName('Course Downloader')
let win: BrowserWindow | null = null

function log(line: string): void {
  console.log(`[course-downloader] ${line}`)
  win?.webContents.send('log', line)
}

let engine: Engine

function siteFor(url: URL): { id: string; name: string; loginUrl: string } {
  const ext = primaryExtractor(url)
  const id = ext.siteId(url)
  return { id, name: ext === ytdlpExtractor ? url.hostname.replace(/^www\./, '') : ext.name, loginUrl: ext.loginUrl(url) }
}

function siteRecord(siteIdOrUrl: string) {
  const known = load().sites[siteIdOrUrl]
  if (known) return known
  const s = siteFor(new URL(siteIdOrUrl))
  return ensureSite(s.id, s.name, s.loginUrl)
}

async function loginMethod(): Promise<LoginMethodInfo> {
  const pref = load().settings.loginBrowser || 'default'
  const browsers = detectBrowsers()
  const def = await defaultBrowserId()
  const label = (id: string | null): string => browsers.find((b) => b.id === id)?.label ?? id ?? 'app window'
  if (pref === 'app-window') return { browserId: null, browserLabel: 'app window', defaultBrowserId: def }
  const id = pref === 'default' ? def : pref
  if (id && browsers.some((b) => b.id === id)) return { browserId: id, browserLabel: label(id), defaultBrowserId: def }
  // Unknown/unsupported default browser: fall back to the first installed one.
  const first = browsers[0]?.id ?? null
  return { browserId: first, browserLabel: label(first), defaultBrowserId: def }
}

function createWindow(): void {
  const icon = join(__dirname, '../../build/icon.png')
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    title: 'Course Downloader',
    backgroundColor: '#0f1115',
    icon: existsSync(icon) ? icon : undefined,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.on('closed', () => (win = null))
}

function registerIpc(): void {
  ipcMain.handle('analyze', async (_e, req: AnalyzeRequest): Promise<AnalyzeResponse> => {
    let u: URL
    try {
      u = new URL(req.url.trim())
    } catch {
      return { ok: false, error: 'That does not look like a valid URL.' }
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'Only http(s) links are supported.' }
    const site = siteFor(u)
    ensureSite(site.id, site.name, site.loginUrl)
    try {
      const ctx = await makeContext(site.id, log)
      const collection = await analyzeUrl(u.href, req.mode, ctx)
      return { ok: true, collection }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      log(`analyze failed: ${msg}`)
      if (e instanceof AuthRequiredError) {
        return {
          ok: false,
          error: (await isLoggedIn(site.id)) ? `${msg} (you are logged in – maybe not enrolled / wrong plan?)` : msg,
          loginRequired: { siteId: site.id, siteName: site.name, loginUrl: site.loginUrl }
        }
      }
      return { ok: false, error: msg.split('\n').slice(-3).join('\n') }
    }
  })

  ipcMain.handle('enqueue', (_e, req: EnqueueRequest) => engine.enqueue(req.collection, req.itemIds))
  ipcMain.handle('listJobs', () => engine.jobs)
  ipcMain.handle('pauseJob', (_e, id: string) => engine.pause(id))
  ipcMain.handle('resumeJob', (_e, id: string) => engine.resume(id))
  ipcMain.handle('retryJob', (_e, id: string) => engine.resume(id))
  ipcMain.handle('removeJob', (_e, id: string) => engine.remove(id))
  ipcMain.handle('clearFinished', () => engine.clearFinished())
  ipcMain.handle('openPath', async (_e, p: string) => {
    if (existsSync(p)) shell.showItemInFolder(p)
    else await shell.openPath(load().settings.outputDir)
  })

  ipcMain.handle('getSettings', () => load().settings)
  ipcMain.handle('saveSettings', (_e, patch: Partial<Settings>) => {
    const db = load()
    db.settings = { ...db.settings, ...patch }
    save(true)
    engine.pump()
    return db.settings
  })
  ipcMain.handle('chooseOutputDir', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], defaultPath: load().settings.outputDir })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('listSites', () => listSites())
  ipcMain.handle('loginMethod', () => loginMethod())
  ipcMain.handle('login', async (_e, siteIdOrUrl: string, method: 'auto' | 'app-window' = 'auto'): Promise<LoginResult> => {
    const rec = siteRecord(siteIdOrUrl)
    const how = method === 'app-window' ? { browserId: null, browserLabel: 'app window' } : await loginMethod()
    let outcome: { ok: boolean; message: string }
    if (how.browserId) {
      log(`Opening ${rec.loginUrl} in ${how.browserLabel} – waiting for the login session…`)
      outcome = await loginWithBrowser(rec, how.browserId)
    } else {
      await openLoginWindow(rec, win ?? undefined)
      outcome = (await isLoggedIn(rec.id)) ? { ok: true, message: 'Logged in.' } : { ok: false, message: 'Login window closed.' }
    }
    log(`${rec.name}: ${outcome.message}`)
    const loggedIn = await isLoggedIn(rec.id)
    if (outcome.ok || loggedIn) engine.retryLoginRequired(rec.id)
    return { ...outcome, ok: outcome.ok || loggedIn, site: { id: rec.id, name: rec.name, loginUrl: rec.loginUrl, loggedIn } }
  })
  ipcMain.handle('confirmLogin', (_e, siteId: string) => confirmLogin(siteRecord(siteId).id))
  ipcMain.handle('cancelLogin', (_e, siteId: string) => cancelLogin(siteRecord(siteId).id))
  ipcMain.handle('logout', (_e, siteId: string) => logout(siteId))
  ipcMain.handle('detectBrowsers', () => detectBrowsers())

  ipcMain.handle('binaryStatus', () => binaryStatus())
  ipcMain.handle('installYtDlp', async () => {
    await installYtDlp(log)
    return binaryStatus()
  })
}

const cli = cliArgs(process.argv)

if (cli) {
  app.whenReady().then(async () => {
    const code = await runCli(cli).catch((e) => {
      console.error(e)
      return 1
    })
    app.exit(code)
  })
  app.on('window-all-closed', () => undefined)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    engine = new Engine((jobs) => win?.webContents.send('jobs', jobs), log)
    registerIpc()
    createWindow()
    ensureYtDlp(load().settings.autoUpdateYtDlp, log)
      .catch((e) => log(`yt-dlp setup failed: ${(e as Error).message}`))
      .finally(() => engine.pump())
  })

  app.on('before-quit', () => engine.stopAll())
  app.on('window-all-closed', () => app.quit())
}
