# pi-capitals-context

A pi extension that lets a solo developer maintain a personal library of context files and selectively inject them into the AI's system prompt — solving the problem that CLAUDE.md is always-on, monolithic, and offers no cost control or personal variation.

## Language

**CAPS File**:
A discoverable context file — either an `ALL_CAPS.md` at the project root, or any supported file type inside a **CAPS Folder**.
_Avoid_: context file, markdown file, caps doc

**CAPS Folder**:
An `ALL_CAPS/` directory whose contents are each individually toggleable. Acts as a named group of **CAPS Files**.
_Avoid_: folder, directory, caps directory

**Project CAPS**:
**CAPS Files** and **CAPS Folders** found within a specific project directory. Scoped to that project only.
_Avoid_: local caps, repo caps

**Global CAPS**:
**CAPS Files** and **CAPS Folders** at `~/.pi/CAPS/`. Loaded in every project. Represents personal developer defaults, not project knowledge.
_Avoid_: user caps, shared caps

**Toggle**:
The act of marking a **CAPS File** as enabled or disabled. Enabled files are injected; disabled files are discovered but skipped.
_Avoid_: enable/disable (use "toggle on" / "toggle off" when direction matters)

**State**:
The persisted record of which **CAPS Files** are toggled on or off. Stored per-project in `.pi/caps-context-state.json`. Personal and not version-controlled.
_Avoid_: config, settings, preferences

**Session**:
A single run of pi from startup to shutdown. **State** is loaded at session start and saved at session end. File content is not reloaded mid-session.
_Avoid_: run, instance

**Injection**:
The act of appending enabled **CAPS File** content verbatim to the AI's system prompt before each agent run.
_Avoid_: loading, sending, feeding

**Token Budget**:
The estimated token cost of all currently enabled **CAPS Files**, shown to help the user make enable/disable decisions consciously.
_Avoid_: token count, token usage

**Subdir CAPS**:
**CAPS Files** discovered in subdirectories of the project root when a prompt or tool call references that subdir with a path (e.g., `docs/X`). Auto-loaded with `enabled: true`, but **toggleable** like a **Root CAPS File**, and **State** persists.
_Avoid_: auto-loaded files, deep caps, nested caps

**Root CAPS**:
**CAPS Files** at the project root (`STATUS.md`) or inside a **CAPS Folder** at the root (`DECISIONS/X.md`). Distinguished from **Subdir CAPS** by being known at session start without prompt-driven discovery.
_Avoid_: top-level caps, primary caps

**Config File**:
`.pi/caps-config.json` (project-scoped) or `~/.pi/caps-config.json` (user-scoped). Holds the **Skip List**, regex patterns for **CAPS File** matching, and defensive limits (`maxFileSizeBytes`, `maxRecursionDepth`, `maxSubdirFiles`). Project overrides global overrides built-in defaults.
_Avoid_: settings file, options file, preferences

**Skip List**:
Set of filenames the discoverer refuses to treat as **CAPS Files**, even if they match the **CAPS File** regex. Defaults to noise (`LICENSE`, `README.md`, `CHANGELOG.md`, etc.). Overridable per project via `/caps-advance skip` or the **Config File**.
_Avoid_: ignore list, blacklist, exclusion list

**Doctor**:
A diagnostic command (`/caps-doctor`) that reports cwd, **State** file location and validity, watcher count, last **Injection** size, every entry in the project directory with classification (included vs skipped + reason), and which **Config File** overrides are active. The primary "why isn't this loading?" tool.
_Avoid_: debug, diagnostics

**Profile**:
A named snapshot of **Toggle** decisions for a project, persisted to `.pi/caps-profiles.json`. Loading a **Profile** restores the captured toggles and overwrites the current **State**. Project-scoped only — **Global CAPS** toggles are not part of a **Profile**.
_Avoid_: preset, mode, layout

## Relationships

- A **CAPS Folder** contains one or more **CAPS Files**
- A **CAPS File** belongs to either **Project CAPS** or **Global CAPS**, never both
- **Global CAPS** files are always loaded alongside **Project CAPS** files in every session
- **Root CAPS** are known at session start; **Subdir CAPS** are discovered during a session via prompt-driven path references
- **State** is per-project for **Project CAPS** + **Subdir CAPS**, per-user (`~/.pi/`) for **Global CAPS**
- **Injection** happens once per agent run, using the **State** at that moment
- **Skip List** decisions are filter-level — affected files are not discovered, not just disabled
- **Config File** lookup order: built-in defaults < global < project; project always wins
- A **Profile** captures **State** at a moment in time and is replayed on load; **Profile** storage is separate from **State** storage
- CLAUDE.md is outside this system — always-on, not a **CAPS File**, never toggled

## What this is NOT

- **Not a replacement for CLAUDE.md** — CLAUDE.md handles always-on, project-wide instructions. CAPS files are the optional, toggleable layer on top.
- **Not a RAG or semantic retrieval system** — injection is verbatim and user-curated. The AI does not decide what gets loaded.
- **Not a team collaboration tool** — state is personal and per-machine. No sync, no sharing, no access control.
- **Not a doc writing or editing tool** — the extension manages existing files. Creating or editing the docs themselves is out of scope.
- **Not an AI-managed memory system** — the user decides what goes in CAPS files and when. The extension only discovers and injects.

## Example dialogue

> **Dev:** "I want my personal coding preferences loaded in every project — where do those go?"
> **Domain expert:** "That's **Global CAPS** — put them in `~/.pi/CAPS/MY_STYLE.md`. They'll be available in every project alongside your **Project CAPS** files."

> **Dev:** "Can I disable DESIGN.md just for this session without deleting it?"
> **Domain expert:** "Yes — **toggle** it off via `/caps`. The **State** records it as disabled. It stays discovered, just not injected."

> **Dev:** "Why can't I just put everything in CLAUDE.md?"
> **Domain expert:** "CLAUDE.md is always-on — every token, every run. CAPS files let you control the **Token Budget** and switch context based on what you're working on right now."

## Flagged ambiguities

- "context" is used informally to mean both a **CAPS File** (the document) and the injected content in the system prompt — resolved: use **CAPS File** for the document, **Injection** for the act, "system prompt context" only when referring to the AI's perspective.
- "global" was used loosely to mean both "available everywhere" and "team-shared" — resolved: **Global CAPS** means user-level (`~/.pi/`), not team-shared. Team sharing is explicitly out of scope.
