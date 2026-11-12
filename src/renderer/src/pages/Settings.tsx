import { useEffect, useState } from 'react'
import type { BinaryStatus, BrowserProfile, LoginMethodInfo, Settings } from '@shared/types'

export function SettingsPage({ log }: { log: string[] }) {
  const [s, setS] = useState<Settings | null>(null)
  const [bin, setBin] = useState<BinaryStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [browsers, setBrowsers] = useState<BrowserProfile[]>([])
  const [how, setHow] = useState<LoginMethodInfo | null>(null)

  useEffect(() => {
    window.api.getSettings().then(setS)
    window.api.binaryStatus().then(setBin)
    window.api.detectBrowsers().then(setBrowsers)
    window.api.loginMethod().then(setHow)
  }, [])

  const patch = async (p: Partial<Settings>): Promise<void> => {
    setS(await window.api.saveSettings(p))
    window.api.loginMethod().then(setHow)
  }
  const defLabel = browsers.find((b) => b.id === how?.defaultBrowserId)?.label
  if (!s) return null

  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="card form">
        <label>
          Download folder
          <div className="row">
            <input value={s.outputDir} readOnly />
            <button
              className="btn small"
              onClick={async () => {
                const d = await window.api.chooseOutputDir()
                if (d) patch({ outputDir: d })
              }}
            >
              Change…
            </button>
          </div>
        </label>
        <label>
          Log in with
          <select value={s.loginBrowser} onChange={(e) => patch({ loginBrowser: e.target.value })}>
            <option value="default">System default browser{defLabel ? ` (${defLabel})` : ''}</option>
            {browsers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
            <option value="app-window">Window inside the app (email/password only)</option>
          </select>
          <span className="small">
            Login opens the site in {how?.browserId ? how.browserLabel : 'an app window'}; after you sign in there (Google works), the site’s
            session is copied into Course Downloader.
          </span>
        </label>
        <label>
          Video quality
          <select value={s.quality} onChange={(e) => patch({ quality: e.target.value as Settings['quality'] })}>
            <option value="best">Best available</option>
            <option value="1080">Up to 1080p</option>
            <option value="720">Up to 720p</option>
            <option value="480">Up to 480p</option>
            <option value="360">Up to 360p</option>
          </select>
        </label>
        <label>
          Parallel downloads
          <input type="number" min={1} max={8} value={s.concurrency} onChange={(e) => patch({ concurrency: Number(e.target.value) || 1 })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.subtitles} onChange={(e) => patch({ subtitles: e.target.checked })} /> Download subtitles
        </label>
        <label className="check">
          <input type="checkbox" checked={s.saveReadings} onChange={(e) => patch({ saveReadings: e.target.checked })} /> Save reading
          materials / articles
        </label>
        <label className="check">
          <input type="checkbox" checked={s.autoUpdateYtDlp} onChange={(e) => patch({ autoUpdateYtDlp: e.target.checked })} /> Keep yt-dlp
          up to date automatically
        </label>
      </div>

      <div className="card">
        <h2>Tools</h2>
        <div className="row between">
          <span>
            yt-dlp: {bin?.ytdlp.version ?? <b className="err">not installed</b>} <span className="muted">{bin?.ytdlp.path}</span>
          </span>
          <button
            className="btn small"
            disabled={installing}
            onClick={async () => {
              setInstalling(true)
              try {
                setBin(await window.api.installYtDlp())
              } finally {
                setInstalling(false)
              }
            }}
          >
            {installing ? 'Installing…' : bin?.ytdlp.path ? 'Reinstall / update' : 'Install yt-dlp'}
          </button>
        </div>
        <div>
          ffmpeg: {bin?.ffmpeg.version ?? <b className="err">not found – install ffmpeg (sudo dnf install ffmpeg)</b>}{' '}
          <span className="muted">{bin?.ffmpeg.path}</span>
        </div>
      </div>

      <div className="card">
        <h2>Activity log</h2>
        <pre className="log">{log.length ? log.join('\n') : 'No activity yet.'}</pre>
      </div>
    </div>
  )
}
