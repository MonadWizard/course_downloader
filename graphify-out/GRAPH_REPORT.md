# Graph Report - course_downloader  (2026-11-13)

## Corpus Check
- 57 files · ~17,494 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 419 nodes · 888 edges · 24 communities (14 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3aed3e5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- extractors/index.ts
- package.json
- electron-builder.yml
- main/index.ts
- shared/types.ts
- engine.ts
- RendererApi
- engine.ts
- sniffer.ts
- compilerOptions
- compilerOptions
- CourseGrab
- Requirements – CourseGrab
- tsconfig.json
- aidlc-state.md
- deeplearningai-notes.md
- units-of-work.md
- user-stories.md
- browserCookies.ts

## God Nodes (most connected - your core abstractions)
1. `RendererApi` - 29 edges
2. `load()` - 27 edges
3. `registerIpc()` - 21 edges
4. `Engine` - 21 edges
5. `ExtractorContext` - 16 edges
6. `Job` - 15 edges
7. `save()` - 15 edges
8. `AuthRequiredError` - 14 edges
9. `makeContext()` - 14 edges
10. `runCli()` - 13 edges

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

## Communities (24 total, 10 thin omitted)

### Community 0 - "extractors/index.ts"
Cohesion: 0.06
Nodes (40): Application design, crawlerExtractor, segs(), siblingLessonLinks(), sniffOrThrow(), courseToItems(), deeplearningai, DlaiCourse (+32 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (44): shared, author, description, desktopName, devDependencies, electron@^45.3.1, electron-builder@^26.18.0, electron-vite@^6.0.0 (+36 more)

### Community 2 - "electron-builder.yml"
Cohesion: 0.05
Nodes (41): appId, appImage, artifactName, asar, copyright, deb, depends, entry (+33 more)

### Community 3 - "main/index.ts"
Cohesion: 0.14
Nodes (29): exportCookies(), getCookie(), importBrowserLogin(), isLoggedIn(), LoginOutcome, loginWithBrowser(), netscapeLine(), pendingLogins (+21 more)

### Community 4 - "shared/types.ts"
Cohesion: 0.14
Nodes (22): react, App(), Tab, LoginButton(), DownloadsPage(), STATUS_LABEL, defaultSelected(), dur() (+14 more)

### Community 5 - "engine.ts"
Cohesion: 0.11
Nodes (29): cancelLogin(), confirmLogin(), ensureSite(), listSites(), logout(), openLoginWindow(), detectBrowsers(), cliArgs() (+21 more)

### Community 6 - "RendererApi"
Cohesion: 0.06
Nodes (9): Architecture, Commands, CourseGrab – project guide for Claude, graphify (token-efficient code navigation), Rules, Workflow: AI-DLC (AI-Driven Development Life Cycle), api, Window (+1 more)

### Community 7 - "engine.ts"
Cohesion: 0.13
Nodes (13): BROWSER_UA, Logger, assertHttpUrl(), findOutput(), fmtBytes(), fmtEta(), formatSelector(), MEDIA_EXT (+5 more)

### Community 8 - "sniffer.ts"
Cohesion: 0.29
Nodes (8): detectDashDrm(), detectDrm(), detectHlsDrm(), DRM_KEYFORMATS, DrmCheck, isLicenseRequestUrl(), classifyMediaUrl(), hook()

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

### Community 24 - "browserCookies.ts"
Cohesion: 0.12
Nodes (18): dir, file, browserIdFromDesktop(), browserSpec(), Candidate, candidates(), cookieMatchesDomain(), defaultBrowserId() (+10 more)

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RendererApi` connect `RendererApi` to `extractors/index.ts`, `shared/types.ts`, `engine.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `RendererApi` (e.g. with `Application design` and `Rules`) actually correct?**
  _`RendererApi` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `extractors/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06433566433566433 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `package.json` to `extractors/index.ts`, `main/index.ts`, `engine.ts`, `RendererApi`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05319148936170213 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `package.json` to `browserCookies.ts`, `extractors/index.ts`, `sniffer.ts`, `engine.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `electron-builder.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._