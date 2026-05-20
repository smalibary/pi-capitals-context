# Project

pi extension for personal, toggleable AI context management. See `CONTEXT.md` for canonical terms and domain boundaries.

**In scope:** file discovery, toggle state, system prompt injection, /caps overlay UI, token estimation, file watching, config-file overrides, diagnostics.
**Out of scope:** team sharing, semantic retrieval, doc editing, replacing CLAUDE.md.

Use terms from `CONTEXT.md` exactly — CAPS File, CAPS Folder, Toggle, State, Injection, Session, Global CAPS, Project CAPS, Root CAPS, Subdir CAPS, Config File, Skip List, Doctor, Profile, Overlay, Settings Hub.

# UI-First Rule

Every new action this project ships is an **Overlay** flow first. Typed slash-command arguments are a scripting fallback, not the primary surface.

- **Default**: new action → overlay. Pick, navigate with arrows, act with Enter / single-letter keys (`d` delete, `r` rename, `e` edit), cancel with Esc.
- **Typed args**: allowed only as a parallel scripting path for actions that already have an overlay. Never as the only way to do a thing.
- **Multi-step flows**: chain overlays via `ctx.ui.custom` calls in the handler. Each overlay closes on its own `done()`, the next opens after. Always provide an explicit discard path (restore previous state on cancel).
- **No subcommand dispatchers**: `/foo bar baz <name>` is friction. If the action is picking from a list, the overlay shows the list. If naming/typing is required, a name-input overlay does it.
- **No flags for discoverable actions**: `--copy`, `--dry-run`, `--diff` belong on keys inside the overlay (`c` copy, `p` preview, etc.), not on the slash command.

Out of scope for this rule: trivial one-shot text commands like `/caps-doctor --verbose` for scripting — these are *secondary* to the overlay, not replacements.

# Commands (current surface as of v2.2-dev)

- `/caps` — toggle overlay (daily driver)
- `/caps-profile` — overlay picker for profiles. Top row `+ Create new profile` chains /caps + name-input overlays (Enter save, Esc discard restores toggles). Profile rows: Enter load, `e` edit (loads + /caps + saves back), `r` rename (opens name-input pre-filled), `d` twice delete, Esc quit. Typed: `save <name>`, `load <name> [--dry-run]`, `rename <old> <new>`, `list`.
- `/caps-settings` — Settings Hub overlay. Rows: Skip list, Prompt preview, Diagnose / Doctor (all active); Configuration (stub). Enter opens row's overlay; Esc quits.
- `/caps-advance skip <list|add|remove|reset>` — typed scripting fallback for skip list. Overlay path: `/caps-settings → Skip list`.
- `/caps-advance profile <list|save|load|delete|rename>` — typed scripting fallback for profiles. Overlay path: `/caps-profile`.
- `/caps-prompt [--copy] [--diff]` — typed scripting fallback for prompt preview. Overlay path: `/caps-settings → Prompt preview`.
- `/caps-doctor [--verbose]` — typed scripting fallback for diagnostics. Overlay path: `/caps-settings → Diagnose / Doctor`.

# Local vs npm

`src/env.ts` auto-detects via `import.meta.url`. Local dev shows `[CAPS Context — LOCAL DEV]`. npm install shows `[CAPS Context]`. Never hardcode either label — use the `CONTEXT_LABEL` export.

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
- Bug fix -> if an existing tripwire test covers the bug, flip its expectation (the failure proves you fixed it). Otherwise write a fresh failing test first, then the fix.
- Refactor -> run tests after every module split. Behavior must not change.
- Run `npm test` before declaring task done. Not optional.

Current state (v2.2-dev):
- 213 tests across 17 files; coverage ~30% lines, ~88% branches on covered code
- All v2.0 audit tripwires flipped — loose-match fix, LICENSE/CHANGELOG/README in default skip list
- Tested: `discovery`, `config`, `config-writer`, `state`, `injection`, `diff`, `doctor`, `profiles`, `profile-overlay`, `name-input-overlay`, `settings-overlay`, `skip-overlay`, `prompt-overlay`, `doctor-overlay`, regex defaults
- Still untested: `CapsSelector` overlay UI (528 lines — needs fake-terminal harness), `before_agent_start` orchestrator handler, file watcher. Cover these as opportunities arise; not gated on a version.

Target 60% line coverage by end of v2.2 (overlay coverage is the gap).
