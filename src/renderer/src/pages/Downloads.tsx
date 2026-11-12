import type { Job } from '@shared/types'
import { LoginButton } from '../components/LoginButton'

const STATUS_LABEL: Record<Job['status'], string> = {
  queued: 'Queued',
  resolving: 'Finding media',
  downloading: 'Downloading',
  paused: 'Paused',
  done: 'Done',
  skipped: 'Skipped',
  error: 'Error',
  'login-required': 'Login required'
}

export function DownloadsPage({ jobs }: { jobs: Job[] }) {
  const groups = new Map<string, Job[]>()
  for (const j of jobs) {
    const g = groups.get(j.groupId) ?? []
    g.push(j)
    groups.set(j.groupId, g)
  }
  const loginSites = [...new Set(jobs.filter((j) => j.status === 'login-required').map((j) => j.siteId))]

  return (
    <div className="page">
      <div className="row between">
        <h1>Downloads</h1>
        <div className="row">
          <button className="btn small" onClick={() => window.api.openPath('')}>
            Open folder
          </button>
          {jobs.some((j) => ['error', 'skipped', 'login-required'].includes(j.status)) && (
            <button className="btn small" onClick={() => window.api.retryAllFailed()}>
              Retry all failed
            </button>
          )}
          <button className="btn small" onClick={() => window.api.clearFinished()}>
            Clear finished
          </button>
        </div>
      </div>

      {loginSites.map((s) => (
        <div key={s} className="banner">
          Some downloads from <b>{s}</b> need a login.
          <LoginButton siteId={s} siteName={s} label="Login & retry" className="btn small primary" />
        </div>
      ))}

      {!jobs.length && <p className="muted">Nothing here yet. Start from “New download”.</p>}

      {[...groups.values()].reverse().map((g) => {
        const done = g.filter((j) => j.status === 'done').length
        return (
          <div key={g[0].groupId} className="card">
            <div className="row between">
              <h2>{g[0].groupTitle}</h2>
              <span className="muted">
                {done}/{g.length} done
              </span>
            </div>
            {g.map((j) => (
              <div key={j.id} className={`job ${j.status}`}>
                <div className="row between">
                  <span className="ititle">
                    <span className="num">{j.item.index}</span> {j.item.title}
                  </span>
                  <span className={`status s-${j.status}`}>{STATUS_LABEL[j.status]}</span>
                </div>
                {(j.status === 'downloading' || j.progress > 0) && j.status !== 'done' && (
                  <div className="progress">
                    <div style={{ width: `${Math.round(j.progress * 100)}%` }} />
                  </div>
                )}
                <div className="row between small">
                  <span className="muted ellipsis" title={j.message}>
                    {j.status === 'downloading' ? `${Math.round(j.progress * 100)}%  ${j.speed ?? ''}  ${j.eta ? `ETA ${j.eta}` : ''}` : j.message}
                  </span>
                  <span className="row actions">
                    {['queued', 'resolving', 'downloading'].includes(j.status) && (
                      <button className="btn tiny" onClick={() => window.api.pauseJob(j.id)}>
                        Pause
                      </button>
                    )}
                    {j.status === 'paused' && (
                      <button className="btn tiny" onClick={() => window.api.resumeJob(j.id)}>
                        Resume
                      </button>
                    )}
                    {(j.status === 'error' || j.status === 'skipped') && (
                      <button className="btn tiny" onClick={() => window.api.retryJob(j.id)}>
                        Retry
                      </button>
                    )}
                    {j.status === 'login-required' && (
                      <LoginButton siteId={j.siteId} siteName={j.siteId} label="Login" className="btn tiny primary" />
                    )}
                    {j.status === 'done' && (
                      <button className="btn tiny" onClick={() => window.api.openPath(j.message ?? '')}>
                        Show
                      </button>
                    )}
                    <button className="btn tiny ghost" title="Remove from list" onClick={() => window.api.removeJob(j.id)}>
                      ✕
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
