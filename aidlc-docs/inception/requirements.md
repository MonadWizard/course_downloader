# Requirements – CourseGrab

## Functional
- FR1 Three actions on the home screen: **Download Single**, **Download Playlist**, **Download Full Course**.
- FR2 Public sites (YouTube, Vimeo, X, Facebook, TikTok, … – everything yt-dlp supports) work without login.
- FR3 Access-first flow: the app first tries the link anonymously; only if that fails (401/403, locked lesson, no media) it shows a **Login** button. Login opens an in-app browser window with a persistent per-site profile; after the user closes it, the app retries automatically.
- FR4 Full course from any one lesson URL: discover every lesson in order (modules → lessons) and download them all; user can untick items in a preview tree.
- FR5 Streaming-only content: capture HLS/DASH/MP4 streams the player uses and remux to MP4 (yt-dlp/ffmpeg).
- FR6 deeplearning.ai is the primary target (videos 1080p + subtitles, readings when logged in).
- FR7 Udemy and unknown course sites via dedicated extractor / generic crawler (scrape lesson → next lesson).
- FR8 Queue with progress, speed, ETA, pause/resume/retry, parallel downloads, resume after restart, skip finished files.
- FR9 Settings: output folder, quality cap, parallelism, subtitles, readings, yt-dlp auto-update.
- FR10 Installers usable "forever": RPM + AppImage now; yt-dlp self-updates so site support keeps working.

## Non-functional / constraints
- NFR1 Cross-platform code (Linux now; Windows, Ubuntu, Android later). Extractors are Electron-free.
- NFR2 Security: renderer sandboxed via contextIsolation/preload API; cookies stored only in userData (0600); passwords never stored.
- NFR3 **No DRM circumvention.** Widevine/FairPlay/PlayReady content is detected and skipped with a clear message.
- NFR4 Personal use of content the user has legitimate access to.
