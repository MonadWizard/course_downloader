import { useEffect, useState } from 'react'
import type { Job } from '@shared/types'
import { HomePage } from './pages/Home'
import { DownloadsPage } from './pages/Downloads'
import { SitesPage } from './pages/Sites'
import { SettingsPage } from './pages/Settings'

type Tab = 'home' | 'downloads' | 'sites' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [jobs, setJobs] = useState<Job[]>([])
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    window.api.listJobs().then(setJobs)
    const off1 = window.api.onJobsChanged(setJobs)
    const off2 = window.api.onLog((l) => setLog((prev) => [...prev.slice(-300), `${new Date().toLocaleTimeString()}  ${l}`]))
    return () => {
      off1()
      off2()
    }
  }, [])

  const active = jobs.filter((j) => ['queued', 'resolving', 'downloading'].includes(j.status)).length
  const needLogin = jobs.filter((j) => j.status === 'login-required').length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">⇣</span> Course Downloader
        </div>
        <nav>
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
            New download
          </button>
          <button className={tab === 'downloads' ? 'active' : ''} onClick={() => setTab('downloads')}>
            Downloads {active > 0 && <span className="badge">{active}</span>}
            {needLogin > 0 && <span className="badge warn">{needLogin}</span>}
          </button>
          <button className={tab === 'sites' ? 'active' : ''} onClick={() => setTab('sites')}>
            Sites &amp; logins
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            Settings
          </button>
        </nav>
        <div className="sidebar-foot">v0.1.0</div>
      </aside>
      <main className="content">
        {tab === 'home' && <HomePage onQueued={() => setTab('downloads')} />}
        {tab === 'downloads' && <DownloadsPage jobs={jobs} />}
        {tab === 'sites' && <SitesPage />}
        {tab === 'settings' && <SettingsPage log={log} />}
      </main>
    </div>
  )
}
