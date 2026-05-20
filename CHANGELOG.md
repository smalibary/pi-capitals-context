# Changelog

All notable changes to `pi-capitals-context`.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] — 2026-05-20

UI-first redesign. Every user action now ships as an **Overlay** first;
typed slash-command arguments are a scripting fallback. Three primary
slash commands cover everything: `/caps`, `/caps-profile`, `/caps-settings`.

### Added
- **`/caps-profile`** — named snapshots of project toggles, overlay-first UX:
  - **Picker overlay** — `/caps-profile` (no args) opens a list with
    `+ Create new profile` at the top followed by saved profiles. ↑↓ to
    navigate, Enter to load (existing) or start the create flow, `d` twice
    to delete a profile, Esc to quit. Inline diff preview shows what each
    profile would change vs current toggles.
  - **Create flow** — picking "Create new" chains into the `/caps` file
    picker (toggle the files you want in this profile, Enter to confirm),
    then a name-input overlay (type, Enter to save, Esc to discard).
    Discarding restores the toggle state from before the flow.
  - **Typed shortcuts** still work: `save <name>`, `load <name> [--dry-run]`,
    `rename <old> <new>`, `list`. Stored in `.pi/caps-profiles.json`.
    Project-scoped; Global CAPS toggles unchanged. (v2.3-F1 pulled forward.)
- **Legacy `/caps-advance profile *`** — same dispatcher path still works
  during the transition; will be removed once `/caps-skip` ships and the
  `/caps-advance` umbrella is retired.
- **Profile rename + edit (v2.2-F2)** — completes the `/caps-profile`
  overlay CRUD surface:
  - `r` on a profile row → opens a name-input overlay pre-filled with
    the current name. Enter saves the rename; Esc keeps the current
    name. Validation rejects collisions with other profile names.
  - `e` on a profile row → loads the profile into the current session,
    opens the `/caps` file picker for editing, then writes the new
    toggles back into the same profile on Enter. No discard path for
    edit by design — your in-session toggles are the source of truth.
- **`/caps-settings` Settings Hub + Skip overlay (v2.2-F3)** — the
  architectural pivot that retires the `/caps-advance` dispatcher.
  - `/caps-settings` opens a hub overlay listing the project's
    non-daily-driver actions. First row is "Skip list" (active);
    "Prompt preview", "Diagnose / Doctor", and "Configuration" are
    visible stubs that say "coming soon" with a hint about which
    phase they land in (F4, F5).
  - **Skip overlay**: top row `+ Add entry` chains a name-input
    overlay; entry rows take `d` twice to remove; `R` twice resets
    to defaults. Shows whether the current list is the built-in
    defaults or a project override.
  - Legacy `/caps-advance skip *` still works as a typed fallback.
- **Prompt-preview overlay (v2.2-F4)** + **Doctor overlay (v2.2-F5)**
  — both Settings Hub rows are now active, both reuse the existing
  `buildPromptPreview` / `buildDoctorReport` helpers as content:
  - **Prompt preview**: scrollable view of the assembled injection.
    `↑↓` line scroll, `PgUp/PgDn` page scroll, `g`/`G` top/bottom,
    `c` copies the injection to clipboard, `p` toggles diff-vs-
    previous-turn (only when a previous turn exists).
  - **Doctor**: scrollable diagnostic report. Same scroll keys;
    `v` toggles verbose mode in-place (no separate command).
- `MAINTAINING.md` — single-file guide covering doc inventory, when to split
  into `docs/`, per-file update rules, screenshot conventions (including the
  new overlay screenshot rule), diagram policy, doc-rot checklist. Linked
  from `ROADMAP.md` Release Procedure.

### Changed
- **Command surface re-shaped to three primary entry points:** `/caps`
  (file toggling, unchanged), `/caps-profile` (full **Profile** CRUD via
  overlay), `/caps-settings` (everything else). Per the UI-First Rule
  documented in `CLAUDE.md`, typed slash commands are kept as scripting
  fallbacks once an overlay exists for their function — so
  `/caps-prompt [--copy] [--diff]`, `/caps-doctor [--verbose]`, and
  `/caps-advance skip|profile *` all still work and route through the
  same handlers, but `/caps-settings` is now the primary discovery path.
- Default `skipFiles` now also includes `MAINTAINING.md` and `ROADMAP.md`
  (planning/maintenance docs, like LICENSE/CHANGELOG, should not auto-inject
  into CAPS context). Override via the Skip overlay (`/caps-settings →
  Skip list`) or the typed `/caps-advance skip remove <name>` fallback.

### Internal
- **UI-First Rule** documented in `CLAUDE.md` — defines when new actions
  should ship as overlays vs typed commands; `Overlay` and `Settings Hub`
  added as canonical terms in `CONTEXT.md` with a `## Design philosophy`
  section that supersedes the earlier dispatcher-style design.
