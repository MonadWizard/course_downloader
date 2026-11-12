# Application design

- **Electron main** owns network, sessions, child processes and files. **Renderer** is a pure React UI talking through `window.api` (typed `RendererApi`).
- **Extractor plugin interface** (`src/main/extractors/types.ts`): `match → analyze(url, mode) → Collection(items)` and `resolve(item) → MediaSource`. Errors: `AuthRequiredError` (→ login flow), `SkipError` (→ skipped).
- **Resolution order** (`extractors/index.ts`): platform extractor → yt-dlp → browser crawler.
- **Sessions**: `persist:site-<id>` partitions; the same cookies are used by `session.fetch`, the sniffer window and yt-dlp (`--cookies` export).
- **Engine**: persistent job list, concurrency N, yt-dlp with `--progress-template` JSON progress and `--continue`; ffmpeg remux fallback.
- **Storage**: JSON (no native modules → easy cross-platform packaging).
