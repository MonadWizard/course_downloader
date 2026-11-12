import { useMemo, useState } from 'react'
import type { AnalyzeResponse, Collection, DownloadMode, MediaItem } from '@shared/types'

const TYPE_ICON: Record<MediaItem['type'], string> = { video: '▶', reading: '📄', notebook: '🧪', quiz: '❓', other: '•' }
const MODE_LABEL: Record<DownloadMode, string> = { single: 'single video', playlist: 'playlist', course: 'full course' }

function dur(s?: number): string {
  if (!s) return ''
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function defaultSelected(col: Collection): Set<string> {
  return new Set(col.items.filter((i) => (i.type === 'video' || i.type === 'reading') && !(i.locked && !col.loggedIn)).map((i) => i.id))
}

export function HomePage({ onQueued }: { onQueued: () => void }) {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<DownloadMode>('course')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function analyze(m: DownloadMode): Promise<void> {
    if (!url.trim()) return
    setMode(m)
    setBusy(true)
    setResult(null)
    try {
      const r = await window.api.analyze({ url: url.trim(), mode: m })
      setResult(r)
      if (r.ok) setSelected(defaultSelected(r.collection))
    } finally {
      setBusy(false)
    }
  }

  async function loginAndRetry(siteId: string): Promise<void> {
    await window.api.login(siteId)
    await analyze(mode)
  }

  async function download(): Promise<void> {
    if (!result?.ok) return
    await window.api.enqueue({ collection: result.collection, itemIds: [...selected] })
    onQueued()
  }

  const col = result?.ok ? result.collection : null
  const groups = useMemo(() => {
    const g: { name: string; items: MediaItem[] }[] = []
    for (const it of col?.items ?? []) {
      const name = it.module ?? ''
      let last = g[g.length - 1]
      if (!last || last.name !== name) g.push((last = { name, items: [] }))
      last.items.push(it)
    }
    return g
  }, [col])

  const toggle = (id: string): void =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const setMany = (ids: string[], on: boolean): void =>
    setSelected((s) => {
      const n = new Set(s)
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)))
      return n
    })

  const lockedCount = col?.items.filter((i) => i.locked).length ?? 0

  return (
    <div className="page">
      <h1>New download</h1>
      <p className="muted">
        Paste a video, playlist, or any lesson link of a course. Course Downloader first tries without login and only asks you to log in when the
        site requires it.
      </p>
      <div className="urlbar">
        <input
          autoFocus
          placeholder="https://learn.deeplearning.ai/courses/…/lesson/…   or   https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze(mode)}
        />
      </div>
      <div className="modes">
        <button className="btn" disabled={busy} onClick={() => analyze('single')}>
          ▶ Download Single
        </button>
        <button className="btn" disabled={busy} onClick={() => analyze('playlist')}>
          ☰ Download Playlist
        </button>
        <button className="btn primary" disabled={busy} onClick={() => analyze('course')}>
          🎓 Download Full Course
        </button>
      </div>

      {busy && (
        <div className="card">
          <div className="spinner" /> Analyzing {MODE_LABEL[mode]}… (scraping a course page by page can take a minute)
        </div>
      )}

      {result && !result.ok && (
        <div className={`card ${result.loginRequired ? 'warn' : 'error'}`}>
          <div className="pre">{result.error}</div>
          {result.loginRequired && (
            <div className="row">
              <span>
                This content needs you to be logged in to <b>{result.loginRequired.siteName}</b>. A browser window will open – log in, then{' '}
                <b>close that window</b> and Course Downloader will retry automatically.
              </span>
              <button className="btn primary" onClick={() => loginAndRetry(result.loginRequired!.siteId)}>
                Login to {result.loginRequired.siteName}
              </button>
            </div>
          )}
        </div>
      )}

      {col && (
        <div className="card">
          <div className="row between">
            <div>
              <h2>{col.title}</h2>
              <div className="muted">
                {col.siteName} · {col.items.length} items · {col.items.filter((i) => i.type === 'video').length} videos ·{' '}
                {col.loggedIn ? 'logged in' : 'not logged in'}
              </div>
            </div>
            <button className="btn primary" disabled={!selected.size} onClick={download}>
              Download {selected.size} item{selected.size === 1 ? '' : 's'}
            </button>
          </div>

          {col.loginSuggested && (
            <div className="banner">
              {lockedCount} item(s) are locked for anonymous users.
              <button className="btn small" onClick={() => loginAndRetry(col.siteId)}>
                Login to unlock
              </button>
            </div>
          )}

          <div className="row tools">
            <button className="btn small" onClick={() => setSelected(new Set(col.items.map((i) => i.id)))}>
              Select all
            </button>
            <button className="btn small" onClick={() => setSelected(new Set(col.items.filter((i) => i.type === 'video').map((i) => i.id)))}>
              Videos only
            </button>
            <button className="btn small" onClick={() => setSelected(new Set())}>
              None
            </button>
          </div>

          <div className="tree">
            {groups.map((g, gi) => (
              <div key={gi} className="group">
                {g.name && (
                  <label className="group-title">
                    <input
                      type="checkbox"
                      checked={g.items.every((i) => selected.has(i.id))}
                      onChange={(e) => setMany(g.items.map((i) => i.id), e.target.checked)}
                    />
                    {g.name}
                  </label>
                )}
                {g.items.map((it) => (
                  <label key={it.id} className={`item ${it.locked ? 'locked' : ''}`}>
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                    <span className="num">{it.index}</span>
                    <span className="ticon">{TYPE_ICON[it.type]}</span>
                    <span className="ititle">{it.title}</span>
                    {it.locked && <span className="pill">locked</span>}
                    {(it.type === 'notebook' || it.type === 'quiz') && <span className="pill dim">not downloadable</span>}
                    <span className="dur">{dur(it.durationSec)}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
