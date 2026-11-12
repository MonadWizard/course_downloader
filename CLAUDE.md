# CourseGrab – project guide for Claude

Cross-platform (Electron + React/TS) downloader for single videos, playlists and full online courses.
Target now: Fedora KDE (RPM + AppImage). Later: Windows (NSIS), Ubuntu (deb), Android (Capacitor reusing `src/shared` + renderer).

## Workflow: AI-DLC (AI-Driven Development Life Cycle)
Work follows the AI-DLC phases; artifacts live in `aidlc-docs/`, status in `aidlc-docs/aidlc-state.md`.
- **Inception** – requirements (`inception/requirements.md`), user stories, application design, units of work. Ask the user to approve before Construction when scope changes.
- **Construction** – one unit at a time: functional design → code → tests → build & verify. Site discovery notes go to `aidlc-docs/construction/<site>-notes.md`.
- **Operations** – packaging/installers (`electron-builder.yml`), release notes.
At each phase boundary, summarise what was done and wait for user approval. Keep `aidlc-state.md` current (`/aidlc-status`).
Official AI-DLC tooling can be added with `aidlc config --harness claude` once the `aidlc` CLI is installed (see README).

## graphify (token-efficient code navigation)
- If `graphify-out/graph.json` exists, run `graphify query "<question>"` before the first grep/read for a codebase question, and include this rule in every subagent prompt that explores code. Use `graphify path "<A>" "<B>"` and `graphify explain "<concept>"`.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- After modifying code run `graphify update .` (a PostToolUse hook in `.claude/settings.json` does this automatically).

## Architecture
```
src/shared/      types.ts (IPC + domain types), naming.ts (cross-platform file names)
src/main/        Electron main process
  index.ts       window, IPC handlers, --cli entry
  cli.ts         headless mode: coursegrab --cli <url> [--mode single|playlist|course] [--list] [--only 1,2]
  extractors/    site plugins (NO electron imports) – deeplearningai, udemy, ytdlp (generic), crawler (scrape → next)
  context.ts     builds ExtractorContext (session fetch, cookies.txt, yt-dlp runner, sniffer)
  auth.ts        per-site persistent sessions "persist:site-<id>", login window, cookie export
  sniffer.ts     hidden window that records m3u8/mpd/mp4 requests + DRM licence calls
  drm.ts         DRM detection (skip only – never circumvent)
  engine.ts      job queue → yt-dlp (preferred) / ffmpeg fallback, progress, pause/resume, resume-after-restart
  binaries.ts    yt-dlp in ~/.config/CourseGrab/bin (auto-install/-U), ffmpeg from PATH
  store.ts       JSON store (settings, jobs, sites) in userData
src/preload/     contextBridge `window.api` (RendererApi)
src/renderer/    React UI: Home (3 buttons + login prompt + course tree), Downloads, Sites, Settings
```
Access flow: try anonymously → `AuthRequiredError` → UI shows **Login** → user logs in in an in-app window → automatic retry.

## Rules
- Never implement DRM decryption/key extraction. DRM content → `SkipError('DRM-protected…')`.
- Extractors must stay Electron-free (Android reuse); use `ctx.*`.
- Escape `%` in yt-dlp output templates. Sanitize names with `shared/naming.ts`.
- Renderer has no Node access; add new capabilities via IPC + `RendererApi` type.

## Commands
- `npm run dev` – app with hot reload · `npm test` · `npm run typecheck` · `npm run build`
- `npx electron . --cli "<url>" --list` – quick extractor check
- `npm run dist:linux` – RPM + AppImage into `release/` (RPM needs `rpm-build`)
- Slash commands: `/new-extractor <url>`, `/build-installer`, `/aidlc-status`
