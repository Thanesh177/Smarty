# Quiz learning update

## User flow

Open Quiz and choose Subjects & lessons or Exam practice. Set Easy, Medium, Hard or Challenge, then select a subject/lesson or a named exam practice area. Questions-only is the default; games remain opt-in for subject challenges. Exam practice is always questions-only.

The named starter tracks are IELTS Academic reading skills, Terraform Associate 004, CompTIA Security+ SY0-701, and AWS Cloud Practitioner CLF-C02. Each includes an official provider reference and an explicit coverage limitation. These are independent practice questions, not official papers, leaked/recalled questions, complete mock exams, predicted bands or readiness assessments. Verify the required exam version with its provider before booking. The original starter bank has 36 questions across three levels; some practice areas require online generation.

Sound is off by default. Enabling it reuses one audio context per mounted game screen; playback failures cannot interrupt scoring, and the context is closed when the screen unmounts.

## Premium quiz access

Hard and Challenge are premium-only; Easy and Medium remain free. Locked difficulty controls and next-level actions explain the restriction without starting a quiz or spending AI tokens. Cached/local question sets, legacy boss shortcuts, adaptive promotion and review starts cannot start a premium round for a free account. Account or membership changes cancel an active premium round. Existing completed-answer records are not deleted.

The membership contract is the exact server-managed Cognito group `SmartyPremium`. Browser membership only controls presentation. The quiz handler checks the verified API authorizer's claims before cache/history reads or model invocation; request-body flags, email addresses, admin status and unverified bearer strings do not grant membership. The existing public route is unchanged in this gated release. Before enabling real premium access, configure a trusted JWT authorizer on the quiz route (or independently verify JWTs in the handler); without verified premium claims, Hard requests fail closed. Do not ship a UI-only entitlement check or make a group self-editable.

Premium purchasing is not active. No payment flow, pricing, subscription service, group provisioning or paid entitlement grants were added. The dismissible modal says subscriptions are not available yet and offers free practice. Connecting store purchases and renewal/expiry/revocation to verified entitlements is separate work; this local gate is not a complete billing system.

Premium-gate verification on 2026-11-26: 572 website tests and 27 handler tests passed; production build and the 238.1 KiB initial-JavaScript size gate passed. In a 390 by 844 browser preview, Hard opened a centered modal without changing Easy or starting a quiz. Escape closed it and restored focus to Hard. Day/night text was legible and there was no horizontal overflow. These are browser/local checks, not physical-device or live-entitlement verification. The deployed backend additionally returned HTTP 403 with `premium_required` for a public Hard request carrying fake client membership flags.

Check an answer before continuing. Each answer has an explanation. Mark uncertain answers before checking them; both mistakes and uncertain correct answers join the device's account-specific review queue. Correcting a saved question without marking it unsure removes it from that queue. Review sessions do not award more XP or change a first-attempt practice score.

Successful fresh sets offer the next difficulty and a link to lessons in the same subject. A short quiz is evidence about those questions only, not mastery of a whole subject or readiness for an exam.

## Content and AI

