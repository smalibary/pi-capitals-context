/**
 * Capitals Context Extension
 *
 * Finds ALL CAPS markdown files and injects their contents into the system prompt.
 *
 * - Root: ALL_CAPS.md files + ALL_CAPS/ folders (all .md inside)
 * - Subdirectories: ALL_CAPS.md files loaded when referenced (not toggleable)
 * - ctrl+shift+c at startup to toggle root files/folders
 * - State persists in .pi/caps-context-state.json
 * - Skips AGENTS.md and CLAUDE.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth, type Theme, Text } from "@mariozechner/pi-tui";

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const CAPS_DIR_RE = /^[A-Z][A-Z0-9_]*$/;
const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);
const SKIP_DIRS = new Set(["AGENTS", "CLAUDE", "NODE_MODULES"]);
const STATE_FILE = "caps-context-state.json";

interface FileEntry {
	relativePath: string;
	content: string;
	enabled: boolean;
	isRoot: boolean;
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

/** Find ALL_CAPS directories and all .md files inside them */
function findCapsDirs(dir: string): { dirName: string; files: string[] }[] {
	if (!fs.existsSync(dir)) return [];
	const results: { dirName: string; files: string[] }[] = [];
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (!CAPS_DIR_RE.test(entry.name)) continue;
			if (SKIP_DIRS.has(entry.name)) continue;
			const fullPath = path.join(dir, entry.name);
			const allMd = findAllMd(fullPath);
			if (allMd.length > 0) {
				results.push({ dirName: entry.name, files: allMd });
			}
		}
	} catch { /* skip */ }
	return results;
}

/** Find all .md files recursively in a directory */
function findAllMd(dir: string): string[] {
	const results: string[] = [];
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...findAllMd(full));
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				results.push(full);
			}
		}
	} catch { /* skip */ }
	return results;
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

// ── Build display text ───────────────────────────────────────

// ── Token estimate (~4 chars = 1 token) ─────────────────────

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return `${n}`;
}

