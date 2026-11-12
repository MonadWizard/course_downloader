# Course Downloader

Desktop downloader for **single videos**, **playlists** and **full online courses**.
deeplearning.ai (first-class), Udemy (experimental), YouTube and 1800+ sites via yt-dlp, and a generic "scrape lesson → next lesson" crawler for other course sites.

## Install (Fedora)
```bash
sudo dnf install ffmpeg            # or ffmpeg-free
# AppImage (no install needed):
chmod +x release/Course-Downloader-0.1.0-x86_64.AppImage && ./release/Course-Downloader-0.1.0-x86_64.AppImage
# RPM (adds KDE menu entry):
sudo dnf install rpm-build && npm run dist:linux
sudo dnf install ./release/course-downloader-0.1.0.x86_64.rpm
```
yt-dlp is downloaded automatically on first start to `~/.config/Course Downloader/bin` and kept up to date.

## Use
1. Paste a link → choose **Download Single**, **Download Playlist** or **Download Full Course** (for a course, any lesson link works).
2. If the site needs a login, click **Login**, sign in in the window that opens, then **close it** – CourseGrab retries automatically.
3. Untick what you don't want in the preview tree → **Download**.

Files: `~/Videos/Course Downloader/<Course>/<MM - Module>/<NN - Lesson>.mp4` (+ `.vtt` subtitles, `.html` readings).

Headless: `course-downloader --cli <url> [--mode single|playlist|course] [--list] [--only 1,4,7] [--out DIR]`

## Notes
- DRM-protected streams (Widevine/FairPlay/PlayReady, e.g. many Udemy lectures) are detected and **skipped**; CourseGrab does not bypass DRM.
- Labs/notebooks and quizzes are listed but not downloadable.
- Download only content you have access to, for personal use.

## Develop
`npm install` · `npm run dev` · `npm test` · `npm run typecheck` · see `CLAUDE.md` and `aidlc-docs/`.
