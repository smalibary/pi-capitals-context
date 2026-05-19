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

## Relationships

- A **CAPS Folder** contains one or more **CAPS Files**
- A **CAPS File** belongs to either **Project CAPS** or **Global CAPS**, never both
- **Global CAPS** files are always loaded alongside **Project CAPS** files in every session
- **State** is per-project for **Project CAPS** and per-user (`~/.pi/`) for **Global CAPS**
- **Injection** happens once per agent run, using the **State** at that moment
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
