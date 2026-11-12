# deeplearning.ai – discovery notes (2026-11-13)

Example: https://learn.deeplearning.ai/courses/evaluating-and-improving-agentic-applications/lesson/53tpudpi/…

- Next.js app; data via **tRPC** `GET https://learn.deeplearning.ai/api/trpc/<procedure>?input={"json":{…}}`.
- `course.getCourseBySlug {courseSlug}` (anonymous OK) → `name`, `listing[]` (modules with ordered `content` keys: lesson | subtopic), `subtopics{}`, `lessons{slug → index,name,type,videoId,time,accessControl,requiredUserTier,readingMaterialId}`. Types: video, reading_material, notebook, graded_notebook, quiz.
- `course.getLessonVideo {videoId}` (anonymous OK for "full" lessons) → `srcSet[0].src` HLS master (1080p/720p/360p, H.264/AAC, **no encryption**), `mp4360pUrl`, `tracks[]` VTT subtitles (multiple languages), chapters VTT.
- `course.getReadingMaterial {readingMaterialId}` → **401 UNAUTHORIZED** anonymously → triggers login flow.
- Locked items: `accessControl: "locked"`, `requiredUserTier: "pro"` (graded labs, quizzes).
- Login: next-auth (`/api/auth/...`, providers: DLAI, Google, LinkedIn, email); session cookie `__Secure-next-auth.session-token`.
- Verified: lesson 2 downloaded as 1920×1080 MP4 (373 s) + 6 VTT tracks.
