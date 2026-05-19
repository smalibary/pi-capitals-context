/**
 * Capitals Context Extension
 *
 * Finds ALL CAPS markdown files and injects their contents into the system prompt.
 *
 * - Root: ALL_CAPS.md files + ALL_CAPS/ folders (each file individually toggleable)
 * - Global: ~/.pi/CAPS/ folder loaded in every project
 * - Subdirectories: ALL_CAPS files auto-loaded when referenced
 * - /caps command to toggle files
 * - State persists in .pi/caps-context-state.json (atomic writes)
 * - File watcher notifies of changes — restart to reload
 * - Skips AGENTS.md and CLAUDE.md
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, Key, truncateToWidth, Text } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const CAPS_DIR_RE = /^[A-Z][A-Z0-9_]*$/;
const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);
const SKIP_DIRS = new Set(["AGENTS", "CLAUDE", "NODE_MODULES"]);
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".yaml", ".yml", ".json", ".toml"]);
const STATE_FILE = "caps-context-state.json";
const GLOBAL_CAPS_DIR = path.join(os.homedir(), ".pi", "CAPS");
const GLOBAL_STATE_FILE = path.join(os.homedir(), ".pi", "caps-global-state.json");

interface FileEntry {
	relativePath: string;
	content: string;
	enabled: boolean;
	isRoot: boolean;
	isGlobal?: boolean;
	folderGroup?: string;
}

// ── File discovery (async) ───────────────────────────────────────

async function findCapsFiles(dir: string): Promise<string[]> {
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		return entries
			.filter(e => e.isFile() && CAPS_FILE_RE.test(e.name) && !SKIP_FILES.has(e.name))
			.map(e => path.join(dir, e.name));
	} catch { return []; }
}

async function findAllText(dir: string): Promise<string[]> {
	const results: string[] = [];
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = path.join(dir, e.name);
			if (e.isDirectory()) results.push(...await findAllText(full));
			else if (e.isFile() && TEXT_EXTENSIONS.has(path.extname(e.name).toLowerCase())) results.push(full);
		}
	} catch {}
	return results;
}

async function findCapsDirs(dir: string): Promise<{ dirName: string; files: string[] }[]> {
	const results: { dirName: string; files: string[] }[] = [];
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			if (!e.isDirectory() || !CAPS_DIR_RE.test(e.name) || SKIP_DIRS.has(e.name)) continue;
			const files = await findAllText(path.join(dir, e.name));
			if (files.length > 0) results.push({ dirName: e.name, files });
		}
	} catch {}
	return results;
}

async function readFileContent(fp: string, cwd: string): Promise<{ relativePath: string; content: string } | null> {
	try {
		const content = await fsp.readFile(fp, "utf-8");
		return { relativePath: path.relative(cwd, fp).replace(/\\/g, "/"), content };
	} catch { return null; }
}

async function extractSubdirs(text: string, cwd: string): Promise<Set<string>> {
	const dirs = new Set<string>();
	let realDirs: string[] = [];
	try {
		const entries = await fsp.readdir(cwd, { withFileTypes: true });
		realDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
	} catch { return dirs; }
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

// ── State persistence (resilient, atomic writes) ─────────────────

function validateState(raw: unknown): Record<string, boolean> {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const result: Record<string, boolean> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof v === "boolean") result[k] = v;
	}
	return result;
}

function loadState(cwd: string): Record<string, boolean> {
	try { return validateState(JSON.parse(fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8"))); }
	catch { return {}; }
}

function saveState(cwd: string, files: FileEntry[]) {
	const dir = path.join(cwd, ".pi");
	try { fs.mkdirSync(dir, { recursive: true }); } catch {}
	const state: Record<string, boolean> = {};
	for (const f of files) state[f.relativePath] = f.enabled;
	const target = path.join(dir, STATE_FILE);
	const tmp = target + ".tmp";
	try { fs.writeFileSync(tmp, JSON.stringify(state, null, "\t")); fs.renameSync(tmp, target); }
	catch { try { fs.unlinkSync(tmp); } catch {} }
}

function loadGlobalState(): Record<string, boolean> {
	try { return validateState(JSON.parse(fs.readFileSync(GLOBAL_STATE_FILE, "utf-8"))); }
	catch { return {}; }
}

function saveGlobalState(files: FileEntry[]) {
	const state: Record<string, boolean> = {};
	for (const f of files) state[f.relativePath] = f.enabled;
	const tmp = GLOBAL_STATE_FILE + ".tmp";
	try { fs.writeFileSync(tmp, JSON.stringify(state, null, "\t")); fs.renameSync(tmp, GLOBAL_STATE_FILE); }
	catch { try { fs.unlinkSync(tmp); } catch {} }
}

// ── Token estimate (word-based) ──────────────────────────────────

function estimateTokens(text: string): number {
	let tokens = 0;
	for (const chunk of text.split(/\s+/)) {
		if (chunk.length === 0) continue;
		tokens += Math.max(1, Math.ceil(chunk.length / 4));
	}
	return tokens;
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return `${n}`;
}

// ── Build display text ───────────────────────────────────────────

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
		text += "\n" + theme.fg("dim", `  ${disabled.length} item${disabled.length > 1 ? "s" : ""} not in context · /caps to toggle`);
	} else if (rootFiles.length > 0) {
		text += "\n" + theme.fg("dim", "  /caps to toggle");
	}
	return text;
}

// ── Overlay selector ─────────────────────────────────────────────

type SortMode = "discovery" | "alpha" | "tokens";
const SORT_LABELS: Record<SortMode, string> = { discovery: "default", alpha: "a–z", tokens: "tokens↓" };

type RenderItem =
	| { kind: "folder"; group: string; files: FileEntry[] }
	| { kind: "file"; entry: FileEntry };

class CapsSelector {
	private items: FileEntry[];
	private sorted: FileEntry[];
	private sortMode: SortMode = "discovery";
	private filter = "";
	private cursor = 0;
	private expandedFolders = new Set<string>();
	private theme: Theme;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onDone?: () => void;

	constructor(items: FileEntry[], theme: Theme) {
		this.items = items;
		this.sorted = [...items];
		this.theme = theme;
	}

	private resort(): void {
		if (this.sortMode === "alpha") {
			this.sorted = [...this.items].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
		} else if (this.sortMode === "tokens") {
			this.sorted = [...this.items].sort((a, b) => estimateTokens(b.content) - estimateTokens(a.content));
		} else {
			this.sorted = [...this.items];
		}
		this.invalidate();
	}

	private getVisible(): FileEntry[] {
		if (!this.filter) return this.sorted;
		const q = this.filter.toLowerCase();
		return this.sorted.filter(f => f.relativePath.toLowerCase().includes(q));
	}

	// Build render items: folder headers + individual files (respecting expand state)
	private buildRenderItems(visible: FileEntry[]): RenderItem[] {
		const items: RenderItem[] = [];
		const processedGroups = new Set<string>();
		for (const f of visible) {
			if (f.folderGroup) {
				if (!processedGroups.has(f.folderGroup)) {
					processedGroups.add(f.folderGroup);
					const groupFiles = visible.filter(v => v.folderGroup === f.folderGroup);
					items.push({ kind: "folder", group: f.folderGroup, files: groupFiles });
					// Auto-expand when filter active so results are visible
					if (this.expandedFolders.has(f.folderGroup) || this.filter !== "") {
						for (const gf of groupFiles) items.push({ kind: "file", entry: gf });
					}
				}
			} else {
				items.push({ kind: "file", entry: f });
			}
		}
		return items;
	}

	handleInput(data: string): void {
		const visible = this.getVisible();
		const renderItems = this.buildRenderItems(visible);

		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.invalidate();
		} else if (matchesKey(data, Key.down)) {
			if (this.cursor < renderItems.length + 1) this.cursor++;
			this.invalidate();
		} else if (matchesKey(data, Key.left)) {
			const item = this.cursor >= 2 ? renderItems[this.cursor - 2] : null;
			if (item?.kind === "folder" && this.expandedFolders.has(item.group)) {
				this.expandedFolders.delete(item.group);
				this.invalidate();
			}
		} else if (matchesKey(data, Key.space)) {
			if (this.cursor === 0) {
				const allFiles = renderItems.filter(i => i.kind === "file").map(i => (i as Extract<RenderItem, { kind: "file" }>).entry);
				const anyOn = allFiles.some(f => f.enabled);
				for (const f of allFiles) f.enabled = !anyOn;
			} else if (this.cursor === 1) {
				const modes: SortMode[] = ["discovery", "alpha", "tokens"];
				this.sortMode = modes[(modes.indexOf(this.sortMode) + 1) % modes.length];
				this.resort();
				return;
			} else {
				const item = renderItems[this.cursor - 2];
				if (item?.kind === "folder") {
					if (this.expandedFolders.has(item.group)) {
						// Already expanded: toggle all files
						const anyOn = item.files.some(f => f.enabled);
						for (const f of item.files) f.enabled = !anyOn;
					} else {
						// Collapsed: expand
						this.expandedFolders.add(item.group);
					}
				} else if (item?.kind === "file") {
					item.entry.enabled = !item.entry.enabled;
				}
			}
			this.invalidate();
		} else if (data === "\x7f" || data === "\b") {
			if (this.filter.length > 0) {
				this.filter = this.filter.slice(0, -1);
				this.cursor = 0;
				this.invalidate();
			}
		} else if (matchesKey(data, Key.escape)) {
			if (this.filter) {
				this.filter = "";
				this.cursor = 0;
				this.invalidate();
			} else {
				this.onDone?.();
			}
		} else if (matchesKey(data, Key.enter)) {
			this.onDone?.();
		} else if (data.length === 1 && data >= " ") {
			this.filter += data;
			this.cursor = 0;
			this.invalidate();
		}
	}

	private static stripAnsi(s: string): string {
		return s.replace(/\x1b\[[0-9;]*m/g, "");
	}

	private boxLines(content: string[], totalWidth: number): string[] {
		const t = this.theme;
		const innerWidth = totalWidth - 4;
		const h = "─".repeat(Math.max(0, totalWidth - 2));
		const top = t.fg("accent", "╭" + h + "╮");
		const bot = t.fg("accent", "╰" + h + "╯");
		const bar = t.fg("accent", "│");
		const lines: string[] = [top];
		for (const line of content) {
			const vis = CapsSelector.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private buildContent(w: number, maxFileRows?: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const visible = this.getVisible();
		const renderItems = this.buildRenderItems(visible);

		const allFiles = renderItems.filter(i => i.kind === "file").map(i => (i as Extract<RenderItem, { kind: "file" }>).entry);
		const allOn = allFiles.length > 0 && allFiles.every(f => f.enabled);
		const noneOn = allFiles.every(f => !f.enabled);
		const allCheck = allOn ? "☑" : noneOn ? "☐" : "◑";

		const header = t.fg("accent", `${allCheck} [CAPS Context]`);
		lines.push(this.filter ? header + t.fg("dim", ` · /${this.filter}_`) : header);

		const togglePre = this.cursor === 0 ? "> " : "  ";
		const toggleLabel = allFiles.length < this.sorted.length
			? `${allCheck} Toggle all (${allFiles.length} of ${this.sorted.length})`
			: `${allCheck} Toggle all`;
		lines.push(truncateToWidth(`${togglePre}${toggleLabel}`, w));

		const sortPre = this.cursor === 1 ? "> " : "  ";
		lines.push(truncateToWidth(`${sortPre}⇅ Sort: ${SORT_LABELS[this.sortMode]}`, w));

		let start = 0;
		let end = renderItems.length;
		if (maxFileRows !== undefined && renderItems.length > maxFileRows) {
			const cursorInList = Math.max(0, this.cursor - 2);
			const half = Math.floor(maxFileRows / 2);
			start = Math.max(0, Math.min(cursorInList - half, renderItems.length - maxFileRows));
			end = start + maxFileRows;
		}

		if (start > 0) lines.push(t.fg("dim", truncateToWidth(`  ↑ ${start} more`, w)));

		for (let i = start; i < end; i++) {
			const item = renderItems[i];
			const isCursor = this.cursor === i + 2;
			const p = isCursor ? "> " : "  ";

			if (item.kind === "folder") {
				const allOn = item.files.every(f => f.enabled);
				const noneOn = item.files.every(f => !f.enabled);
				const check = allOn ? "☑" : noneOn ? "☐" : "◑";
				const expanded = this.expandedFolders.has(item.group) || this.filter !== "";
				const arrow = expanded ? "▼" : "▶";
				const folderLine = `${p}${arrow} ${check} ${item.group} (${item.files.length} files)`;
				lines.push(truncateToWidth(t.fg("accent", folderLine), w));
			} else {
				const f = item.entry;
				const nested = !!f.folderGroup;
				const indent = nested ? "  " : "";
				const c = f.enabled ? "☑" : "☐";
				const tokens = formatTokens(estimateTokens(f.content));
				const name = nested ? path.basename(f.relativePath) : f.relativePath;
				const line = `${p}${indent}${c} ${name} · ${tokens} tokens`;
				lines.push(truncateToWidth(f.enabled ? line : t.fg("dim", line), w));
			}
		}

		if (end < renderItems.length) lines.push(t.fg("dim", truncateToWidth(`  ↓ ${renderItems.length - end} more`, w)));
		if (visible.length === 0) lines.push(t.fg("dim", `  no matches for "${this.filter}"`));

		const enabledTokens = this.sorted.filter(f => f.enabled).reduce((sum, f) => sum + estimateTokens(f.content), 0);
		lines.push(t.fg("dim", `  total: ${formatTokens(enabledTokens)} tokens`));

		const off = this.sorted.filter(f => !f.enabled).length;
		if (off > 0) lines.push(t.fg("dim", `  ${off} item${off > 1 ? "s" : ""} not in context`));

		return lines;
	}

	private helpLine(hoveredItem?: RenderItem | null): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		if (this.filter) {
			return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" toggle · ") + k("⌫") + d(" erase · ") + k("esc") + d(" clear filter");
		}
		if (hoveredItem?.kind === "folder") {
			const expanded = this.expandedFolders.has(hoveredItem.group) || this.filter !== "";
			if (expanded) {
				return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" toggle all in folder · ") + k("←") + d(" collapse · ") + k("esc") + d(" done");
			}
			return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" expand folder · ") + k("esc") + d(" done");
		}
		return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" select · ") + d("type to search · ") + k("esc") + d(" done");
	}

	private buildPreview(file: FileEntry, innerWidth: number, maxLines: number): string[] {
		const t = this.theme;
		const all = file.content.split("\n").filter(l => l.trim());
		const lines: string[] = [t.fg("accent", truncateToWidth(file.relativePath, innerWidth))];
		const avail = Math.max(0, maxLines - 1);
		const numW = String(all.length).length + 1;
		const row = (n: number, text: string) =>
			t.fg("dim", String(n).padStart(numW) + " ") + truncateToWidth(text, innerWidth - numW - 1);
		if (all.length <= avail) {
			for (let i = 0; i < all.length; i++) lines.push(row(i + 1, all[i]));
		} else {
			const topCount = Math.floor(avail / 2);
			const botCount = Math.max(0, avail - topCount - 1);
			const hidden = all.length - topCount - botCount;
			const startBot = all.length - botCount;
			for (let i = 0; i < topCount; i++) lines.push(row(i + 1, all[i]));
			lines.push(t.fg("dim", truncateToWidth(`── ${hidden} line${hidden > 1 ? "s" : ""} ──`, innerWidth)));
			for (let i = 0; i < botCount; i++) lines.push(row(startBot + i + 1, all[startBot + i]));
		}
		return lines;
	}

	private buildFolderPreview(item: Extract<RenderItem, { kind: "folder" }>, innerWidth: number): string[] {
		const t = this.theme;
		const totalTokens = item.files.reduce((s, f) => s + estimateTokens(f.content), 0);
		const lines: string[] = [
			t.fg("accent", truncateToWidth(item.group, innerWidth)),
			t.fg("dim", truncateToWidth(`${item.files.length} files · ${formatTokens(totalTokens)} tokens total`, innerWidth)),
		];
		for (const f of item.files) {
			const c = f.enabled ? "☑" : "☐";
			const tokens = formatTokens(estimateTokens(f.content));
			lines.push(truncateToWidth(`  ${c} ${path.basename(f.relativePath)} · ${tokens} tokens`, innerWidth));
		}
		return lines;
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const termHeight: number = (process.stdout as any).rows ?? 24;
		const maxAllowed = Math.max(8, termHeight - 4);
		const maxFileRows = Math.max(1, maxAllowed - 2 - 1 - 4);

		const renderItems = this.buildRenderItems(this.getVisible());
		const hoveredItem = this.cursor >= 2 ? renderItems[this.cursor - 2] ?? null : null;
		const hoveredFile = hoveredItem?.kind === "file" ? hoveredItem.entry : null;
		const hoveredFolder = hoveredItem?.kind === "folder" ? hoveredItem : null;

		const LEFT_W = 44;
		const GAP = 2;
		const rightTotalW = width - LEFT_W - GAP;
		const showPreview = hoveredItem !== null && rightTotalW >= 28;

		if (!showPreview) {
			const content = this.buildContent(width - 4, maxFileRows);
			this.cachedLines = [...this.boxLines(content, width), this.helpLine(hoveredItem)];
			this.cachedWidth = width;
			return this.cachedLines;
		}

		const leftContent = this.buildContent(LEFT_W - 4, maxFileRows);
		const leftLines = this.boxLines(leftContent, LEFT_W);

		const rightInnerW = rightTotalW - 4;
		let rightContent: string[];
		if (hoveredFolder) {
			rightContent = this.buildFolderPreview(hoveredFolder, rightInnerW);
		} else {
			const previewMaxLines = Math.min(leftLines.length - 2, Math.max(4, maxAllowed - 3));
			rightContent = this.buildPreview(hoveredFile!, rightInnerW, previewMaxLines);
		}
		const rightLines = this.boxLines(rightContent, rightTotalW);

		const maxH = Math.max(leftLines.length, rightLines.length);
		const gapStr = " ".repeat(GAP);
		const emptyLeft = " ".repeat(LEFT_W);
		const emptyRight = " ".repeat(rightTotalW);
		const lines: string[] = [];
		for (let i = 0; i < maxH; i++) {
			lines.push((leftLines[i] ?? emptyLeft) + gapStr + (rightLines[i] ?? emptyRight));
		}
		lines.push(this.helpLine(hoveredItem));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ── Main extension ───────────────────────────────────────────────

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let rootFiles: FileEntry[] = [];
	let globalFiles: FileEntry[] = [];
	let subdirFiles: FileEntry[] = [];
	let cwd = "";
	let startupShown = false;
	let firstMsgSent = false;
	let watchers: fs.FSWatcher[] = [];
	let changedPaths = new Set<string>();
	const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

	// Track file changes — notify only, don't update content mid-session
	const watchFile = (f: FileEntry, fp: string) => {
		try {
			const w = fs.watch(fp, () => {
				const prev = debounceMap.get(fp);
				if (prev) clearTimeout(prev);
				debounceMap.set(fp, setTimeout(() => {
					debounceMap.delete(fp);
					changedPaths.add(f.relativePath);
					pi.sendMessage({ customType: "caps-changed", content: "caps-changed", display: true });
				}, 300));
			});
			watchers.push(w);
		} catch {}
	};

	const clearWatchers = () => {
		for (const w of watchers) { try { w.close(); } catch {} }
		watchers = [];
		for (const t of debounceMap.values()) clearTimeout(t);
		debounceMap.clear();
	};

	pi.registerMessageRenderer("caps-context", (_message, _options, theme) => {
		return new Text(buildDisplayText([...rootFiles, ...globalFiles], subdirFiles, theme), 0, 0);
	});

	pi.registerMessageRenderer("caps-changed", (_message, _options, theme) => {
		const names = [...changedPaths].slice(0, 2).map(p => path.basename(p)).join(", ");
		const suffix = changedPaths.size > 2 ? ` +${changedPaths.size - 2} more` : "";
		return new Text(theme.fg("error", `⚠  ${names}${suffix} changed · restart to reload`), 0, 0);
	});

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		clearWatchers();
		changedPaths = new Set();
		const saved = loadState(cwd);

		// 1. Root CAPS files
		const capsFiles: FileEntry[] = [];
		for (const fp of await findCapsFiles(cwd)) {
			const f = await readFileContent(fp, cwd);
			if (!f) continue;
			const entry: FileEntry = { ...f, enabled: saved[f.relativePath] ?? true, isRoot: true };
			capsFiles.push(entry);
			watchFile(entry, fp);
		}

		// 2. CAPS directories — each file individually toggleable
		const dirEntries: FileEntry[] = [];
		for (const { dirName, files } of await findCapsDirs(cwd)) {
			for (const fp of files) {
				const f = await readFileContent(fp, cwd);
				if (!f) continue;
				const entry: FileEntry = {
					relativePath: f.relativePath,
					content: f.content,
					enabled: saved[f.relativePath] ?? true,
					isRoot: true,
					folderGroup: `${dirName}/`,
				};
				dirEntries.push(entry);
				watchFile(entry, fp);
			}
		}

		rootFiles = [...capsFiles, ...dirEntries];

		// 3. Global CAPS files from ~/.pi/CAPS/
		const globalSaved = loadGlobalState();
		const globalEntries: FileEntry[] = [];

		for (const fp of await findCapsFiles(GLOBAL_CAPS_DIR)) {
			const f = await readFileContent(fp, GLOBAL_CAPS_DIR);
			if (!f) continue;
			const key = `~/${f.relativePath}`;
			const entry: FileEntry = { relativePath: key, content: f.content, enabled: globalSaved[key] ?? true, isRoot: true, isGlobal: true };
			globalEntries.push(entry);
			watchFile(entry, fp);
		}

		for (const { dirName, files } of await findCapsDirs(GLOBAL_CAPS_DIR)) {
			for (const fp of files) {
				const f = await readFileContent(fp, GLOBAL_CAPS_DIR);
				if (!f) continue;
				const key = `~/${f.relativePath}`;
				const entry: FileEntry = {
					relativePath: key,
					content: f.content,
					enabled: globalSaved[key] ?? true,
					isRoot: true,
					isGlobal: true,
					folderGroup: `~/${dirName}/`,
				};
				globalEntries.push(entry);
				watchFile(entry, fp);
			}
		}

		globalFiles = globalEntries;
		subdirFiles = [];

		if ((rootFiles.length > 0 || globalFiles.length > 0) && !startupShown) {
			startupShown = true;
			pi.sendMessage({ customType: "caps-context", content: "CAPS context loaded", display: true });
		}
	});

	pi.on("session_shutdown", async () => {
		clearWatchers();
		if (rootFiles.length > 0) saveState(cwd, rootFiles);
		if (globalFiles.length > 0) saveGlobalState(globalFiles);
	});

	const openSelector = async (ctx: any) => {
		if (firstMsgSent) return;
		const allFiles = [...rootFiles, ...globalFiles];
		if (allFiles.length === 0) {
			ctx.ui.notify("No CAPS files found", "info");
			return;
		}
		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const selector = new CapsSelector(allFiles, theme);
			selector.onDone = () => {
				saveState(cwd, rootFiles);
				if (globalFiles.length > 0) saveGlobalState(globalFiles);
				done();
			};
			return selector;
		}, { overlay: true });
		pi.sendMessage({ customType: "caps-context", content: "CAPS context updated", display: true });
	};

	pi.registerCommand("caps", {
		description: "Toggle CAPS context files",
		handler: async (_args, ctx) => { await openSelector(ctx); },
	});

	pi.on("before_agent_start", async (event, ctx) => {
		firstMsgSent = true;
		const seenPaths = new Set([...rootFiles, ...subdirFiles].map(f => f.relativePath));

		try {
			const subdirs = new Set<string>();
			for (const d of await extractSubdirs(event.prompt, cwd)) subdirs.add(d);
			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "tool_call" && entry.input) {
					const s = typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input);
					for (const d of await extractSubdirs(s, cwd)) subdirs.add(d);
				}
			}
			for (const dir of subdirs) {
				for (const fp of await findCapsFiles(dir)) {
					const file = await readFileContent(fp, cwd);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						subdirFiles.push({ ...file, enabled: true, isRoot: false });
					}
				}
				for (const { dirName, files } of await findCapsDirs(dir)) {
					const dirPrefix = `${path.relative(cwd, dir).replace(/\\/g, "/")}/${dirName}/`;
					for (const fp of files) {
						const file = await readFileContent(fp, cwd);
						if (file && !seenPaths.has(file.relativePath)) {
							seenPaths.add(file.relativePath);
							subdirFiles.push({ relativePath: file.relativePath, content: file.content, enabled: true, isRoot: false, folderGroup: dirPrefix });
						}
					}
				}
			}
		} catch { /* fallback */ }

		const enabled = [...rootFiles.filter(f => f.enabled), ...subdirFiles, ...globalFiles.filter(f => f.enabled)];
		if (enabled.length === 0) return;

		let extra = "\n\n## Additional Context (CAPS files)\n";
		for (const f of enabled) extra += `\n### ${f.relativePath}\n\n${f.content}\n`;

		return { systemPrompt: event.systemPrompt + extra };
	});
}
