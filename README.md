# pi-capitals-context

Auto-discovers `ALL_CAPS.md` files in your project and injects them into pi's system prompt.

## What it does

- **Root**: Scans your project root for files like `NOTES.md`, `TODO.md`, `RULES.md`
- **Subdirectories**: When you reference a subdirectory, it loads CAPS files from that subdirectory too
- **Skips** `AGENTS.md` and `CLAUDE.md` (already loaded natively)

## Install

```bash
pi install npm:pi-capitals-context
# or from git:
pi install git:github.com/YOUR_USERNAME/pi-capitals-context
```

## Usage

Just drop any `CAPS_NAMED.md` file in your project root or subdirectories.

```
my-project/
├── NOTES.md        ← loaded automatically
├── TODO.md         ← loaded automatically
├── MGMT5701/
│   └── RULES.md    ← loaded when you mention MGMT5701
└── ACCT5906/
    └── GUIDE.md    ← loaded when you mention ACCT5906
```

## Filename rules

- ALL uppercase letters, numbers, and underscores
- `.md` extension
- Examples: `NOTES.md`, `TODO.md`, `MY_RULES.md`, `STYLE_GUIDE.md`
