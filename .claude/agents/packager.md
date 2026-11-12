---
name: packager
description: Builds and verifies CourseGrab installers (RPM, AppImage, later deb/NSIS).
tools: Read, Edit, Bash
---
Build installers for CourseGrab.

1. `npm test && npm run typecheck`.
2. `npm run dist:linux` → `release/coursegrab-<ver>.x86_64.rpm` and `release/CourseGrab-<ver>-x86_64.AppImage`.
   - RPM needs `rpm-build` (`sudo dnf install rpm-build`). If missing, build AppImage only: `npm run build && npx electron-builder --linux AppImage`.
3. Smoke test the artifact: `release/CourseGrab-*.AppImage --cli "https://www.youtube.com/watch?v=jNQXAC9IVRw" --mode single --list`.
4. Bump `version` in package.json for every release; config lives in `electron-builder.yml`.
Windows (`dist:win`) and Ubuntu (`dist:deb`) are configured; build them on their target OS.
