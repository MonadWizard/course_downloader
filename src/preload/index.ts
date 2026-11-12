import { contextBridge, ipcRenderer } from 'electron'
import type { RendererApi } from '@shared/types'

const invoke =
  (ch: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(ch, ...args)

const api: RendererApi = {
  analyze: invoke('analyze') as RendererApi['analyze'],
  enqueue: invoke('enqueue') as RendererApi['enqueue'],
  listJobs: invoke('listJobs') as RendererApi['listJobs'],
  pauseJob: invoke('pauseJob') as RendererApi['pauseJob'],
  resumeJob: invoke('resumeJob') as RendererApi['resumeJob'],
  retryJob: invoke('retryJob') as RendererApi['retryJob'],
  removeJob: invoke('removeJob') as RendererApi['removeJob'],
  clearFinished: invoke('clearFinished') as RendererApi['clearFinished'],
  retryAllFailed: invoke('retryAllFailed') as RendererApi['retryAllFailed'],
  openPath: invoke('openPath') as RendererApi['openPath'],
  getSettings: invoke('getSettings') as RendererApi['getSettings'],
  saveSettings: invoke('saveSettings') as RendererApi['saveSettings'],
  chooseOutputDir: invoke('chooseOutputDir') as RendererApi['chooseOutputDir'],
  listSites: invoke('listSites') as RendererApi['listSites'],
  login: invoke('login') as RendererApi['login'],
  confirmLogin: invoke('confirmLogin') as RendererApi['confirmLogin'],
  cancelLogin: invoke('cancelLogin') as RendererApi['cancelLogin'],
  loginMethod: invoke('loginMethod') as RendererApi['loginMethod'],
  logout: invoke('logout') as RendererApi['logout'],
  detectBrowsers: invoke('detectBrowsers') as RendererApi['detectBrowsers'],
  binaryStatus: invoke('binaryStatus') as RendererApi['binaryStatus'],
  installYtDlp: invoke('installYtDlp') as RendererApi['installYtDlp'],
  onJobsChanged: (cb) => {
    const h = (_: unknown, jobs: Parameters<typeof cb>[0]): void => cb(jobs)
    ipcRenderer.on('jobs', h)
    return () => ipcRenderer.removeListener('jobs', h)
  },
  onLog: (cb) => {
    const h = (_: unknown, line: string): void => cb(line)
    ipcRenderer.on('log', h)
    return () => ipcRenderer.removeListener('log', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
