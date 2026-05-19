# Project

pi extension for personal, toggleable AI context management. See `CONTEXT.md` for canonical terms and domain boundaries.

**In scope:** file discovery, toggle state, system prompt injection, /caps overlay UI, token estimation, file watching.
**Out of scope:** team sharing, semantic retrieval, doc editing, replacing CLAUDE.md.

Use terms from `CONTEXT.md` exactly — CAPS File, CAPS Folder, Toggle, State, Injection, Session, Global CAPS, Project CAPS.

# Communication Style

Respond terse. All technical substance stay. Only fluff die.

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Abbreviate common terms (DB/auth/config/req/res/fn/impl). Strip conjunctions. Use arrows for causality (X -> Y). One word when one word enough.

Technical terms stay exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

Drop style temporarily for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread. Resume after.

# Testing

Tests live in `test/`. Vitest. Run with `npm test`. Coverage: `npm run coverage`.

CI gates publish on `npm test`. Tests fail -> publish blocked. Never bypass.

Rules:
- New feature -> tests before merge. Acceptance criteria in `ROADMAP.md` per version.
- Bug fix -> existing tripwire test fails first (proves the bug), then flip expectation (proves the fix). Don't write new test alongside — update the tripwire.
- Refactor -> run tests after every module split. Behavior must not change.
- Run `npm test` before declaring task done. Not optional.

Tripwire tests (marked `currently matches...` / `currently treats...` in test files) document known bugs. Update them when v2.1-F3 ships fixes:
- `caps-file-re.test.ts` — LICENSE.md / CHANGELOG.md inclusion
- `extract-subdirs.test.ts` — prose loose-match (lines about `lib`, `docs`)

Untested today (deferred to v2.1-F2 after module split): `CapsSelector` overlay, `before_agent_start` handler, watcher logic.

Coverage floor climbs per version: F1 baseline ~10%, target 60% by end of v2.1.
