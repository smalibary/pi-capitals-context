# pi-capitals-context

Auto-discovers `ALL_CAPS` files and folders in your project and injects them into pi's system prompt as context. Toggle individual files, preview content, search, sort — all from a `/caps` overlay.

## Install

```bash
pi install npm:pi-capitals-context
```

## What it loads

| Source | Example | Notes |
|--------|---------|-------|
| Root CAPS files | `STATUS.md`, `DESIGN.md` | Individually toggleable |
| Root CAPS folders | `RULES/`, `CONTEXT/` | Each file inside is individually toggleable |
| Global folder | `~/.pi/CAPS/` | Loaded in every project |
| Subdirectories | `src/GUIDE.md` | Auto-loaded when you reference that folder |

Skips noise by default: `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `LICENSE.md`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`. Per-project override via `/caps-advance skip add/remove` or `.pi/caps-config.json`. See [Configuration](#configuration).

## Supported file types

Inside CAPS folders: `.md`, `.txt`, `.yaml`, `.yml`, `.json`, `.toml`

Root-level CAPS files: `.md` only (e.g. `STATUS.md`, `DESIGN.md`)

## Project structure example

```
my-project/
├── STATUS.md               ← loaded individually
├── DESIGN.md               ← loaded individually
├── RULES/                  ← CAPS folder — each file toggleable separately
│   ├── typescript.md
│   ├── git-conventions.md
│   └── code-review.md
├── CONTEXT/                ← CAPS folder — supports mixed file types
│   ├── glossary.md
│   ├── config.yaml
│   └── schema.json
├── src/
│   └── GUIDE.md            ← auto-loaded when you reference src/
└── api/
    └── SPEC.md             ← auto-loaded when you reference api/
```

## Global context

Files in `~/.pi/CAPS/` are loaded in every project — useful for personal preferences, identity, or cross-project rules:

```
~/.pi/CAPS/
├── IDENTITY.md       ← who you are, role, language preferences
├── WORK_STYLE.md     ← how you like to work with AI
└── STANDARDS/
    ├── writing.md
    └── code.md
```

## /caps overlay

Type `/caps` to open the context manager. Features:

### Folder collapse / expand
Folders start collapsed. Navigate to a folder row and press space to expand it and see individual files. Press space again on the expanded header to toggle all files at once. Press `←` to collapse.

```
  ▶ ◑ RULES/ (3 files)        ← collapsed, space to expand
  ☑ STATUS.md · 45 tokens

  ▼ ◑ RULES/ (3 files)        ← expanded, space toggles all, ← collapses
    ☑ typescript.md · 32 tokens
    ☑ git-conventions.md · 28 tokens
    ☐ code-review.md · 41 tokens
  ☑ STATUS.md · 45 tokens
```

### Sort
Navigate to the `⇅ Sort:` row and press space to cycle through:
- `default` — discovery order
- `a–z` — alphabetical
- `tokens↓` — heaviest files first

### Search / filter
Start typing anywhere to filter the list. The list narrows live. Press `⌫` to erase. Press `Esc` to clear the filter.

### Preview panel
When your terminal is wide enough (≥74 cols), hovering a file opens a side panel showing its content with line numbers. Long files show top lines, a `── N lines ──` separator, and bottom lines.

Hovering a folder header shows a summary of all files inside with their token counts.

### Navigation
| Key | Action |
|-----|--------|
| `↑↓` | Navigate |
| `space` | Expand/collapse folder · toggle file · cycle sort |
| `←` | Collapse expanded folder |
| `esc` | Clear filter (if active) · close overlay |
| Type anything | Filter list |
| `⌫` | Erase filter character |

## File watcher

While pi is running, if you edit a CAPS file it detects the change and shows:

```
⚠  STATUS.md changed · restart to reload
```

Content isn't updated mid-session to avoid corrupting context — restart pi to pick up changes.

## Token counts

Token estimates use a word-based heuristic (more accurate than character counting). Each file shows its cost, and the overlay shows a running total.

```
[CAPS Context]
  STATUS.md · 45 tokens
  RULES/typescript.md · 32 tokens
  RULES/git-conventions.md · 28 tokens
  total: 105 tokens
  /caps to toggle
```

## State persistence

Toggle choices are saved per-project in `.pi/caps-context-state.json` using atomic writes (safe against crashes). The file is per-project and not version-controlled.

## Filename rules

- Root files: `ALL_CAPS.md` — uppercase letters, numbers, underscores only
- Folders: `ALL_CAPS/` — same naming, any supported file type inside
- Valid: `STATUS.md`, `MY_RULES.md`, `STYLE_GUIDE_V2.md`
- Valid folders: `RULES/`, `MEMORY/`, `API/`, `CONTEXT/`

## Single file ideas

| File | Use for |
|------|---------|
| `STATUS.md` | Current sprint, blockers, recent decisions |
| `DESIGN.md` | Architecture, tech stack, system design |
| `WORKFLOW.md` | Git conventions, PR process, deployment |
| `STYLE.md` | Code style, tone, formatting rules |
| `CONSTRAINTS.md` | Limitations, budgets, non-negotiables |
| `TODO.md` | Outstanding tasks and priorities |

## Folder ideas

| Folder | Use for |
|--------|---------|
| `RULES/` | Coding standards, review checklist |
| `MEMORY/` | Past decisions, lessons learned |
| `CONTEXT/` | Domain knowledge, glossary, onboarding |
| `API/` | Endpoint docs, schemas, auth flows |
| `TEMPLATES/` | Reusable patterns, boilerplate |

## Keybinding

To bind a custom shortcut to `/caps`, add to `~/.pi/agent/keybindings.json`:

```json
{
  "bindings": [
    { "key": "ctrl+shift+c", "command": "caps" }
  ]
}
```

## Commands

| Command | What it does |
|---|---|
| `/caps` | Toggle overlay — root, subdir, and global CAPS files. Daily driver. |
| `/caps-profile` | Overlay picker for saved toggle profiles. Top row is `+ Create new profile` — picking it chains into the `/caps` file picker, then a name-input overlay (Enter saves, Esc discards & restores toggles). Existing profile rows: Enter loads, `e` edits (loads → `/caps` → saves back), `r` renames (name-input pre-filled), `d` twice deletes, Esc quits. Project-scoped; Global CAPS toggles untouched. |
| `/caps-settings` | Settings Hub overlay — rows for Skip list (active), Prompt preview (stub, v2.2-F4), Diagnose / Doctor (stub, v2.2-F5), Configuration (stub). Enter opens a row, Esc quits. |
| `/caps-advance skip <list\|add\|remove\|reset>` | Legacy typed surface for skip list — retires once the overlay path stabilises. Use `/caps-settings → Skip list` instead. |
| `/caps-prompt` | Print the exact text that gets injected into the system prompt. `--copy` pipes to clipboard, `--diff` shows line-diff vs previous turn. Trust check. |
| `/caps-doctor` | Diagnose discovery, state file, watchers, last injection, config sources. `--verbose` shows every entry in cwd with classification. |

### Profiles (typed shortcuts)

- `/caps-profile save <name>` — capture current toggles into a named profile
- `/caps-profile load <name> [--dry-run]` — apply profile (or preview with `--dry-run`)
- `/caps-profile rename <old> <new>` — rename a profile
- `/caps-profile list` — print profile names (text fallback)

Profiles persist to `.pi/caps-profiles.json` (atomic write). Loading applies immediately and persists project state — no pi restart needed.

Each command supports `help` (e.g. `/caps-doctor help`) for inline usage.

## Configuration

Defaults work for most projects. Override per-project at `.pi/caps-config.json`, or globally at `~/.pi/caps-config.json`. Project wins over global wins over built-in defaults.

Example — re-include `LICENSE.md` and `README.md` as context (research repo where license terms matter):

```json
{
  "skipFiles": ["AGENTS.md", "CLAUDE.md"]
}
```

Full schema (all fields optional):

| Field | Type | Default |
|---|---|---|
| `skipFiles` | string[] | `["AGENTS.md","CLAUDE.md","LICENSE","LICENSE.md","README.md","CHANGELOG.md","CONTRIBUTING.md","CODE_OF_CONDUCT.md","SECURITY.md"]` |
| `skipDirs` | string[] | `["AGENTS","CLAUDE","NODE_MODULES","node_modules",".git",".pi"]` |
| `capsFilePattern` | string (regex) | `"^[A-Z][A-Z0-9_]*\\.md$"` |
| `capsDirPattern` | string (regex) | `"^[A-Z][A-Z0-9_]*$"` |
| `textExtensions` | string[] | `[".md",".txt",".yaml",".yml",".json",".toml"]` |
| `maxFileSizeBytes` | number | `102400` (100KB) |
| `maxRecursionDepth` | number | `6` |
| `maxSubdirFiles` | number | `20` |

Invalid values (e.g. unparseable regex, negative numbers) fall back to defaults silently — the tool stays loadable.

Changes take effect on pi restart (config is read at session_start).

## Troubleshooting

When a file you expected to load isn't appearing, run `/caps-doctor`. It tells you:

- Whether the project directory was scanned correctly
- Which entries were skipped and why (regex mismatch, in skip list, too large, symlink)
- Where the state file lives and whether it loaded
- Whether any config override is active
- Last injection size + tokens

`/caps-doctor --verbose` lists every file in the cwd with `✓`/`✗` classification.

Common cases:
- *"My file is `notes.md` but doesn't load."* → filename must be ALL-CAPS (`NOTES.md`).
- *"`LICENSE.md` shouldn't be excluded for my project."* → `/caps-advance skip remove LICENSE.md`, restart pi.
- *"Tool seems to ignore my edit."* → file watcher only notifies; you must restart pi to reload content.
- *"`/caps-prompt` shows nothing."* → no files enabled or no CAPS files exist. Run `/caps-doctor`.
