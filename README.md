# pi-capitals-context

Auto-discovers `ALL_CAPS.md` files in your project and injects them into pi's system prompt.

## What it does

- **Root**: Scans your project root for files like `STATUS.md`, `WORKFLOW.md`, `DESIGN.md`
- **Subdirectories**: When you reference a subdirectory, it loads CAPS files from that subdirectory too
- **Toggle**: Press `ctrl+shift+c` at startup to enable/disable individual files
- **Persistent**: Your toggle choices survive across sessions
- **Skips** `AGENTS.md` and `CLAUDE.md` (already loaded natively)

## Install

```bash
pi install npm:pi-capitals-context
# or from git:
pi install git:github.com/smalibary/pi-capitals-context
```

## Usage

Drop any `ALL_CAPS.md` file in your project root or subdirectories.

```
my-project/
├── STATUS.md       ← project status, always in context
├── DESIGN.md       ← architecture decisions
├── WORKFLOW.md     ← team conventions and processes
├── STYLE.md        ← coding or writing style rules
├── SECRETS.md      ← environment and config notes
├── MGMT5701/
│   └── RULES.md    ← loaded when you mention MGMT5701
└── ACCT5906/
    └── GUIDE.md    ← loaded when you mention ACCT5906
```

## Examples

Use it for anything you want the agent to always know:

- `STATUS.md` — current project status, blockers, sprint goals
- `DESIGN.md` — architecture decisions, tech stack, system design
- `WORKFLOW.md` — git conventions, PR process, deployment steps
- `STYLE.md` — code style, writing tone, formatting rules
- `SECRETS.md` — env variable names, config keys (values only locally)
- `CONSTRAINTS.md` — limitations, budgets, deadlines
- `CONTEXT.md` — domain knowledge, glossary, acronyms
- `TODO.md` — outstanding tasks and priorities

## Filename rules

- ALL uppercase letters, numbers, and underscores
- `.md` extension
- Valid: `STATUS.md`, `DESIGN.md`, `MY_RULES.md`, `STYLE_GUIDE.md`

## Toggle files

At startup, press `ctrl+shift+c` to open the toggler overlay. Use ↑↓ to navigate, space to toggle, enter/esc to close. State persists in `.pi/caps-context-state.json`.