- **ROADMAP** v2.2 section re-scoped around the UI-first plan (F1–F6).
  Items deferred from the earlier v2.2 plan (state persistence completeness,
  watcher upgrades, fuzzy nav, editor integration) noted as carry-overs.
- **Test suite grew from 99 → 213** across 17 files. New tested modules:
  `profiles`, `profile-overlay`, `name-input-overlay`, `settings-overlay`,
  `skip-overlay`, `prompt-overlay`, `doctor-overlay`. Coverage remains
  ~30% lines / ~88% branches on covered code; the gap is still the
  pre-existing `CapsSelector` overlay UI which needs a fake-terminal
  harness.

## [2.1.0] — 2026-05-20

### Added
- **`/caps-doctor`** — diagnose CAPS discovery, state file, watchers, last
  injection size, config sources. `--verbose` lists every entry in cwd with
  inclusion/skip reason.
- **`/caps-prompt`** — show the exact text that gets injected into the system
  prompt, with per-file byte + token counts. Flags: `--copy` pipes to OS
  clipboard, `--diff` shows line-diff vs previous turn's injection
  (cache-bust awareness).
- **`/caps-advance skip`** — manage the project skip list from inside pi:
  `list`, `add <name>`, `remove <name>`, `reset`. Writes to
  `.pi/caps-config.json` atomically. First subcommand of `/caps-advance`;
  more subcommands (profiles, budgets, tags) coming in v2.3.
- **Config file** at `.pi/caps-config.json` (project) and
  `~/.pi/caps-config.json` (global). Schema: `skipFiles`, `skipDirs`,
  `capsFilePattern`, `capsDirPattern`, `textExtensions`, `maxFileSizeBytes`,
  `maxRecursionDepth`, `maxSubdirFiles`. Project overrides global overrides
  built-in defaults.
- **Empty-CAPS startup hint** — when no CAPS files are discovered, pi shows
  a one-line nudge pointing at `/caps-doctor`.
- **`[CAPS Context — LOCAL DEV]`** indicator — auto-distinguishes a local
  dev checkout from an npm install (via `import.meta.url`). Clean label on
  npm; suffix on local.
- **Vitest test harness** (98 tests across 10 files). CI gates npm publish
  on tests passing.
- **`CHANGELOG.md`** (this file) and per-feature `ROADMAP.md`.

### Changed
- **Default skip list expanded** to include `LICENSE`, `LICENSE.md`,
  `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md` (previously only `AGENTS.md` + `CLAUDE.md`). Override via
  `/caps-advance skip remove <name>` or the config file.
- **Default skip dirs** expanded to include `node_modules`, `.git`, `.pi`.
- **Modular refactor**: 719-line `extensions/index.ts` split into 11 modules
  under `src/` (`types`, `tokens`, `state`, `discovery`, `injection`,
  `overlay`, `env`, `config`, `config-writer`, `clipboard`, `diff`, `doctor`).
  No behavior change.
- **Subdir-loaded files now toggleable** in `/caps` and their toggle state
  persists across sessions.

### Fixed
- **`extractSubdirs` loose match**: prose mentions like *"check the public
  library"* no longer auto-load `lib/` via substring match. Explicit path
  refs (`lib/foo`) still work.
- **Permanent `/caps` lock removed**: previously the overlay refused to open
  after the first agent message. Now opens any time.
- **Subdir array unbounded growth**: `subdirFiles` capped at
  `maxSubdirFiles` (default 20), oldest evicted.

### Security / Defense
- **File-size cap** (`maxFileSizeBytes`, default 100KB) — refuses oversized
  files instead of silently bloating the prompt.
- **Recursion depth limit** (`maxRecursionDepth`, default 6) — prevents
  pathological monorepo scans.
- **Symlink refusal** — symlinks in CAPS scans are skipped; symlinked files
  are refused by `readFileContent`. Defends against accidental
  out-of-project content (`/etc/shadow` style).

### Deprecated
- The flat-export of internals from `extensions/index.ts` (e.g., re-exporting
  `CAPS_FILE_RE`, `validateState`). Import from `src/<module>.js` instead.

### Internal
- New `src/` module structure with one-way dependency graph.
- New tests: `config.test.ts`, `config-writer.test.ts`, `discovery.test.ts`,
  `injection.test.ts`, `diff.test.ts`, `doctor.test.ts`.
- CI: `.github/workflows/ci.yml` runs on every push/PR;
  `.github/workflows/publish.yml` gated on tests passing before publish.

## [2.0.0] — 2025-05-19

Initial v2 release. See README for feature summary. Notable: `/caps` overlay
with sort, filter, preview, folder collapse; global `~/.pi/CAPS/`; subdir
auto-load; atomic state writes.
