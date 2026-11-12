# Graph Report - course_downloader  (2026-11-13)

## Corpus Check
- 54 files · ~14,618 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .css 1)

## Summary
- 378 nodes · 778 edges · 23 communities (13 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- extractors/index.ts
- package.json
- electron-builder.yml
- main/index.ts
- shared/types.ts
- engine.ts
- RendererApi
- binaries.ts
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

## God Nodes (most connected - your core abstractions)
1. `RendererApi` - 25 edges
2. `load()` - 24 edges
3. `Engine` - 21 edges
4. `AuthRequiredError` - 16 edges
5. `ExtractorContext` - 16 edges
6. `registerIpc()` - 15 edges
7. `Job` - 15 edges
8. `save()` - 14 edges
9. `runCli()` - 13 edges
10. `makeContext()` - 13 edges

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

## Communities (23 total, 10 thin omitted)

### Community 0 - "extractors/index.ts"
Cohesion: 0.08
Nodes (31): Application design, crawlerExtractor, segs(), siblingLessonLinks(), sniffOrThrow(), courseToItems(), deeplearningai, DlaiCourse (+23 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (43): shared, author, description, desktopName, devDependencies, electron@^45.3.1, electron-builder@^26.18.0, electron-vite@^6.0.0 (+35 more)

### Community 2 - "electron-builder.yml"
Cohesion: 0.05
Nodes (41): appId, appImage, artifactName, asar, copyright, deb, depends, entry (+33 more)

### Community 3 - "main/index.ts"
Cohesion: 0.14
Nodes (30): electron, ensureSite(), exportCookies(), getCookie(), isLoggedIn(), listSites(), logout(), netscapeLine() (+22 more)

### Community 4 - "shared/types.ts"
Cohesion: 0.10
Nodes (25): react, App(), Tab, DownloadsPage(), STATUS_LABEL, defaultSelected(), dur(), HomePage() (+17 more)

### Community 5 - "engine.ts"
Cohesion: 0.15
Nodes (13): BROWSER_UA, Logger, Engine, findOutput(), fmtBytes(), fmtEta(), formatSelector(), MEDIA_EXT (+5 more)

### Community 6 - "RendererApi"
Cohesion: 0.06
Nodes (9): Architecture, Commands, CourseGrab – project guide for Claude, graphify (token-efficient code navigation), Rules, Workflow: AI-DLC (AI-Driven Development Life Cycle), api, Window (+1 more)

### Community 7 - "binaries.ts"
Cohesion: 0.18
Nodes (16): dir, file, bundledBinDir(), ensureYtDlp(), exe(), ffmpegPath(), find(), installYtDlp() (+8 more)

### Community 8 - "sniffer.ts"
Cohesion: 0.17
Nodes (14): detectDashDrm(), detectDrm(), detectHlsDrm(), DRM_KEYFORMATS, DrmCheck, isLicenseRequestUrl(), SniffResult, classifyMediaUrl() (+6 more)

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

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `main/index.ts` to `sniffer.ts`, `package.json`, `RendererApi`, `binaries.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `RendererApi` (e.g. with `Application design` and `Rules`) actually correct?**
  _`RendererApi` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `extractors/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08350168350168351 - nodes in this community are weakly interconnected._
- **Why does `RendererApi` connect `RendererApi` to `extractors/index.ts`, `shared/types.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AuthRequiredError` (e.g. with `Application design` and `extractor-dev.md`) actually correct?**
  _`AuthRequiredError` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `AuthRequiredError` connect `extractors/index.ts` to `main/index.ts`, `engine.ts`, `RendererApi`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._