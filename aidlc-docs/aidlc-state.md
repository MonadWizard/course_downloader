# AI-DLC state – CourseGrab

| Phase | Stage | Status |
|---|---|---|
| Inception | Requirements | ✅ approved 2026-11-13 |
| Inception | User stories | ✅ |
| Inception | Application design | ✅ |
| Inception | Units of work | ✅ |
| Construction | U1 Scaffold + .claude + docs | ✅ |
| Construction | U2 Electron shell, IPC, store, binaries | ✅ |
| Construction | U3 yt-dlp engine + queue (Single/Playlist) | ✅ verified (YouTube video + playlist) |
| Construction | U4 deeplearning.ai extractor + course preview | ✅ verified (52 items listed, 1080p lesson + VTT downloaded) |
| Construction | U5 Login window + cookie export + login→retry | ✅ built; needs user's real login to verify locked items/readings |
| Construction | U6 Sniffer + generic crawler + DRM detection | ✅ built, unit-tested; needs live test on a non-yt-dlp site |
| Construction | U7 Udemy extractor | 🟡 experimental – verify with a purchased course |
| Operations | U8 Packaging | ✅ AppImage built & smoke-tested · ⏳ RPM needs `rpm-build` |
| Future | Windows NSIS, Ubuntu deb, Android (Capacitor) | ⏳ configured / planned |

Next step: log in to deeplearning.ai in the app and download a full course; then `sudo dnf install rpm-build && npm run dist:linux`.
