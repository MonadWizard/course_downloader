import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AnalyzeRequest, AnalyzeResponse, EnqueueRequest, Settings } from '@shared/types'
import { ensureSite, isLoggedIn, listSites, logout, openLoginWindow } from './auth'
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
  ipcMain.handle('login', async (_e, siteIdOrUrl: string) => {
    let rec = load().sites[siteIdOrUrl]
    if (!rec) {
      const s = siteFor(new URL(siteIdOrUrl))
      rec = ensureSite(s.id, s.name, s.loginUrl)
    }
    await openLoginWindow(rec, win ?? undefined)
    engine.retryLoginRequired(rec.id)
    return { id: rec.id, name: rec.name, loginUrl: rec.loginUrl, loggedIn: await isLoggedIn(rec.id) }
  })
  ipcMain.handle('logout', (_e, siteId: string) => logout(siteId))

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
