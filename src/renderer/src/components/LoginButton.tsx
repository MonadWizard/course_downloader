import { useState } from 'react'
import type { LoginMethodInfo, LoginResult } from '@shared/types'

/**
 * Login via the user's own browser: opens the site there, then waits until
 * Course Downloader sees the session (auto-detected for known sites, or when the
 * user clicks "I've logged in").
 */
export function LoginButton({
  siteId,
  siteName,
  label,
  className = 'btn primary',
  onDone
}: {
  siteId: string
  siteName: string
  label?: string
  className?: string
  onDone?: (r: LoginResult) => void
}) {
  const [waiting, setWaiting] = useState<LoginMethodInfo | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function start(): Promise<void> {
    setMsg(null)
    const how = await window.api.loginMethod()
    setWaiting(how)
    try {
      const r = await window.api.login(siteId)
      setMsg({ ok: r.ok, text: r.message })
      if (r.ok) onDone?.(r)
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally {
      setWaiting(null)
      setConfirming(false)
    }
  }

  if (waiting) {
    return (
      <div className="login-wait">
        <div>
          <span className="spinner" />
          {waiting.browserId ? (
            <>
              Opened <b>{siteName}</b> in <b>{waiting.browserLabel}</b>. Log in there (Google sign-in is fine). Course Downloader picks up the
              session automatically – browsers save new logins to disk within ~30 seconds.
            </>
          ) : (
            <>Log in in the window that opened, then close it.</>
          )}
        </div>
        {waiting.browserId && (
          <div className="row">
            <button
              className="btn small primary"
              disabled={confirming}
              onClick={() => {
                setConfirming(true)
                window.api.confirmLogin(siteId)
              }}
            >
              {confirming ? 'Checking…' : "I've logged in"}
            </button>
            <button className="btn small ghost" onClick={() => window.api.cancelLogin(siteId)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <span className="login-btn">
      <button className={className} onClick={start}>
        {label ?? `Login to ${siteName}`}
      </button>
      {msg && <span className={`small ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</span>}
    </span>
  )
}
