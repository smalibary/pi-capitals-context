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
 *
 * Modules live in ../src/. This file is the orchestrator.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

import type { FileEntry } from "../src/types.js";
import {
	findCapsFiles,
	findCapsDirs,
	readFileContent,
	extractSubdirs,
	GLOBAL_CAPS_DIR,
} from "../src/discovery.js";
import {
	loadState,
	saveState,
	loadGlobalState,
	saveGlobalState,
} from "../src/state.js";
import { buildDisplayText, formatSystemPromptExtra, buildPromptPreview } from "../src/injection.js";
import { CapsSelector } from "../src/overlay.js";
import { loadConfig, defaultConfig, type CapsConfig } from "../src/config.js";
import { addSkipFile, removeSkipFile, resetSkipFiles, listSkipFiles } from "../src/config-writer.js";
import { copyToClipboard } from "../src/clipboard.js";
import { simpleLineDiff } from "../src/diff.js";

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let rootFiles: FileEntry[] = [];
	let globalFiles: FileEntry[] = [];
	let subdirFiles: FileEntry[] = [];
	let cwd = "";
	let config: CapsConfig = defaultConfig();
	let savedState: Record<string, boolean> = {};
	let startupShown = false;
	let watchers: fs.FSWatcher[] = [];
	let changedPaths = new Set<string>();
	let lastInjection = "";
	let diffPreview = "";
	const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

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
		config = loadConfig(cwd);
		clearWatchers();
		changedPaths = new Set();
		savedState = loadState(cwd);

		const capsFiles: FileEntry[] = [];
		for (const fp of await findCapsFiles(cwd, config)) {
			const f = await readFileContent(fp, cwd, config);
			if (!f) continue;
			const entry: FileEntry = { ...f, enabled: savedState[f.relativePath] ?? true, isRoot: true };
			capsFiles.push(entry);
			watchFile(entry, fp);
		}

		const dirEntries: FileEntry[] = [];
		for (const { dirName, files } of await findCapsDirs(cwd, config)) {
			for (const fp of files) {
				const f = await readFileContent(fp, cwd, config);
				if (!f) continue;
				const entry: FileEntry = {
					relativePath: f.relativePath,
					content: f.content,
					enabled: savedState[f.relativePath] ?? true,
					isRoot: true,
					folderGroup: `${dirName}/`,
				};
				dirEntries.push(entry);
				watchFile(entry, fp);
			}
		}

		rootFiles = [...capsFiles, ...dirEntries];

		const globalSaved = loadGlobalState();
		const globalEntries: FileEntry[] = [];

		for (const fp of await findCapsFiles(GLOBAL_CAPS_DIR, config)) {
			const f = await readFileContent(fp, GLOBAL_CAPS_DIR, config);
			if (!f) continue;
			const key = `~/${f.relativePath}`;
			const entry: FileEntry = { relativePath: key, content: f.content, enabled: globalSaved[key] ?? true, isRoot: true, isGlobal: true };
			globalEntries.push(entry);
			watchFile(entry, fp);
		}

		for (const { dirName, files } of await findCapsDirs(GLOBAL_CAPS_DIR, config)) {
			for (const fp of files) {
				const f = await readFileContent(fp, GLOBAL_CAPS_DIR, config);
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

	const persistProjectState = () => {
		if (rootFiles.length > 0 || subdirFiles.length > 0) {
			saveState(cwd, [...rootFiles, ...subdirFiles]);
		}
	};

	pi.on("session_shutdown", async () => {
		clearWatchers();
		persistProjectState();
		if (globalFiles.length > 0) saveGlobalState(globalFiles);
	});

	const openSelector = async (ctx: any) => {
		const allFiles = [...rootFiles, ...subdirFiles, ...globalFiles];
		if (allFiles.length === 0) {
			ctx.ui.notify("No CAPS files found", "info");
			return;
		}
		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const selector = new CapsSelector(allFiles, theme);
			selector.onDone = () => {
				persistProjectState();
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

	const handleAdvance = async (args: string, ctx: any): Promise<void> => {
		const tokens = args.trim().split(/\s+/).filter(Boolean);
		const sub = tokens[0];

		if (!sub || sub === "help") {
			ctx.ui.notify(
				"/caps-advance — power-user config\n" +
				"  skip list           — show current skip list\n" +
				"  skip add <name>     — exclude a file from CAPS context\n" +
				"  skip remove <name>  — re-include a previously-skipped file\n" +
				"  skip reset          — restore default skip list\n" +
				"Changes take effect on pi restart.",
				"info",
			);
			return;
		}

		if (sub !== "skip") {
			ctx.ui.notify(`Unknown subcommand: ${sub}. Try /caps-advance help.`, "warn");
			return;
		}

		const action = tokens[1];
		const value = tokens.slice(2).join(" ");

		if (action === "list" || !action) {
			const { list, source } = listSkipFiles(cwd);
			ctx.ui.notify(`skip list (${source}):\n  ${list.join("\n  ")}`, "info");
			return;
		}

		if (action === "reset") {
			const { list } = resetSkipFiles(cwd);
			ctx.ui.notify(`skip list reset to defaults (${list.length} entries). Restart pi to apply.`, "info");
			return;
		}

		if (!value) {
			ctx.ui.notify(`Usage: /caps-advance skip ${action} <name>`, "warn");
			return;
		}

		if (action === "add") {
			const { added, list } = addSkipFile(cwd, value);
			ctx.ui.notify(
				added
					? `Added "${value}" to skip list (now ${list.length} entries). Restart pi to apply.`
					: `"${value}" already in skip list.`,
				"info",
			);
			return;
		}

		if (action === "remove") {
			const { removed, list } = removeSkipFile(cwd, value);
			ctx.ui.notify(
				removed
					? `Removed "${value}" from skip list (now ${list.length} entries). Restart pi to apply.`
					: `"${value}" not in skip list.`,
				"info",
			);
			return;
		}

		ctx.ui.notify(`Unknown action: ${action}. Try /caps-advance help.`, "warn");
	};

	pi.registerCommand("caps-advance", {
		description: "Power-user config — skip list, profiles (v2.3+), budgets (v2.3+)",
		handler: async (args, ctx) => { await handleAdvance(args, ctx); },
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const seenPaths = new Set([...rootFiles, ...subdirFiles].map(f => f.relativePath));

		try {
			const subdirs = new Set<string>();
			for (const d of await extractSubdirs(event.prompt, cwd, config)) subdirs.add(d);
			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "tool_call" && entry.input) {
					const s = typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input);
					for (const d of await extractSubdirs(s, cwd, config)) subdirs.add(d);
				}
			}
			for (const dir of subdirs) {
				for (const fp of await findCapsFiles(dir, config)) {
					const file = await readFileContent(fp, cwd, config);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						subdirFiles.push({ ...file, enabled: savedState[file.relativePath] ?? true, isRoot: false });
					}
				}
				for (const { dirName, files } of await findCapsDirs(dir, config)) {
					const dirPrefix = `${path.relative(cwd, dir).replace(/\\/g, "/")}/${dirName}/`;
					for (const fp of files) {
						const file = await readFileContent(fp, cwd, config);
						if (file && !seenPaths.has(file.relativePath)) {
							seenPaths.add(file.relativePath);
							subdirFiles.push({
								relativePath: file.relativePath,
								content: file.content,
								enabled: savedState[file.relativePath] ?? true,
								isRoot: false,
								folderGroup: dirPrefix,
							});
						}
					}
				}
			}
			if (subdirFiles.length > config.maxSubdirFiles) {
				const drop = subdirFiles.length - config.maxSubdirFiles;
				subdirFiles.splice(0, drop);
			}
		} catch { /* fallback */ }

		const enabled = [...rootFiles.filter(f => f.enabled), ...subdirFiles.filter(f => f.enabled), ...globalFiles.filter(f => f.enabled)];
		const extra = formatSystemPromptExtra(enabled);
		lastInjection = extra;
		if (!extra) return;

		return { systemPrompt: event.systemPrompt + extra };
	});

	pi.registerMessageRenderer("caps-prompt", (_message, _options, theme) => {
		const enabled = [
			...rootFiles.filter(f => f.enabled),
			...subdirFiles.filter(f => f.enabled),
			...globalFiles.filter(f => f.enabled),
		];
		return new Text(buildPromptPreview(enabled, theme), 0, 0);
	});

	pi.registerMessageRenderer("caps-prompt-diff", (_message, _options, theme) => {
		const header = theme.fg("accent", "[CAPS Injection Diff vs previous turn]");
		return new Text(header + "\n" + diffPreview, 0, 0);
	});

	const handlePrompt = async (args: string, ctx: any): Promise<void> => {
		const tokens = args.trim().split(/\s+/).filter(Boolean);
		const wantCopy = tokens.includes("--copy");
		const wantDiff = tokens.includes("--diff");
		const wantHelp = tokens.includes("help") || tokens.includes("--help");

		if (wantHelp) {
			ctx.ui.notify(
				"/caps-prompt — show the exact text injected into the system prompt\n" +
				"  /caps-prompt          — print injection preview + per-file stats\n" +
				"  /caps-prompt --copy   — also copy injection text to clipboard\n" +
				"  /caps-prompt --diff   — show line-diff vs previous turn's injection",
				"info",
			);
			return;
		}

		const enabled = [
			...rootFiles.filter(f => f.enabled),
			...subdirFiles.filter(f => f.enabled),
			...globalFiles.filter(f => f.enabled),
		];
		const currentInjection = formatSystemPromptExtra(enabled);

		if (wantCopy) {
			const r = await copyToClipboard(currentInjection);
			ctx.ui.notify(
				r.ok ? "Copied injection text to clipboard." : `Clipboard failed: ${r.reason}`,
				r.ok ? "info" : "warn",
			);
		}

		if (wantDiff) {
			if (!lastInjection) {
				ctx.ui.notify("No previous turn yet — send a message first, then /caps-prompt --diff.", "info");
				return;
			}
			diffPreview = simpleLineDiff(lastInjection, currentInjection);
			pi.sendMessage({ customType: "caps-prompt-diff", content: "diff", display: true });
			return;
		}

		pi.sendMessage({ customType: "caps-prompt", content: "preview", display: true });
	};

	pi.registerCommand("caps-prompt", {
		description: "Show the exact text injected into the system prompt",
		handler: async (args, ctx) => { await handlePrompt(args, ctx); },
	});
}
