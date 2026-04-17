/**
 * Capitals Context Extension
 *
 * Finds ALL CAPS markdown files and injects their contents into the system prompt.
 *
 * Behavior:
 * - Root: scans cwd for ALL_CAPS.md files (e.g. NOTES.md, TODO.md, RULES.md)
 * - Subdirectories: scans the user's prompt AND session history for path references
 *   to subdirectories, then loads ALL_CAPS.md from those subdirs too
 * - Skips AGENTS.md and CLAUDE.md (already loaded by pi natively)
 * - Press # to open interactive toggler to enable/disable individual files
 *
 * Place in ~/.pi/agent/extensions/ or .pi/extensions/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	matchesKey,
	Key,
	truncateToWidth,
	type Theme,
} from "@mariozechner/pi-tui";

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);

interface FileEntry {
	relativePath: string;
	content: string;
	enabled: boolean;
}

function findCapsFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	try {
		return fs
			.readdirSync(dir)
			.filter((name) => CAPS_FILE_RE.test(name) && !SKIP_FILES.has(name))
			.map((name) => path.join(dir, name))
			.filter((fullPath) => {
				try { return fs.statSync(fullPath).isFile(); } catch { return false; }
			});
	} catch { return []; }
}

function readFileContent(fullPath: string, cwd: string): { relativePath: string; content: string } | null {
	try {
		return {
			relativePath: path.relative(cwd, fullPath).replace(/\\/g, "/"),
			content: fs.readFileSync(fullPath, "utf-8"),
		};
	} catch { return null; }
}

function extractSubdirs(text: string, cwd: string): Set<string> {
	const dirs = new Set<string>();
	let realDirs: string[] = [];
	try { realDirs = fs.readdirSync(cwd, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
	catch { return dirs; }

	const re = /(?:\.?[/\\])?([A-Za-z0-9_-]+)[/\\][\w./\\-]+/g;
	let match;
	while ((match = re.exec(text)) !== null) {
		const candidate = match[1];
		if (realDirs.includes(candidate)) dirs.add(path.join(cwd, candidate));
	}

	const lower = text.toLowerCase();
	for (const dir of realDirs) {
		if (lower.includes(dir.toLowerCase())) {
			dirs.add(path.join(cwd, dir));
		}
	}

	return dirs;
}

// ── Checkbox selector component ──────────────────────────────

class CapsSelector {
	private items: FileEntry[];
	private cursor = 0;           // 0 = toggle-all row, 1..n = files
	private cachedWidth?: number;
	private cachedLines?: string[];

	public onDone?: () => void;

	constructor(items: FileEntry[]) {
		this.items = items;
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
				const anyEnabled = this.items.some((f) => f.enabled);
				for (const f of this.items) f.enabled = !anyEnabled;
			} else {
				this.items[this.cursor - 1].enabled = !this.items[this.cursor - 1].enabled;
			}
			this.invalidate();
		} else if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
			this.onDone?.();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const allEnabled = this.items.every((f) => f.enabled);
		const noneEnabled = this.items.every((f) => !f.enabled);
		const allCheck = allEnabled ? "☑" : noneEnabled ? "☐" : "◑";

		const lines: string[] = [];

		// Toggle-all row
		const allPrefix = this.cursor === 0 ? "> " : "  ";
		lines.push(truncateToWidth(`${allPrefix}${allCheck} Toggle all`, width));

		// File rows
		for (let i = 0; i < this.items.length; i++) {
			const f = this.items[i];
			const prefix = this.cursor === i + 1 ? "> " : "  ";
			const check = f.enabled ? "☑" : "☐";
			lines.push(truncateToWidth(`${prefix}${check} ${f.relativePath}`, width));
		}

		lines.push(truncateToWidth("", width));
		lines.push(truncateToWidth("  ↑↓ navigate · space toggle · enter/esc done", width));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

// ── Widget renderer ──────────────────────────────────────────

function updateWidget(ctx: any, files: FileEntry[]) {
	if (!ctx.hasUI || files.length === 0) return;
	ctx.ui.setWidget("caps-context", (_tui: any, theme: Theme) => {
		const allEnabled = files.every((f) => f.enabled);
		const noneEnabled = files.every((f) => !f.enabled);
		const allCheck = allEnabled ? "☑ " : noneEnabled ? "☐ " : "◑ ";
		const header = theme.fg("accent", `${allCheck}[CAPS Context]  (/caps to toggle)`);
		const lines = files.map((f) => {
			const check = f.enabled ? "☑" : "☐";
			const name = f.enabled
				? theme.fg("muted", `  ${check} ${f.relativePath}`)
				: theme.fg("dim", `  ${check} ${f.relativePath}`);
			return name;
		});
		return {
			render: () => [header, ...lines],
			invalidate: () => {},
		};
	});
}

// ── Main extension ───────────────────────────────────────────

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let allFiles: FileEntry[] = [];
	let cwd = "";

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		const paths = findCapsFiles(cwd);
		allFiles = paths
			.map((p) => readFileContent(p, cwd))
			.filter((f): f is NonNullable<typeof f> => f !== null)
			.map((f) => ({ ...f, enabled: true }));
		updateWidget(ctx, allFiles);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setWidget("caps-context", undefined);
	});

	// Register /caps command and ctrl+shift+c shortcut
	const openSelector = async (ctx: any) => {
		if (allFiles.length === 0) {
			ctx.ui.notify("No CAPS files found", "info");
			return;
		}

		const selector = new CapsSelector(allFiles);

		await ctx.ui.custom((_tui: any, _theme: any, _kb: any, done: () => void) => {
			selector.onDone = () => {
				done();
			};
			return selector;
		});

		updateWidget(ctx, allFiles);
	};

	pi.registerCommand("caps", {
		description: "Toggle CAPS context files",
		handler: async (_args, ctx) => {
			await openSelector(ctx);
		},
	});

	pi.registerShortcut("ctrl+shift+c", {
		description: "Toggle CAPS context files",
		handler: async (ctx) => {
			await openSelector(ctx);
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		// Discover new files from subdirectories
		const seenPaths = new Set(allFiles.map((f) => f.relativePath));

		try {
			const subdirs = new Set<string>();

			// 1. Scan current prompt
			for (const dir of extractSubdirs(event.prompt, cwd)) subdirs.add(dir);

			// 2. Scan session history
			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "tool_call" && entry.input) {
					const inputStr = typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input);
					for (const dir of extractSubdirs(inputStr, cwd)) subdirs.add(dir);
				}
			}

			// 3. Add new subdir files
			for (const dir of subdirs) {
				const subPaths = findCapsFiles(dir);
				for (const p of subPaths) {
					const file = readFileContent(p, cwd);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						allFiles.push({ ...file, enabled: true });
					}
				}
			}

			updateWidget(ctx, allFiles);
		} catch { /* fallback */ }

		// Only inject enabled files
		const enabledFiles = allFiles.filter((f) => f.enabled);
		if (enabledFiles.length === 0) return;

		let extra = "\n\n## Additional Context (CAPS files)\n";
		for (const f of enabledFiles) {
			extra += `\n### ${f.relativePath}\n\n${f.content}\n`;
		}

		return { systemPrompt: event.systemPrompt + extra };
	});
}
