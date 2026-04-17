/**
 * Capitals Context Extension
 *
 * Finds ALL CAPS markdown files and injects their contents into the system prompt.
 *
 * - /caps command or ctrl+shift+c opens interactive overlay toggler
 * - Toggle state persists between sessions (.pi/caps-context-state.json)
 * - Skips AGENTS.md and CLAUDE.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth, type Theme } from "@mariozechner/pi-tui";

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);
const STATE_FILE = "caps-context-state.json";

interface FileEntry {
	relativePath: string;
	content: string;
	enabled: boolean;
}

// ── File discovery ───────────────────────────────────────────

function findCapsFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	try {
		return fs.readdirSync(dir)
			.filter((name) => CAPS_FILE_RE.test(name) && !SKIP_FILES.has(name))
			.map((name) => path.join(dir, name))
			.filter((fp) => { try { return fs.statSync(fp).isFile(); } catch { return false; } });
	} catch { return []; }
}

function readFileContent(fp: string, cwd: string): { relativePath: string; content: string } | null {
	try {
		return { relativePath: path.relative(cwd, fp).replace(/\\/g, "/"), content: fs.readFileSync(fp, "utf-8") };
	} catch { return null; }
}

function extractSubdirs(text: string, cwd: string): Set<string> {
	const dirs = new Set<string>();
	let realDirs: string[] = [];
	try { realDirs = fs.readdirSync(cwd, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
	catch { return dirs; }

	const re = /(?:\.?[/\\])?([A-Za-z0-9_-]+)[/\\][\w./\\-]+/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		if (realDirs.includes(m[1])) dirs.add(path.join(cwd, m[1]));
	}
	const lower = text.toLowerCase();
	for (const d of realDirs) {
		if (lower.includes(d.toLowerCase())) dirs.add(path.join(cwd, d));
	}
	return dirs;
}

// ── State persistence ────────────────────────────────────────

function loadState(cwd: string): Record<string, boolean> {
	try { return JSON.parse(fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8")); }
	catch { return {}; }
}

function saveState(cwd: string, files: FileEntry[]) {
	const dir = path.join(cwd, ".pi");
	try { fs.mkdirSync(dir, { recursive: true }); } catch {}
	const state: Record<string, boolean> = {};
	for (const f of files) state[f.relativePath] = f.enabled;
	fs.writeFileSync(path.join(dir, STATE_FILE), JSON.stringify(state, null, "\t"));
}

// ── Overlay selector ─────────────────────────────────────────

class CapsSelector {
	private items: FileEntry[];
	private cursor = 0;
	private theme: Theme;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onDone?: () => void;

	constructor(items: FileEntry[], theme: Theme) {
		this.items = items;
		this.theme = theme;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.invalidate();
		} else if (matchesKey(data, Key.down)) {
			if (this.cursor < this.items.length) this.cursor++;
			this.invalidate();
		} else if (matchesKey(data, Key.space)) {
			if (this.cursor === 0) {
				const anyOn = this.items.some(f => f.enabled);
				for (const f of this.items) f.enabled = !anyOn;
			} else {
				this.items[this.cursor - 1].enabled = !this.items[this.cursor - 1].enabled;
			}
			this.invalidate();
		} else if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
			this.onDone?.();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const t = this.theme;
		const lines: string[] = [];

		// Blank line for spacing
		lines.push("");

		// Header
		const allOn = this.items.every(f => f.enabled);
		const noneOn = this.items.every(f => !f.enabled);
		const allCheck = allOn ? "☑" : noneOn ? "☐" : "◑";
		lines.push(t.fg("accent", `  ${allCheck} [CAPS Context]`));

		// Toggle all
		const pre = this.cursor === 0 ? "> " : "  ";
		lines.push(truncateToWidth(`${pre}${allCheck} Toggle all`, width));

		// Files
		for (let i = 0; i < this.items.length; i++) {
			const f = this.items[i];
			const p = this.cursor === i + 1 ? "> " : "  ";
			const c = f.enabled ? "☑" : "☐";
			const line = `${p}${c} ${f.relativePath}`;
			lines.push(truncateToWidth(f.enabled ? line : t.fg("dim", line), width));
		}

		// Disabled count
		const off = this.items.filter(f => !f.enabled).length;
		if (off > 0) {
			lines.push(t.fg("dim", `  ${off} file${off > 1 ? "s" : ""} not in context`));
		}

		lines.push("");
		lines.push(t.fg("dim", "  ↑↓ navigate · space toggle · enter/esc done"));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ── Widget (normal chat view) ────────────────────────────────

function updateWidget(ctx: any, files: FileEntry[]) {
	if (!ctx.hasUI || files.length === 0) return;

	ctx.ui.setWidget("caps-context", (_tui: any, theme: Theme) => {
		const lines: string[] = [];

		// Blank line for spacing
		lines.push("");

		// Header
		lines.push(theme.fg("accent", "[CAPS Context]") + theme.fg("dim", "  /caps to toggle"));

		// Only show enabled files
		for (const f of files) {
			if (f.enabled) {
				lines.push(theme.fg("muted", `  ${f.relativePath}`));
			}
		}

		// If any disabled, show count
		const off = files.filter(f => !f.enabled).length;
		if (off > 0) {
			lines.push(theme.fg("dim", `  ${off} file${off > 1 ? "s" : ""} not in context`));
		}

		return { render: () => lines, invalidate: () => {} };
	});
}

// ── Main extension ───────────────────────────────────────────

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let allFiles: FileEntry[] = [];
	let cwd = "";

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		const paths = findCapsFiles(cwd);
		const saved = loadState(cwd);
		allFiles = paths
			.map(p => readFileContent(p, cwd))
			.filter((f): f is NonNullable<typeof f> => f !== null)
			.map(f => ({ ...f, enabled: saved[f.relativePath] !== undefined ? saved[f.relativePath] : true }));
		updateWidget(ctx, allFiles);
	});

	pi.on("session_shutdown", async () => {
		if (allFiles.length > 0) saveState(cwd, allFiles);
	});

	// /caps + ctrl+shift+c
	const openSelector = async (ctx: any) => {
		if (allFiles.length === 0) {
			ctx.ui.notify("No CAPS files found", "info");
			return;
		}

		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const selector = new CapsSelector(allFiles, theme);
			selector.onDone = () => {
				saveState(cwd, allFiles);
				done();
			};
			return selector;
		}, { overlay: true });

		updateWidget(ctx, allFiles);
	};

	pi.registerCommand("caps", {
		description: "Toggle CAPS context files",
		handler: async (_args, ctx) => { await openSelector(ctx); },
	});

	pi.registerShortcut("ctrl+shift+c", {
		description: "Toggle CAPS context files",
		handler: async (ctx) => { await openSelector(ctx); },
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const seenPaths = new Set(allFiles.map(f => f.relativePath));

		try {
			const subdirs = new Set<string>();
			for (const d of extractSubdirs(event.prompt, cwd)) subdirs.add(d);

			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "tool_call" && entry.input) {
					const s = typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input);
					for (const d of extractSubdirs(s, cwd)) subdirs.add(d);
				}
			}

			const saved = loadState(cwd);
			for (const dir of subdirs) {
				for (const p of findCapsFiles(dir)) {
					const file = readFileContent(p, cwd);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						allFiles.push({
							...file,
							enabled: saved[file.relativePath] !== undefined ? saved[file.relativePath] : true,
						});
					}
				}
			}
			updateWidget(ctx, allFiles);
		} catch { /* fallback */ }

		const enabled = allFiles.filter(f => f.enabled);
		if (enabled.length === 0) return;

		let extra = "\n\n## Additional Context (CAPS files)\n";
		for (const f of enabled) {
			extra += `\n### ${f.relativePath}\n\n${f.content}\n`;
		}
		return { systemPrompt: event.systemPrompt + extra };
	});
}