- All 13 feed categories have quiz entries and six original fallback questions each, two at each difficulty: 78 questions total.
- Online generation uses the existing `/quiz/generate` service. The frontend sends the study path, optional exam focus, subject areas, selected difficulty, source lesson when present, and recent questions to avoid.
- The Lambda now consumes those study fields, uses Bedrock Converse with an explicit output limit, and asks for applied scenarios, multi-step challenge questions, calculations and worked explanations.
- Generated responses are structurally validated. This is not independent fact verification: AI can still make mistakes. Important facts and exam coverage need checking against authoritative study materials.
- Shared generated question pools remain in the existing DynamoDB question-cache table. Candidate cache version 9 distinguishes subject/source, model, difficulty depth, study path, exam focus, allowlisted exam version/area and subject areas. Existing saved pools and user progress are not deleted. Learner history remains separate; one learner cannot select another learner ID through the request body.
- Pool leases still prevent simultaneous cold requests from generating duplicate pools. This is saved-answer reuse, not provider prompt caching.
- Manual levels are respected even for experienced learners. Wrong-level or malformed questions and answer-only explanations are rejected before entering the pool.
- Generated questions also need learner-facing teaching steps, a named reasoning type appropriate to the difficulty, a misconception and a reason for every incorrect option. Hard questions require multiple distinct teaching steps. Reading questions require an original passage and literal supporting evidence. These structural checks do not prove factual accuracy or that a question is genuinely difficult.
- A fresh, simpler repair question is generated and cached with each new AI question. After a wrong answer, it is optional and does not change the original round score or XP. Twelve starter questions have authored repairs of their specific concept; other starters do not offer an unrelated question as a repair. Saved reading mistakes retain their passage and evidence for review. Legacy questions without repair data still have their existing explanation/review flow.
- The candidate uses `us.anthropic.claude-haiku-4-5-20251001-v1:0` for Easy/Medium and `us.anthropic.claude-sonnet-4-6` for Hard shared sets, with an explicit 3,600-token output ceiling. Personal AI Q&A, news and post generation are unchanged. Only temperature is sent, not temperature plus top-p. Allowlisted `submit_quiz` structured data replaces fragile free-text JSON; bounded split submissions can be merged, but no tool is executed and there is no agent loop. Incomplete output, placeholder-only choices and choices exceeding the display bound are rejected rather than silently truncated. Indexed wrong-option reasons avoid generating each answer text twice, while stored questions retain the existing choice-keyed teaching format.
- A cache miss aims for three valid questions in one batch; it does not generate another paid batch merely to fill five nominal slots. Technical requests allow at most two passes; reading allows one further bounded top-up of a partially valid set. Personal mistake lists do not fork shared pools; individual repair and saved-review flows remain available. Existing larger pools can serve more questions without new generation.
- Named technical exam questions use curated study notes and must include literal supporting evidence from those notes. Reading passages must contain at least 100 words. These improve grounding but do not prove semantic accuracy; the model can still misinterpret a reference. Terraform notes explicitly distinguish sensitive-output redaction from state encryption and backend-supported state locking from a universal guarantee. References: [sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data), [state locking](https://developer.hashicorp.com/terraform/language/state/locking).
- Generated reading sets share one original passage across three questions, rather than generating and transmitting it three times. The passage explicitly opens with “In a hypothetical” and is limited to invented non-specialist institutional/community scenarios, not fabricated scientific or medical claims. The reading-only practice version isolates earlier experimental samples without discarding valid technical pools. Passage/evidence fields are required in the structured schema. This is still AI-written practice, not independent fact verification.
- Quiz requests allow 28 seconds within the existing 30-second public connection limit; the page cancels superseded requests and has a 29-second overall loading bound. Built-in starters and saved sets are tried before paid generation. A slow or failed new generation can still fall back to available practice; a cold AI call is not guaranteed to be instant.
- Shared pools keep at most 80 questions and 240 KiB of UTF-8 JSON, including metadata, passages and repairs. The conservative byte budget leaves room for DynamoDB item overhead; the newest questions are retained. No schema or table changes are required.

## Reading and news connections

Optional “Need the basics first?” help uses local background notes, with specific notes for recognised authored prerequisites. Links to a previous lesson are shown only when that post can be fetched. Next-read suggestions require an authored sequence or concept-level overlap, and do not jump from foundation directly to advanced material without an authored next step.

Story timelines group closely related same-day reporting conservatively. Changed names, quantities, opposite actions, negation, tentative outcomes and dates remain separate. Complete-link matching avoids transitive merges. This is headline matching, not a verified event chronology or an exhaustive archive.
- The offline fallback is deliberately a small general-preparation bank, not a replacement for a college course, certification syllabus, or a jurisdiction's government-exam syllabus. News questions cover evidence literacy, not invented current events.

## Release status

The owner approved publication on 2026-11-26 as a free-practice update with Premium locks. Quiz backend version 16 is deployed (SHA-256 `iCRw2OQk33ugCvjELms2p7UKMFMNsSVozS9dDvrexF8=`). The public API returned three valid Easy questions from the shared database cache in 1.23 seconds and rejected a spoofed non-premium Hard request in 1.15 seconds. The website publishes from the main branch after the backend check. No user data was removed.

Earlier cold Hard checks exceeded the 29-second client limit, so this release does not enable Premium purchasing or grant membership. Before opening paid Hard practice, finish verified entitlements and move slow generation to a background workflow or serve prepared sets. No background queue, new infrastructure or broader permissions are included in this publication. The original version-4 archive remains available for rollback (SHA-256 `Ze1Rzgxk9XDnwBZ+CNfu079tIowW01Al5XnUbW213Mc=`); earlier experimental versions are preserved, not promoted.

Release checks: 572 website tests, 27 quiz-handler unit tests, production build and initial-load size gate pass. Browser checks showed no mobile horizontal overflow and the wrong-answer teaching/repair entry point rendered. Separate background News requests on the temporary preview port had CORS errors; this is not a claim that live News was validated. Physical-device tests remain outstanding.

The live website is Amplify app `d3qiuefonbp8n9`, branch `main`, in us-east-2, attached to smarty.wiki; do not confuse it with the us-east-1 staging site. No new tables, credentials, API keys or infrastructure resources have been created for this release. The existing execution role has not been changed.

Use `scripts/package-news-learning.sh` when preparing the quiz archive: its root must contain `index.mjs`, `examBlueprints.mjs`, `quizQuestionQuality.mjs` and `quizAccess.mjs`. Uploading only `index.mjs` will fail at runtime. This script packages files locally; it does not deploy any service. Deploy and validate the quiz backend before releasing the frontend. Live verification uses synthetic release-check learners, never existing users' accounts. The earlier lightweight-model samples failed factual/passage checks; they are not reused by the new model/cache namespace.

Before production, test the deployed API with the real configured model and database: generate each difficulty, switch study paths, request the same context from a second learner and confirm shared-cache reuse, request fresh questions for the first learner, and simulate unavailable generation. Test complete quiz/review flows on a physical iPhone/iPad and Android device. Local mocks cannot confirm IAM, model access, timing, or semantic question accuracy.

## Local checks

`node --test src/lib/quizLearning.test.js src/lib/learningJourney.test.js src/components/audio/useSoundFeedback.test.cjs smarty-terraform/lambda-src/generateQuizQuestions/index.test.cjs`

`npm run build`

Browser QA used synthetic data at 320, 390, 834 and 1512 CSS-pixel widths. Check keyboard selection, answer explanations, uncertain answers, the saved review queue after reopening, repeat-score protection, no-games default, responsive layout, and failure fallback. AWS unit tests replace SDK boundaries and make no real model/database calls.
