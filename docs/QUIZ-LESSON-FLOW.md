# Quiz lesson library

## What changed

- The new flow is Subject → Lesson → Quiz. Related ideas are previews, not separate quiz choices. Historic topic-specific mistake reviews still work.
- The 17 subjects contain 143 lessons, including 51 additions with short study notes. Examples include how a bicycle moves and stops, how a bridge carries a load, and how to investigate a headline.
- Six lessons appear at a time. “Load more lessons” reveals the next six matching the current search and filter. Returning from a quiz restores the expanded list and the lesson position.
- 189 original questions across 30 lesson banks include 85 new questions. Each subject has a new ready-to-play five-question set. Adaptive starter rounds introduce the ideas before adding application; explicit difficulty choices remain strict.
- Built-in rounds prioritize coverage across the lesson, not repeated variants of one concept. Online rounds send the learning objective, study notes and connected ideas through the existing source and subject-area fields. The client prioritizes different concepts when choosing up to six returned questions. Unavailable online sets fall back only to relevant built-in questions, if any.
- Question history is account-specific and checked at both the lesson and parent subject. The existing history limit is 500 questions per scope and one year. Cached unanswered questions can resume an unfinished round.
- Results show the ideas actually practised, areas to revisit, worked explanations and related lessons. Mistake review awards no extra XP. Floating XP, achievement toasts and confetti are gone from quizzes; XP and achievements still save.

## Implementation boundaries

No infrastructure, AI model, credentials, account settings or live deployment was changed. The existing quiz endpoint uses the lesson reference, focus, subject areas, difficulty and excluded prompts and manages its shared online question cache.

Online question quality still needs ongoing review; an AI-generated set is not an official syllabus or guaranteed factual assessment. Original science questions use established introductory concepts. Background checks included [OpenStax on passive transport](https://openstax.org/books/biology-2e/pages/5-2-passive-transport), [OpenStax on enzymes](https://openstax.org/books/biology-2e/pages/6-5-enzymes), and [NASA’s orbital-motion learning overview](https://science.nasa.gov/learn/heat/big-ideas/big-idea-1-1/). The questions are newly written, not copied textbook exercises.

## Verification

Run `npm test`, build into a temporary output directory, then run `scripts/check-performance.mjs` against that output.

Tests cover catalog completeness, stable historic IDs, valid distinct answer choices, broad coverage, difficulty, history exclusion, review, account isolation, cache isolation, lesson selection, and pagination and its restoration.

The local browser check completed the five-question bicycle lesson, confirmed five coverage rows and saved score/XP, and found no reward overlays. Live online generation and cross-device progress remain release checks for this update.
