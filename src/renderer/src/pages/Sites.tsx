import { useEffect, useState } from 'react'
import type { LoginMethodInfo, SiteInfo } from '@shared/types'
import { LoginButton } from '../components/LoginButton'

export function SitesPage() {
  const [sites, setSites] = useState<SiteInfo[]>([])
  const [custom, setCustom] = useState('')
  const [how, setHow] = useState<LoginMethodInfo | null>(null)
  const refresh = (): void => void window.api.listSites().then(setSites)
  useEffect(() => {
    refresh()
    window.api.loginMethod().then(setHow)
  }, [])

  return (
    <div className="page">
      <h1>Sites &amp; logins</h1>
      <p className="muted">
        <b>Login</b> opens the site in your own browser{how?.browserId ? ` (${how.browserLabel})` : ''}, so Google / social sign-in works.
        After you log in there, Course Downloader copies only that site’s session into its own private profile. Your password is never seen
        or stored. Change the browser in Settings.
      </p>
      <div className="card">
        {sites.map((s) => (
          <div key={s.id} className="site row between">
            <div>
              <b>{s.name}</b> <span className="muted">{s.loginUrl}</span>
            </div>
            <div className="row">
              <span className={`status ${s.loggedIn ? 's-done' : 's-queued'}`}>{s.loggedIn ? 'Logged in' : 'Not logged in'}</span>
              <LoginButton siteId={s.id} siteName={s.name} label={s.loggedIn ? 'Re-login' : 'Login'} className="btn small" onDone={refresh} />
              <button
                className="btn small ghost"
                title="Email/password login inside the app (Google sign-in is blocked there)"
                onClick={() => window.api.login(s.id, 'app-window').then(refresh)}
              >
                App window
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
          {/^https?:\/\//.test(custom) && (
            <LoginButton siteId={custom} siteName={(() => { try { return new URL(custom).hostname } catch { return 'site' } })()} label="Login" onDone={refresh} />
          )}
        </div>
      </div>
    </div>
  )
}