function buildDisplayText(rootFiles: FileEntry[], subdirFiles: FileEntry[], theme: Theme): string {
	let text = theme.fg("accent", "[CAPS Context]");
	const enabled = rootFiles.filter(f => f.enabled);
	const disabled = rootFiles.filter(f => !f.enabled);
	let totalTokens = 0;

	for (const f of enabled) {
		const tokens = estimateTokens(f.content);
		totalTokens += tokens;
		text += "\n" + theme.fg("muted", `  ${f.relativePath}`) + theme.fg("dim", ` · ${formatTokens(tokens)} tokens`);
	}
	for (const f of subdirFiles) {
		const tokens = estimateTokens(f.content);
		totalTokens += tokens;
		text += "\n" + theme.fg("muted", `  ${f.relativePath}`) + theme.fg("dim", ` · ${formatTokens(tokens)} tokens`);
	}

	if (enabled.length > 0 || subdirFiles.length > 0) {
		text += "\n" + theme.fg("dim", `  total: ${formatTokens(totalTokens)} tokens`);
	}

	if (disabled.length > 0) {
		text += "\n" + theme.fg("dim", `  ${disabled.length} item${disabled.length > 1 ? "s" : ""} not in context · ctrl+shift+c to toggle`);
	} else if (rootFiles.length > 0) {
		text += "\n" + theme.fg("dim", "  ctrl+shift+c to toggle");
	}

	return text;
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

		const allOn = this.items.every(f => f.enabled);
		const noneOn = this.items.every(f => !f.enabled);
		const allCheck = allOn ? "☑" : noneOn ? "☐" : "◑";

		lines.push(t.fg("accent", `  ${allCheck} [CAPS Context]`));

		const pre = this.cursor === 0 ? "> " : "  ";
		lines.push(truncateToWidth(`${pre}${allCheck} Toggle all`, width));

		for (let i = 0; i < this.items.length; i++) {
			const f = this.items[i];
			const p = this.cursor === i + 1 ? "> " : "  ";
			const c = f.enabled ? "☑" : "☐";
			const tokens = formatTokens(estimateTokens(f.content));
			const label = f.relativePath;
			const line = `${p}${c} ${label} · ${tokens} tokens`;
			lines.push(truncateToWidth(f.enabled ? line : t.fg("dim", line), width));
		}

		const enabledTokens = this.items.filter(f => f.enabled).reduce((sum, f) => sum + estimateTokens(f.content), 0);
		lines.push(t.fg("dim", `  total: ${formatTokens(enabledTokens)} tokens`));

		const off = this.items.filter(f => !f.enabled).length;
		if (off > 0) {
			lines.push(t.fg("dim", `  ${off} item${off > 1 ? "s" : ""} not in context`));
		}

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

// ── Main extension ───────────────────────────────────────────

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let rootFiles: FileEntry[] = [];
	let subdirFiles: FileEntry[] = [];
	let cwd = "";
	let startupShown = false;
	let firstMsgSent = false;

	pi.registerMessageRenderer("caps-context", (_message, _options, theme) => {
		return new Text(buildDisplayText(rootFiles, subdirFiles, theme), 0, 0);
	});

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		const saved = loadState(cwd);

		// 1. Discover root CAPS files (e.g. STATUS.md, DESIGN.md)
		const capsFiles = findCapsFiles(cwd)
			.map(p => readFileContent(p, cwd))
			.filter((f): f is NonNullable<typeof f> => f !== null)
			.map(f => ({ ...f, enabled: saved[f.relativePath] !== undefined ? saved[f.relativePath] : true, isRoot: true }));

		// 2. Discover CAPS directories (e.g. RULES/, API/) — toggle at folder level
		const capsDirs = findCapsDirs(cwd);
		const dirEntries: FileEntry[] = [];
		for (const { dirName, files } of capsDirs) {
			// Merge all files in the folder into one toggleable entry
			const contents: string[] = [];
			for (const fp of files) {
				const file = readFileContent(fp, cwd);
				if (file) contents.push(`### ${file.relativePath}\n\n${file.content}`);
			}
			if (contents.length > 0) {
				dirEntries.push({
					relativePath: `${dirName}/`,
					content: contents.join("\n\n"),
					enabled: saved[`${dirName}/`] !== undefined ? saved[`${dirName}/`] : true,
					isRoot: true,
				});
			}
		}

		rootFiles = [...capsFiles, ...dirEntries];
		subdirFiles = [];

		if (rootFiles.length > 0 && !startupShown) {
			startupShown = true;
			pi.sendMessage({
				customType: "caps-context",
				content: "CAPS context loaded",
				display: true,
			});
		}
	});

	pi.on("session_shutdown", async () => {
		if (rootFiles.length > 0) saveState(cwd, rootFiles);
	});

	const openSelector = async (ctx: any) => {
		if (firstMsgSent) return;
		if (rootFiles.length === 0) {
			ctx.ui.notify("No root CAPS files found", "info");
			return;
		}

		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const selector = new CapsSelector(rootFiles, theme);
			selector.onDone = () => {
				saveState(cwd, rootFiles);
				done();
			};
			return selector;
		}, { overlay: true });

		pi.sendMessage({
			customType: "caps-context",
			content: "CAPS context updated",
			display: true,
		});
	};

	pi.registerShortcut("ctrl+shift+c", {
		description: "Toggle root CAPS context files",
		handler: async (ctx) => { await openSelector(ctx); },
	});

	pi.on("before_agent_start", async (event, ctx) => {
		firstMsgSent = true;
		const seenPaths = new Set([...rootFiles, ...subdirFiles].map(f => f.relativePath));

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

			for (const dir of subdirs) {
				for (const p of findCapsFiles(dir)) {
					const file = readFileContent(p, cwd);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						subdirFiles.push({ ...file, enabled: true, isRoot: false });
					}
				}
			}
		} catch { /* fallback */ }

		const enabled = [...rootFiles.filter(f => f.enabled), ...subdirFiles];
		if (enabled.length === 0) return;

		let extra = "\n\n## Additional Context (CAPS files)\n";
		for (const f of enabled) {
			extra += `\n${f.content}\n`;
		}

		return { systemPrompt: event.systemPrompt + extra };
	});
}
