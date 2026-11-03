# Quiz lesson library

## What changed

- The subject catalog now opens a book-like contents view rather than immediately starting a generic quiz.
- 17 subjects contain 92 lessons, each with three independently selectable topics. Example: Science & Mathematics → Inside an electric circuit → Ohm’s law.
- Branch filters (such as Physics or Chemistry), concept-aware search, whole-lesson practice and a broad subject mix are available.
- 104 original starter questions in 13 lesson banks span foundation, application and challenge levels. They include concepts, scenarios, comparisons, misconceptions, calculations and evidence interpretation.
- Only explicitly tagged starter questions can enter a topic-specific quiz. Unsupported topics need the existing online question service; they never receive an unrelated general fallback.
- Lessons with at least three unseen built-in questions at the requested level open immediately. Other sets use the existing online generation/cache endpoint. Failed online requests can offer the matching remaining built-in questions, including a shorter set when necessary.
- Question history is checked at both the selected practice scope and its parent subject. Exact repeated prompts are rejected even if an answer changes. History is account-specific and bounded by the existing 500-question/one-year policy; this is not a promise of unlimited, permanent deduplication.
- Question cache context now includes lesson version, objectives and selected inner topic. Existing broad quizzes, saved results and post-linked quizzes remain available.
- Mistakes and uncertainty retain the subject/lesson/topic context. Explicit review awards no extra XP. Results suggest other topics inside the lesson, then connected lessons, and summarize the reasoning types practised.
- Progress screens resolve lesson/topic names instead of exposing internal IDs. Practice scores are not certifications or proof of exam readiness.

## Implementation boundaries

No infrastructure, AI model, credentials, account settings or live deployment was changed. The existing quiz endpoint already accepts specific focus, subject areas, difficulty, excluded prompts and question-style instructions, and manages its shared online question cache.

Online question quality still needs ongoing review; an AI-generated set is not an official syllabus or guaranteed factual assessment. Original science questions use established introductory concepts. Background checks included [OpenStax on passive transport](https://openstax.org/books/biology-2e/pages/5-2-passive-transport), [OpenStax on enzymes](https://openstax.org/books/biology-2e/pages/6-5-enzymes), and [NASA’s orbital-motion learning overview](https://science.nasa.gov/learn/heat/big-ideas/big-idea-1-1/). The questions are newly written, not copied textbook exercises.

## Verification

Run `npm test`, build into a temporary output directory, then run `scripts/check-performance.mjs` against that output.

Tests cover catalog completeness, stable scope IDs, valid distinct answer choices, topic relevance tags, three difficulty levels, non-mutating selection, history exclusion, explicit review, account isolation, cache invalidation, reasoning summaries and opening/filtering/selecting lessons and their topics.

Browser checks should include a full built-in quiz, missed/uncertain review, topic-specific online generation, back navigation, a 390px phone layout, a tablet layout, and day/night contrast. Native-device and authenticated cross-device progress testing remain release checks; local browser tests do not replace them.

Verified during implementation: completed a three-question built-in circuits set (including a missed/uncertain answer), saw the correct 2/3 result and saved practice record, generated a five-question Ohm’s law set through the existing service, then reopened it and received the four remaining unanswered cached questions. The 390px lesson view had no horizontal overflow and topic buttons were at least 46px high. Day-mode cards and controls use the existing oatmeal/pine palette; night mode inherits the app’s black/blue palette.
