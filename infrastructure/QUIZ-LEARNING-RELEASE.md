# Quiz learning update

## User flow

Open Quiz, select College study, Government exams, or Skill exams, choose an automatic or explicit question level, and optionally name an exam or skill. Search the 13 main subjects, then start practice. Questions-only is the default; games are opt-in.

Sound is off by default. Enabling it reuses one audio context per mounted game screen; playback failures cannot interrupt scoring, and the context is closed when the screen unmounts.

Check an answer before continuing. Each answer has an explanation. Mark uncertain answers before checking them; both mistakes and uncertain correct answers join the device's account-specific review queue. Correcting a saved question without marking it unsure removes it from that queue. Review sessions do not award more XP or change a first-attempt practice score.

Successful fresh sets offer the next difficulty and a link to lessons in the same subject. A short quiz is evidence about those questions only, not mastery of a whole subject or readiness for an exam.

## Content and AI

- All 13 feed categories have quiz entries and six original fallback questions each, two at each difficulty: 78 questions total.
- Online generation uses the existing `/quiz/generate` service. The frontend sends the study path, optional exam focus, subject areas, selected difficulty, source lesson when present, and recent questions to avoid.
- The Lambda now consumes those study fields, uses Bedrock Converse with an explicit output limit, and asks for applied scenarios, multi-step challenge questions, calculations and worked explanations.
- Generated responses are structurally validated. This is not independent fact verification: AI can still make mistakes. Important facts and exam coverage need checking against authoritative study materials.
- Shared generated question pools remain in the existing DynamoDB question-cache table. Cache version 4 distinguishes subject/source, difficulty depth, study path, exam focus and subject areas. Learner history remains separate; one learner cannot select another learner ID through the request body.
- Pool leases still prevent simultaneous cold requests from generating duplicate pools. This is saved-answer reuse, not provider prompt caching.
- Manual levels are respected even for experienced learners. Wrong-level or malformed questions and answer-only explanations are rejected before entering the pool.
- The offline fallback is deliberately a small general-preparation bank, not a replacement for a college course, certification syllabus, or a jurisdiction's government-exam syllabus. News questions cover evidence literacy, not invented current events.

## Release status

Changes are local only. Deploy the updated `generateQuizQuestions` Lambda and frontend together using the existing release pipeline. There are no new tables, credentials, API keys or infrastructure resources in this change. The existing execution role still needs its configured model-invocation and question/history-table permissions.

Before production, test the deployed API with the real configured model and database: generate each difficulty, switch study paths, request the same context from a second learner and confirm shared-cache reuse, request fresh questions for the first learner, and simulate unavailable generation. Test complete quiz/review flows on a physical iPhone/iPad and Android device. Local mocks cannot confirm IAM, model access, timing, or semantic question accuracy.

## Local checks

`node --test src/lib/quizLearning.test.js src/lib/learningJourney.test.js src/components/audio/useSoundFeedback.test.cjs smarty-terraform/lambda-src/generateQuizQuestions/index.test.cjs`

`npm run build`

Browser QA used synthetic data at 320, 390, 834 and 1512 CSS-pixel widths. Check keyboard selection, answer explanations, uncertain answers, the saved review queue after reopening, repeat-score protection, no-games default, responsive layout, and failure fallback. AWS unit tests replace SDK boundaries and make no real model/database calls.
