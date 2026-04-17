# pi-capitals-context

Auto-discovers `ALL_CAPS.md` files and `ALL_CAPS/` folders in your project and injects them into pi's system prompt.

## What it does

- **Root files**: Scans for `ALL_CAPS.md` files like `STATUS.md`, `WORKFLOW.md`, `DESIGN.md`
- **Root folders**: Scans for `ALL_CAPS/` folders like `RULES/`, `MEMORY/`, `CONTEXT/` — all `.md` files inside are loaded
- **Subdirectories**: When you reference a subdirectory, it loads CAPS files from that subdirectory too
- **Toggle**: Press `ctrl+shift+c` at startup to enable/disable individual files or folders
- **Persistent**: Your toggle choices survive across sessions
- **Skips** `AGENTS.md` and `CLAUDE.md` (already loaded natively)

## Install

```bash
pi install npm:pi-capitals-context
# or from git:
pi install git:github.com/smalibary/pi-capitals-context
```

## Usage

Drop any `ALL_CAPS.md` file or `ALL_CAPS/` folder in your project root.

```
my-project/
├── STATUS.md               ← single file, loaded individually
├── DESIGN.md               ← single file, loaded individually
├── STYLE.md                ← single file, loaded individually
├── RULES/                  ← ALL_CAPS folder, ALL .md inside loaded
│   ├── typescript.md       ← any filename works inside CAPS folder
│   ├── git-conventions.md
│   └── code-review.md
├── MEMORY/                 ← ALL_CAPS folder
│   ├── decisions.md
│   └── lessons-learned.md
├── CONTEXT/                ← ALL_CAPS folder
│   ├── glossary.md
│   ├── acronyms.md
│   └── domain.md
├── src/
│   └── RULES.md            ← loaded when you mention src/
└── api/
    └── GUIDE.md            ← loaded when you mention api/
```

## Single file examples

| File | Use for |
|---|---|
| `STATUS.md` | Project status, blockers, sprint goals |
| `DESIGN.md` | Architecture decisions, tech stack, system design |
| `WORKFLOW.md` | Git conventions, PR process, deployment steps |
| `STYLE.md` | Code style, writing tone, formatting rules |
| `CONSTRAINTS.md` | Limitations, budgets, deadlines |
| `TODO.md` | Outstanding tasks and priorities |

## Folder examples

| Folder | Use for |
|---|---|
| `RULES/` | Coding standards, git rules, review checklist |
| `MEMORY/` | Past decisions, lessons learned, meeting notes |
| `CONTEXT/` | Domain knowledge, glossary, acronyms, onboarding |
| `API/` | Endpoint docs, schemas, auth flows |
| `TEMPLATES/` | Reusable patterns, boilerplate, snippets |
| `SECRETS/` | Env variable names, config keys (values only locally) |

## Filename rules

- Files: `ALL_CAPS.md` — uppercase letters, numbers, underscores
- Folders: `ALL_CAPS/` — same pattern, any `.md` files inside are included
- Valid: `STATUS.md`, `DESIGN.md`, `MY_RULES.md`, `STYLE_GUIDE.md`
- Valid folders: `RULES/`, `MEMORY/`, `API/`, `CONTEXT/`

## Token counts

Each file and folder shows an estimated token count so you can decide what's worth including. The total is displayed at the bottom.

```
[CAPS Context]
  STATUS.md · 257 tokens
  DESIGN.md · 640 tokens
  RULES/ · 129 tokens
  API/ · 345 tokens
  total: 1.4k tokens
  ctrl+shift+c to toggle
```

Helps you stay within context limits by seeing exactly what each item costs.

## Toggle files and folders

At startup, press `ctrl+shift+c` to open the toggler overlay. Use ↑↓ to navigate, space to toggle, enter/esc to close. Folders toggle as a whole — all files inside are on or off together. State persists in `.pi/caps-context-state.json`.
