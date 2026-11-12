import { useEffect, useState } from 'react'
import type { SiteInfo } from '@shared/types'

export function SitesPage() {
  const [sites, setSites] = useState<SiteInfo[]>([])
  const [custom, setCustom] = useState('')
  const refresh = (): void => void window.api.listSites().then(setSites)
  useEffect(refresh, [])

  async function login(idOrUrl: string): Promise<void> {
    await window.api.login(idOrUrl)
    refresh()
  }

  return (
    <div className="page">
      <h1>Sites &amp; logins</h1>
      <p className="muted">
        Each site gets its own private browser profile stored on this computer. Logins persist until you log out. Your password is never
        stored by Course Downloader – only the site’s session cookies.
      </p>
      <div className="card">
        {sites.map((s) => (
          <div key={s.id} className="row between site">
            <div>
              <b>{s.name}</b> <span className="muted">{s.loginUrl}</span>
            </div>
            <div className="row">
              <span className={`status ${s.loggedIn ? 's-done' : 's-queued'}`}>{s.loggedIn ? 'Logged in' : 'Not logged in'}</span>
              <button className="btn small" onClick={() => login(s.id)}>
                {s.loggedIn ? 'Open / re-login' : 'Login'}
              </button>
              {s.loggedIn && (
                <button className="btn small ghost" onClick={() => window.api.logout(s.id).then(refresh)}>
                  Logout
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Log in to another site</h2>
        <div className="urlbar">
          <input placeholder="https://www.example-course-site.com/login" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn primary" disabled={!custom} onClick={() => login(custom)}>
            Login
          </button>
        </div>
      </div>
    </div>
  )
}
