# Changelog

All notable changes to `pi-capitals-context`.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- `MAINTAINING.md` — single-file guide covering doc inventory, when to split
  into `docs/`, per-file update rules, screenshot conventions, diagram policy,
  doc-rot checklist. Linked from `ROADMAP.md` Release Procedure.

### Changed
- Default `skipFiles` now also includes `MAINTAINING.md` and `ROADMAP.md`
  (planning/maintenance docs, like LICENSE/CHANGELOG, should not auto-inject
  into CAPS context). Override via `/caps-advance skip remove <name>` if you
  want either as context.

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
