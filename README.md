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

Skips `AGENTS.md` and `CLAUDE.md` (already loaded natively by pi).

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
