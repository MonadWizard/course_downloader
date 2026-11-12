# Graph Report - course_downloader  (2026-11-13)

## Corpus Check
- 57 files · ~19,147 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 432 nodes · 936 edges · 28 communities (17 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `477ad387`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- extractors/index.ts
- package.json
- electron-builder.yml
- binaries.ts
- shared/types.ts
- engine.ts
- RendererApi
- engine.ts
- deeplearningai.ts
- compilerOptions
- compilerOptions
- CourseGrab
- Requirements – CourseGrab
- tsconfig.json
- aidlc-state.md
- deeplearningai-notes.md
- units-of-work.md
- user-stories.md
- udemy.ts
- browserCookies.ts
- sniffer.ts
- Extractor
- MediaItem

## God Nodes (most connected - your core abstractions)
1. `RendererApi` - 30 edges
2. `load()` - 28 edges
3. `Engine` - 24 edges
4. `registerIpc()` - 21 edges
5. `ExtractorContext` - 17 edges
6. `Job` - 17 edges
7. `AuthRequiredError` - 15 edges
8. `save()` - 15 edges
9. `makeContext()` - 14 edges
10. `Extractor` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `AuthRequiredError`  [INFERRED]
  CLAUDE.md → src/main/extractors/types.ts
- `Application design` --references--> `RendererApi`  [INFERRED]
  aidlc-docs/inception/application-design.md → src/shared/types.ts
- `Rules` --references--> `RendererApi`  [INFERRED]
  CLAUDE.md → src/shared/types.ts
- `Application design` --references--> `AuthRequiredError`  [INFERRED]
  aidlc-docs/inception/application-design.md → src/main/extractors/types.ts
- `Application design` --references--> `SkipError`  [INFERRED]
  aidlc-docs/inception/application-design.md → src/main/extractors/types.ts

## Import Cycles
- None detected.

## Communities (28 total, 11 thin omitted)

### Community 0 - "extractors/index.ts"
Cohesion: 0.18
Nodes (14): crawlerExtractor, segs(), siblingLessonLinks(), allExtractors, platformExtractors, unsupportedByYtdlp(), ExtraFile, SniffResult (+6 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (43): shared, author, description, desktopName, devDependencies, electron@^45.3.1, electron-builder@^26.18.0, electron-vite@^6.0.0 (+35 more)

### Community 2 - "electron-builder.yml"
Cohesion: 0.05
Nodes (41): appId, appImage, artifactName, asar, copyright, deb, depends, entry (+33 more)

### Community 3 - "binaries.ts"
Cohesion: 0.19
Nodes (15): dir, file, bundledBinDir(), ensureYtDlp(), exe(), ffmpegPath(), find(), installYtDlp() (+7 more)

### Community 4 - "shared/types.ts"
Cohesion: 0.13
Nodes (24): react, App(), Tab, LoginButton(), DownloadsPage(), STATUS_LABEL, defaultSelected(), dur() (+16 more)

### Community 5 - "engine.ts"
Cohesion: 0.11
Nodes (43): electron, cancelLogin(), confirmLogin(), ensureSite(), exportCookies(), getCookie(), importBrowserLogin(), isLoggedIn() (+35 more)

### Community 6 - "RendererApi"
Cohesion: 0.06
Nodes (9): Architecture, Commands, CourseGrab – project guide for Claude, graphify (token-efficient code navigation), Rules, Workflow: AI-DLC (AI-Driven Development Life Cycle), api, Window (+1 more)

### Community 7 - "engine.ts"
Cohesion: 0.11
Nodes (17): BROWSER_UA, Logger, assertHttpUrl(), Engine, findOutput(), fmtBytes(), fmtEta(), formatSelector() (+9 more)

### Community 8 - "deeplearningai.ts"
Cohesion: 0.19
Nodes (14): courseToItems(), deeplearningai, DlaiCourse, DlaiLesson, fetchNotebookFiles(), freshItemData(), jupyterFiles(), mapType() (+6 more)

### Community 9 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, esModuleInterop, module, moduleResolution, paths, resolveJsonModule, skipLibCheck (+5 more)

### Community 10 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, baseUrl, jsx, lib, module, moduleResolution, paths, skipLibCheck (+5 more)

### Community 11 - "CourseGrab"
Cohesion: 0.33
Nodes (5): Course Downloader, Develop, Install (Fedora), Notes, Use

### Community 12 - "Requirements – CourseGrab"
Cohesion: 0.50
Nodes (3): Functional, Non-functional / constraints, Requirements – CourseGrab

### Community 23 - "udemy.ts"
Cohesion: 0.16
Nodes (9): Application design, readingToSource(), trpc(), AuthRequiredError, SkipError, api(), assetToSource(), udemy (+1 more)

### Community 24 - "browserCookies.ts"
Cohesion: 0.16
Nodes (14): browserIdFromDesktop(), browserSpec(), Candidate, candidates(), cookieMatchesDomain(), exec(), H, LAUNCH (+6 more)

### Community 25 - "sniffer.ts"
Cohesion: 0.18
Nodes (13): detectDashDrm(), detectDrm(), detectHlsDrm(), DRM_KEYFORMATS, DrmCheck, isLicenseRequestUrl(), classifyMediaUrl(), Collector (+5 more)

### Community 27 - "MediaItem"
Cohesion: 0.43
Nodes (3): pad(), relativeOutBase(), MediaItem

## Knowledge Gaps
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RendererApi` connect `RendererApi` to `shared/types.ts`, `udemy.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `RendererApi` (e.g. with `Application design` and `Rules`) actually correct?**
  _`RendererApi` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `engine.ts` to `package.json`, `binaries.ts`, `sniffer.ts`, `RendererApi`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `electron-builder.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `package.json` to `extractors/index.ts`, `binaries.ts`, `deeplearningai.ts`, `browserCookies.ts`, `sniffer.ts`, `MediaItem`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1265597147950089 - nodes in this community are weakly interconnected._