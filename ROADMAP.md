# ROADMAP — pi-capitals-context

> Two-track plan. Merges audit findings (bugs, cache, architecture) with product/UX features.
> Each mini-feature has tasks, scope boundaries, dependencies, and origin tag.

**Origin tags:** `A1` = Answer 1 idea, `A2` = Answer 2 idea, `NEW` = added during merge.

---

## Status

| Version | Status | Highlights |
|---|---|---|
| **v2.1.0** | ✅ Shipped — 2026-05-20 | tests + CI gate, modular `src/`, all audit bugs fixed, `/caps-advance skip`, `/caps-prompt`, `/caps-doctor`, configurable discovery, defensive limits |
| **v2.2** | next | state persistence completeness, watcher upgrades, overlay clarity, filter/nav, editor integration |
| **v2.3** | planned | rest of `/caps-advance` — profiles, token budget, tags, conditions, per-CAPS injection format |
| **v2.4** | planned | cache & cost — freeze mode, accurate tokens, folder index injection, cache-bust warnings |
| **v3.0** | planned | platform — `/caps-init`, includes/imports, public API, content search, ephemeral CAPS, auto-context |

See `CHANGELOG.md` for the v2.1.0 release notes.

---

## Release Procedure — applies at end of every phase

Run through this checklist before tagging any v2.x.0 (and most x.y.z patches). Items in **bold** are blocking.

> Per-file update guidance, doc-rot checklist, screenshot conventions, and the criteria for splitting into `docs/` live in `MAINTAINING.md`. The procedure below is the *what*; `MAINTAINING.md` is the *how*.

### 1. Code green
- [ ] **`npm test` passes locally** (all current tests; no skips)
- [ ] **`npm run coverage` reviewed** — coverage didn't regress; if a major area is still 0%, decide: cover now, or note as deferred in CHANGELOG "Internal" section
- [ ] **CI green on `master`** before tagging (check the `CI` workflow run)

### 2. Doc sync
- [ ] **`CHANGELOG.md`** — new version section with Added / Changed / Fixed / Security / Deprecated / Internal (only the ones that apply). Date in YYYY-MM-DD. Be honest about deprecations.
- [ ] **`README.md`** — every new command surface documented (Commands table, Configuration schema if a field was added, Troubleshooting if a new failure mode is now diagnosable). Remove anything the release made wrong.
- [ ] **`CONTEXT.md`** — new canonical terms added if the version introduces domain concepts. New Relationships entries if behavior couples differently. _Avoid_ lines kept current.
- [ ] **`CLAUDE.md`** — Commands section updated, Testing section refreshed (test count, what's still untested), command surface list current. Remove stale tripwire reminders for bugs that have been fixed.
- [ ] **`ROADMAP.md`** — version Status table updated (✅ Shipped + date), the section header for the just-shipped version marked, "Three Bets For Next Sprint" rewritten for the next milestone, anything killed during the version moved to "Killed Ideas".
- [ ] **Docs review** — re-read README end-to-end. Check the doc-rot list in `MAINTAINING.md`. If `MAINTAINING.md`'s triggers fire (README > 400 lines, etc.), create `docs/` per its structure spec.

### 3. Version bump
- [ ] **`package.json`** — bump `version` (semver: bug fixes = patch, new features = minor, breaking = major)
- [ ] If breaking, the previous major must have lived long enough for npm users to migrate (3+ months as a rule of thumb)

### 4. Settings flip
- [ ] If you've been on local-dev mode for testing, flip `~/.pi/agent/settings.json` back to `"npm:pi-capitals-context"` so the published version is what gets used across other projects. (Flip back to local after publish if continuing dev.)

### 5. Tag + push
```
git push origin master
git tag v<version>
git push origin v<version>
```

### 6. Verify ship
- [ ] **CI: `Publish to npm` workflow succeeded** (`gh run list --limit 3`)
- [ ] **`npm view pi-capitals-context version`** returns the new version
- [ ] **`npm view pi-capitals-context dist-tags`** shows `latest: <new version>`
- [ ] Pull the published version in a *different* project (not `testing-caps`) and confirm `[CAPS Context]` (no LOCAL DEV suffix) — confirms registry serves correctly

### 7. Post-ship cleanup
- [ ] Remove any mock files from `testing-caps/` (keep `.gitkeep` + `CLAUDE.md`)
- [ ] Close TaskList entries for the shipped version
- [ ] If continuing dev: flip settings back to local-dev mode

### When this procedure breaks
- A pre-commit hook failed → fix the underlying issue, never `--no-verify`
- CI passed locally but failed on push → likely platform difference (LF/CRLF, symlink permissions on Windows runners); add platform-conditional test skips, don't disable tests
- npm publish failed but tag is pushed → don't re-tag; bump patch (`v2.1.1`) and republish. Tags must be immutable once public.

---

## Ultimate Vision

**Personal Context Conductor.** You see exactly what AI sees, you choose what's worth paying for, you never waste a token. Manual curation stays the soul — automation only assists, never decides. Terminal-first, single-user, opinionated.

One-liner: *"CLAUDE.md is always-on. CAPS is pay-per-turn."*

---

## Two-Track Command Surface

Architectural decision: split commands so `/caps` stays beginner-friendly.

| Command | Audience | Surface |
|---|---|---|
| `/caps` | All users | Toggle list, preview, filter, search. Daily driver. |
| `/caps-advance` | Power users | Profiles, token budget, tags, conditions, freeze mode. Opt-in route. |
| `/caps-doctor` | Anyone debugging | Discovery diagnostics, state health, injection trace. |
| `/caps-init` | New projects | Template scaffolding (STATUS.md, ARCHITECTURE.md, etc.). |
| `/caps-prompt` | Trust check | Show exact injected system-prompt text. |

Boundary: never add advanced features to `/caps`. If it requires explanation beyond a tooltip, it goes in `/caps-advance`.

---

## Version Strategy

- **v2.1** — Foundation & Safety. Bugs, tests, trust.
- **v2.2** — Polish & Trust. State persistence, watcher, UX clarity.
- **v2.3** — `/caps-advance` launch. Profiles, budgets, tags, conditions.
- **v2.4** — Cache & Cost. Freeze mode, accurate tokens, cheaper injection.
- **v3.0** — Platform. Templates, includes, public API, auto-context.

Boundary: no v2.x release ships features without tests covering them. Tests get backfilled in v2.1; new features after gate on coverage.

---

# v2.1 — Foundation & Safety ✅ SHIPPED 2026-05-20

Goal: stop bleeding. No new features until the floor is solid.

All sub-features (F1–F6, plus early F3-10 = v2.3-F0 skip CRUD) merged. See `CHANGELOG.md` for the release entry.

## v2.1-F1 — Test harness bootstrap [A2]

Goal: enable safe refactoring and feature work.

- [ ] Pick test runner (vitest preferred — fastest, TS-native)
- [ ] Add `test/` folder + npm scripts (`test`, `test:watch`, `test:ci`)
- [ ] Cover: `CAPS_FILE_RE`, `extractSubdirs`, `validateState`, `saveState` atomic write
- [ ] Wire CI to block publish on test failure
- [ ] Add `coverage` script (target: 60% by end of v2.1)

**In scope:** unit tests, CI gate, coverage report.
**Out of scope:** E2E pi-extension integration tests (deferred to v2.2).
**Depends on:** nothing — start here.

## v2.1-F2 — Modular refactor [A2]

Goal: split 719-line god file into reviewable modules.

- [ ] `src/discovery.ts` — `findCapsFiles`, `findAllText`, `extractSubdirs`, SKIP sets
- [ ] `src/state.ts` — `loadState`, `saveState`, `validateState`, atomic write
- [ ] `src/tokens.ts` — token estimation (lift heuristic, prep for tiktoken swap)
- [ ] `src/overlay.ts` — overlay UI, render, key handling
- [ ] `src/injection.ts` — system-prompt assembly, formatting
- [ ] `src/types.ts` — `FileEntry`, `Theme`, exported public types
- [ ] `extensions/index.ts` becomes a thin orchestrator
- [ ] No behavior change — refactor only

**In scope:** file split, type extraction, internal API.
**Out of scope:** public API surface (v3.0), behavioral changes.
**Depends on:** v2.1-F1 (tests in place before moving code).

## v2.1-F3 — Critical bug fixes [A2]

Goal: eliminate silent failures and unbounded growth.

- [ ] Fix `extractSubdirs` loose matching (line 97-100): drop the bare-substring fallback OR restrict to word-boundary regex `\b{dir}\b`
- [ ] Make SKIP_FILES user-configurable (see v2.1-F6 below) — defaults expanded, user can override
- [ ] Bound `subdirFiles` array: cap at N entries (e.g., 20), evict oldest, surface in overlay
- [ ] Remove `firstMsgSent` permanent lock (line 532) — allow toggles mid-session
- [ ] Add file-size cap: refuse files > configurable max (default 100KB), surface warning in `/caps`
- [ ] Add symlink resolution: refuse symlinks pointing outside project + `~/.pi/CAPS/`
- [ ] Add recursion depth limit in `findAllText` (default 6 levels)
- [ ] Persist `subdirFiles` state — currently only `rootFiles` saved

**In scope:** the bugs flagged by audit, all under 50 LoC each.
**Out of scope:** new features triggered by these fixes (e.g., warning UX → v2.2).
**Depends on:** v2.1-F1, v2.1-F2.

## v2.1-F4 — `/caps-prompt` [A2]

Goal: trust. User sees exactly what gets injected.

- [ ] Add `/caps-prompt` command — prints the assembled `## Additional Context (CAPS files)` block
- [ ] Show byte count + estimated tokens per file + total
- [ ] Add `--copy` flag (writes to clipboard)
- [ ] Add `--diff` flag (shows diff vs previous turn's injection — surfaces cache invalidation)
- [ ] Document in README

**In scope:** read-only inspection command.
**Out of scope:** editing from this view (handled by `e` keybind in v2.2).
**Depends on:** v2.1-F2 (needs `injection.ts` module).

## v2.1-F5 — `/caps-doctor` [A1+A2]

Goal: diagnose "why isn't my file loading."

- [ ] Add `/caps-doctor` command
- [ ] Reports: project root, CAPS files found, files skipped + reason (regex/SKIP/size/symlink), Global CAPS path, state file location + validity, active watchers, last injection size, token heuristic mode
- [ ] Add `--verbose` for full discovery trace per file
- [ ] Startup warning when zero CAPS files found
- [ ] Document common failure modes in README troubleshooting section

**In scope:** diagnostic read-only command.
**Out of scope:** auto-fixing — diagnose only.
**Depends on:** v2.1-F2.

## v2.1-F6 — User-configurable discovery [NEW]

Goal: SKIP list is user's choice, not hardcoded. Same for CAPS naming regex.

- [ ] Move `SKIP_FILES`, `SKIP_DIRS`, `TEXT_EXTENSIONS`, `CAPS_FILE_RE` into config file `~/.pi/caps-config.json`
- [ ] Sensible defaults shipped on first run:
  - `skipFiles`: `["AGENTS.md", "CLAUDE.md", "LICENSE", "LICENSE.md", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "README.md"]`
  - `skipDirs`: `["AGENTS", "CLAUDE", "NODE_MODULES", ".git", ".pi"]`
  - `capsFilePattern`: `"^[A-Z][A-Z0-9_]*\\.md$"` (string, compiled to regex)
- [ ] Per-project override at `.pi/caps-config.json` (merged: project wins over global)
- [ ] `/caps-doctor` shows: which skip rules came from defaults vs user-global vs project-override
- [ ] `/caps-advance skip add <name>` and `skip remove <name>` shortcuts (writes to project config)
- [ ] Validation on load — invalid regex falls back to default + warns
- [ ] Document config schema in README

**In scope:** config file, merge semantics, defaults, doctor visibility.
**Out of scope:** runtime UI for editing config (use `$EDITOR` via v2.2-F5).
**Depends on:** v2.1-F2.

**Rationale:** SKIP defaults catch the obvious noise (LICENSE, README), but every project is different. A research repo might *want* LICENSE.md as context. A monorepo might need extra dirs skipped. Hardcoded lists become friction the moment they don't match your case.

## v2.1 Acceptance Criteria

- All bugs in F3 covered by regression tests
- Zero changes to overlay UI vs v2.0
- `npm test` runs in CI, blocks publish
- `/caps-prompt` and `/caps-doctor` documented
- Skip rules editable via config; defaults documented

---

# v2.2 — Polish & Trust

Goal: tool feels finished. Every irritation from daily use removed.

## v2.2-F1 — State persistence completeness [A1+A2]

Goal: nothing resets between `/caps` invocations.

- [ ] Persist sort mode in state JSON
- [ ] Persist expanded/collapsed folder set in state JSON
- [ ] Persist filter draft (optional — opt-in via setting)
- [ ] Preserve cursor position when filter changes (don't reset to 0)
- [ ] Garbage-collect orphan state entries (file no longer exists → drop key after 30 days)
- [ ] Retry atomic write on Windows `EBUSY` (3 attempts, 50ms backoff)
- [ ] Clean up `.tmp` files on startup

**In scope:** state schema additions, GC, Windows reliability.
**Out of scope:** profile state (v2.3 — different file).
**Depends on:** v2.1.

## v2.2-F2 — Watcher upgrades [A1+A2]

Goal: file changes are actionable, not just notifications.

- [ ] Detect new CAPS files mid-session (currently invisible)
- [ ] Distinct messages: `added`, `modified`, `deleted` (currently all generic)
- [ ] Show what changed in diff snippet (first 3 changed lines)
- [ ] Add `r` keybind in overlay to hot-reload changed files without pi restart
- [ ] Reset `changedPaths` after each render (currently grows forever)
- [ ] Watch `~/.pi/CAPS/` too (currently project-only)

**In scope:** watcher events, hot reload, mid-session discovery.
**Out of scope:** auto-reload (opt-in user action only).
**Depends on:** v2.1-F2.

## v2.2-F3 — Overlay clarity [A1+A2]

Goal: discoverability at a glance.

- [ ] Visual section headers in overlay: `── Project CAPS ──`, `── Global CAPS ──`, `── Auto-loaded (subdir) ──`
- [ ] Show disabled count in startup display block: `3 files enabled · 5 available · /caps`
- [ ] ASCII fallback for unicode symbols (☑/☐/◑ → `[x]`/`[ ]`/`[~]`) — auto-detect or `--ascii` flag
- [ ] Stack preview below list when terminal < 74 cols (currently hidden entirely)
- [ ] Help line: progressive disclosure — `?` toggles full keybind help
- [ ] First-run hint banner when state file doesn't exist yet

**In scope:** overlay rendering and discoverability.
**Out of scope:** advanced filtering (v2.3 — fuzzy/regex).
**Depends on:** v2.1-F2.

## v2.2-F4 — Filter & navigation [A2]

Goal: power keys without breaking simplicity.

- [ ] `g`/`G` jumps top/bottom
- [ ] `i` inverts selection (current filter scope)
- [ ] `V` then arrow for range selection
- [ ] Filter: substring + fuzzy match (toggle with `/` vs `f`)
- [ ] `Esc` semantics: clear filter if active, else close (document in help line)

**In scope:** keybind additions, fuzzy match.
**Out of scope:** regex filter (v2.3 advanced), content search (v3.0).
**Depends on:** v2.2-F3.

## v2.2-F5 — Editor integration [A2]

Goal: jump from preview to edit in one keypress.

- [ ] `e` in overlay opens current file in `$EDITOR` (fallback `$VISUAL`, then `code`/`notepad`)
- [ ] On editor exit, refresh file content + token count
- [ ] Document `$EDITOR` configuration

**In scope:** spawn-editor only.
**Out of scope:** in-overlay editing.
**Depends on:** v2.2-F2 (hot reload mechanism).

## v2.2 Acceptance Criteria

- No state resets between sessions
- Watcher provides actionable info, not just "restart"
- Overlay readable on 60-col terminal
- Test coverage ≥ 70%

---

# v2.3 — `/caps-advance` Launch

Goal: ship the power-user route. Beginners untouched.

> All features below live behind `/caps-advance`. The basic `/caps` overlay shows a single hint line at bottom: `/caps-advance for profiles, budgets, tags`.

## v2.3-F0 — `/caps-advance` skip CRUD [SHIPPED EARLY in v2.1-F3-10]

Skip-list editing landed early to address UX gap: default skip filters out files some projects need (LICENSE/README in research repos).

Subcommands shipped in v2.1:
- `/caps-advance skip list`
- `/caps-advance skip add <name>`
- `/caps-advance skip remove <name>`
- `/caps-advance skip reset`
- `/caps-advance help`

Rest of `/caps-advance` (profiles, budgets, tags, conditions, freeze) lands in v2.3 as additional subcommands. Architecture: subcommand dispatcher already in place.

## v2.3-F1 — Profiles [A1+A2]

Goal: named context combos. The killer feature.

- [ ] State schema: `{ toggles, profiles: { [name]: toggleMap } }`
- [ ] `/caps-advance` → opens advanced overlay with profile section at top
- [ ] `save <name>` action — captures current toggle state
- [ ] `load <name>` action — restores toggles, shows diff before apply
- [ ] `delete <name>` action
- [ ] `rename <old> <new>` action
- [ ] Optional auto-profile per git branch (opt-in setting)
- [ ] CLI: `pi caps profile save <name>`, `pi caps profile load <name>`, `pi caps profile list`

**In scope:** profile CRUD, branch binding (opt-in).
**Out of scope:** sharing profiles across machines (out of project scope per CONTEXT.md).
**Depends on:** v2.2 (state schema stable).

## v2.3-F2 — Token budget [A2]

Goal: "keep me under 10k, prioritise wisely."

- [ ] Per-project budget setting (`.pi/caps-budget.json` or in state file)
- [ ] When over budget: refuse to enable + show what to disable to fit
- [ ] Auto-prioritise mode: rank by frontmatter `priority:` field, fill greedy
- [ ] Status bar shows `4,231 / 10,000 tokens`
- [ ] Warning at 80% of budget

**In scope:** budget enforcement + prioritisation hint.
**Out of scope:** automatic disabling (always user action).
**Depends on:** v2.4-F1 (accurate token counts) ideally — but workable on heuristic.

## v2.3-F3 — Frontmatter tags [A2]

Goal: group toggles by purpose.

- [ ] Parse YAML frontmatter from CAPS files
- [ ] Schema: `tags: [debug, api, style]`, `priority: <number>`, `description: <string>`
- [ ] `/caps-advance tag <name>` toggles all files with tag
- [ ] Show tags as badges in overlay
- [ ] Filter by tag (`#debug` in filter input)

**In scope:** tag parsing, group toggle, filter.
**Out of scope:** tag inheritance, tag conditions (next feature).
**Depends on:** v2.3-F1.

## v2.3-F4 — Frontmatter conditions [A2]

Goal: context auto-enables when context demands it.

- [ ] Schema: `when: { branch: "main", cwd: "/api/*", env: { NODE_ENV: "production" } }`
- [ ] Evaluator (deterministic, no shell exec)
- [ ] Files matching condition auto-toggle on session start
- [ ] Show condition status in overlay (`◑ matched: branch=main`)
- [ ] `/caps-advance conditions` lists all condition matches

**In scope:** declarative, deterministic conditions.
**Out of scope:** arbitrary code/shell evaluation (security boundary).
**Depends on:** v2.3-F3.

## v2.3-F5 — Per-CAPS injection format [A2]

Goal: not every model wants `## Additional Context`. Some prefer XML, some prefer user message.

- [ ] Frontmatter: `inject_as: system | user_message | xml`
- [ ] Default stays `system` (current behaviour)
- [ ] `user_message` route appends to first user message instead of system prompt
- [ ] `xml` wraps in `<context name="X">...</context>`
- [ ] Document tradeoffs (cache, cost) in README

**In scope:** three modes only.
**Out of scope:** arbitrary templating.
**Depends on:** v2.3-F3 (frontmatter parser).

## v2.3 Acceptance Criteria

- `/caps` overlay unchanged for users who don't opt in
- `/caps-advance` discoverable but not intrusive
- Profiles reduce manual toggling by 80% in typical workflow
- Frontmatter schema documented + validated

---

# v2.4 — Cache & Cost

Goal: stop wasting money on cache busts. The audit's biggest gap.

## v2.4-F1 — Accurate token estimation [A1]

Goal: trust the numbers shown.

- [ ] Add `tiktoken` (or `js-tiktoken`) as optional dep
- [ ] Default to heuristic, switch to exact if `tiktoken` installed
- [ ] Code-aware heuristic fallback: detect fenced code blocks, count at 1.5× density
- [ ] Token count cache (invalidate on mtime change)
- [ ] Status bar shows heuristic vs exact mode

**In scope:** estimation accuracy.
**Out of scope:** model-specific tokenisers beyond cl100k (Claude/GPT family).
**Depends on:** v2.1-F2.

## v2.4-F2 — Freeze mode [A2]

Goal: stop cache busts.

- [ ] `/caps-advance freeze` toggle — locks the assembled prompt for the session
- [ ] Subsequent toggles update state but don't take effect until unfreeze + restart
- [ ] Visual indicator in overlay: `❄ FROZEN — toggles deferred`
- [ ] Auto-freeze setting (freeze after first agent turn — opt-in)
- [ ] Display: "frozen for 12 turns · estimated savings vs unfrozen: ~$0.30 SAR"

**In scope:** session-level freeze + savings estimate.
**Out of scope:** cross-session freezing (each session re-evaluates).
**Depends on:** v2.4-F1.

## v2.4-F3 — Folder index injection [A2]

Goal: inject a TOC instead of full folder contents when content is bulky.

- [ ] Per-folder setting (frontmatter on a `.caps-folder.md` index file): `mode: index | full`
- [ ] Index mode: inject file names + first non-empty line each
- [ ] Show indicator in overlay: `◐ index mode (12 files, ~340 tokens vs ~4,800 full)`
- [ ] Per-file override stays available

**In scope:** folder-level injection mode.
**Out of scope:** auto-summarisation via LLM (v3.0 stretch).
**Depends on:** v2.3-F3.

## v2.4-F4 — Cache-bust warnings [A2]

Goal: surface the cost of toggling.

- [ ] Before applying toggle change mid-session, show: "this invalidates 4,231 cached tokens (~$X SAR)"
- [ ] Suppressible per-session
- [ ] Document Anthropic prompt-cache TTL (5min) in README

**In scope:** warning + estimate only.
**Out of scope:** blocking toggles (always user choice).
**Depends on:** v2.4-F1.

## v2.4 Acceptance Criteria

- Token estimates within 10% of actual (measured against real Claude API responses)
- Freeze mode demonstrably reduces cost on benchmark workflow
- Documentation explains cache behaviour for new users

---

# v3.0 — Platform & Ecosystem

Goal: stop being a single-file extension. Become a primitive others build on.

## v3.0-F1 — `/caps-init` scaffolding [A1+A2]

Goal: lower the cold-start barrier.

- [ ] `pi caps init` interactive prompt
- [ ] Templates: `status`, `architecture`, `decisions/`, `style`, `debug-notes`
- [ ] Custom template loader from `~/.pi/CAPS-templates/`
- [ ] Frontmatter pre-filled with `priority`, `tags`, `description`
- [ ] Skip if file exists

**In scope:** scaffolding only, no opinionated content.
**Out of scope:** team-shared templates (per CONTEXT.md: not in scope).
**Depends on:** v2.3-F3 (frontmatter).

## v3.0-F2 — Includes / imports [A2]

Goal: compose without copy-paste.

- [ ] Syntax: `<!-- include: ./NOTES/DECISIONS.md -->` in any CAPS file
- [ ] Resolve at injection time, not at edit time
- [ ] Cycle detection
- [ ] Token count reflects resolved content
- [ ] Show resolved tree in `/caps-prompt`

**In scope:** static includes.
**Out of scope:** glob includes, remote URLs.
**Depends on:** v2.1-F2.

## v3.0-F3 — Public API [A2]

Goal: other extensions can compose with CAPS.

- [ ] Export `discover()`, `loadState()`, `assembleInjection()`, types
- [ ] Document API in README
- [ ] Stability policy: semver from v3.0 onward
- [ ] Example: companion extension that auto-generates STATUS.md from git log

**In scope:** typed public surface.
**Out of scope:** plugin sandboxing.
**Depends on:** v2.1-F2, v2.3-F3.

## v3.0-F4 — Content search [A2]

Goal: find files by content, not just name.

- [ ] `/caps` filter: prefix `:` for content search (`:auth middleware`)
- [ ] Use ripgrep if available, fallback to JS scan
- [ ] Show matched line in preview pane
- [ ] Cache content index, invalidate on file change

**In scope:** local fulltext only.
**Out of scope:** semantic search, embeddings (out per CONTEXT.md).
**Depends on:** v2.2-F4.

## v3.0-F5 — Ephemeral CAPS [A2]

Goal: drop content into pi for one session.

- [ ] `/caps ephemeral <paste content>` — registers a temporary CAPS entry
- [ ] Lives in memory only, not persisted
- [ ] Cleared on pi exit
- [ ] Visible in overlay with `(ephemeral)` tag

**In scope:** session-only memory CAPS.
**Out of scope:** persistence (use a real file instead).
**Depends on:** v2.1-F2.

## v3.0-F6 — Auto-context (opt-in) [A1]

Goal: suggest, never decide.

- [ ] On `before_agent_start`, score CAPS file names + frontmatter `description` + first 50 lines vs user prompt (tf-idf, no external API)
- [ ] Suggestion-only mode (default): `Detected API work. Enable API_DESIGN.md? [y/N]` in startup display
- [ ] Auto-enable mode (explicit opt-in via `/caps-advance auto on`): enables top-k matches above threshold
- [ ] All matches logged to `/caps-doctor`
- [ ] User can dismiss suggestions per-file (sticky)

**In scope:** local scoring, suggestions, opt-in auto.
**Out of scope:** LLM-based scoring (round-trip cost), cross-session learning.
**Depends on:** v2.3-F3, v2.4-F1.

## v3.0 Acceptance Criteria

- Public API documented + semver-stable
- Auto-context is strictly opt-in, never surprises user
- `/caps-init` covers the 5 most common starter files
- Migration guide from v2.x

---

# Cross-Cutting Concerns

These don't fit a single version. Track separately.

## CC-1 — Security boundaries [A2]

- [ ] CAPS file content sanitisation? (decide: no — user owns files, but document risk)
- [ ] Symlink escape protection — v2.1-F3
- [ ] Recursion depth limit — v2.1-F3
- [ ] State file backup before write (keep last 3) — v2.2
- [ ] Document threat model in `SECURITY.md`

## CC-2 — Documentation

- [ ] `CHANGELOG.md` — backfill from git history (v2.1)
- [ ] Troubleshooting section in README (v2.1)
- [ ] Cache behaviour explainer (v2.4)
- [ ] Frontmatter schema reference (v2.3)
- [ ] Migration guide v2→v3 (v3.0)

## CC-3 — Repo hygiene

- [ ] Delete `bash.exe.stackdump` from root
- [ ] Add `.gitignore` entries for stackdumps, `.tmp`, OS junk
- [ ] CI: run tests before publish (currently publishes without testing)
- [ ] Pre-commit hook: lint + test changed files

## CC-4 — Telemetry (opt-in only)

- [ ] Local-only usage log (`~/.pi/caps-usage.jsonl`) — no network
- [ ] `/caps-doctor --usage` shows: most-toggled files, most-loaded profiles, avg tokens per turn
- [ ] Helps user (and future product decisions) without phoning home
- [ ] Strict opt-in, off by default

---

# Killed Ideas (Documented Rejections)

Things explicitly NOT on the roadmap, with reasons:

| Idea | Origin | Why killed |
|---|---|---|
| Team-shared CAPS profiles | A1 | Out of scope per `CONTEXT.md` — single-user tool |
| Semantic retrieval / embeddings | A2 | Out of scope per `CONTEXT.md` |
| Replace CLAUDE.md | A2 | Out of scope per `CONTEXT.md`; complement, don't replace |
| In-overlay markdown rendering | A2 | Terminal complexity, $EDITOR route (v2.2-F5) is simpler |
| LLM-based auto-summarise | A2 | Round-trip cost contradicts the cost-awareness pitch |
| Multi-agent context router | A2 | Vision C — requires pi primitives not in scope |
| Cloud sync of state | NEW | Single-user, terminal-first — local state only |

---

# Three Bets For Next Sprint

v2.1 shipped all three original bets (test harness, `/caps-prompt`, `/caps-doctor`). For v2.2, three highest-impact bets:

1. **Profiles (v2.3-F1) brought forward** — single feature that takes the tool from "manual toggler" to "task context manager". Already-built `/caps-advance` dispatcher in v2.1 makes this small. Highest UX win remaining.
2. **Hot reload on edit (v2.2-F2)** — file watcher already fires; current UX is "restart pi" which is painful. Press `r` in overlay to reload, distinct watcher messages for `added`/`modified`/`deleted`.
3. **State persistence completeness (v2.2-F1)** — sort mode, expanded folders, cursor position should all survive `/caps` close-reopen. Tens of small persistence holes — fix together.

Defer to v2.3+: budgets, tags, conditions, freeze mode, includes, auto-context.
