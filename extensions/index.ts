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
import { ProfileSelector } from "../src/profile-overlay.js";
import { NameInputOverlay } from "../src/name-input-overlay.js";
import { loadConfig, defaultConfig, type CapsConfig } from "../src/config.js";
import { addSkipFile, removeSkipFile, resetSkipFiles, listSkipFiles } from "../src/config-writer.js";
import {
	listProfiles,
	loadProfiles,
	saveProfile,
	loadProfileToggles,
	deleteProfile,
	renameProfile,
	isValidProfileName,
	diffProfile,
	parseProfileArgTokens,
	type ToggleMap,
} from "../src/profiles.js";
import { copyToClipboard } from "../src/clipboard.js";
import { simpleLineDiff } from "../src/diff.js";
import { inspectDirectory, buildDoctorReport } from "../src/doctor.js";
import { PROJECT_CONFIG_NAME, GLOBAL_CONFIG_PATH } from "../src/config.js";
import { STATE_FILE } from "../src/state.js";
import * as os from "node:os";

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
	let doctorInputs: import("../src/doctor.js").DoctorInputs | null = null;
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

		if (!startupShown) {
			startupShown = true;
			if (rootFiles.length > 0 || globalFiles.length > 0) {
				pi.sendMessage({ customType: "caps-context", content: "CAPS context loaded", display: true });
			} else {
				pi.sendMessage({ customType: "caps-empty", content: "no caps files", display: true });
			}
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
				"  skip list                       — show current skip list\n" +
				"  skip add <name>                 — exclude a file from CAPS context\n" +
				"  skip remove <name>              — re-include a previously-skipped file\n" +
				"  skip reset                      — restore default skip list\n" +
				"  profile list                    — show saved profiles\n" +
				"  profile save <name>             — capture current toggles as named profile\n" +
				"  profile load <name> [--dry-run] — restore toggles from profile\n" +
				"  profile delete <name>           — remove a profile\n" +
				"  profile rename <old> <new>      — rename a profile\n" +
				"Skip changes take effect on pi restart. Profile changes apply immediately.",
				"info",
			);
			return;
		}

		if (sub === "profile") {
			await handleProfile(tokens.slice(1), ctx);
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

	const captureCurrentToggles = (): ToggleMap => {
		const map: ToggleMap = {};
		for (const f of rootFiles) map[f.relativePath] = f.enabled;
		for (const f of subdirFiles) map[f.relativePath] = f.enabled;
		return map;
	};

	const handleProfile = async (tokens: string[], ctx: any): Promise<void> => {
		const action = tokens[0];

		if (!action || action === "list") {
			const names = listProfiles(cwd);
			ctx.ui.notify(
				names.length === 0
					? "No profiles saved. Use /caps-profile save <name> to create one."
					: `Profiles (${names.length}):\n  ${names.join("\n  ")}`,
				"info",
			);
			return;
		}

		if (action === "save" || action === "load" || action === "delete") {
			const { name } = parseProfileArgTokens(tokens.slice(1));
			if (!isValidProfileName(name)) {
				ctx.ui.notify(`Invalid profile name. Use 1–50 chars, no leading/trailing whitespace.`, "warn");
				return;
			}

			if (action === "save") {
				const toggles = captureCurrentToggles();
				if (Object.keys(toggles).length === 0) {
					ctx.ui.notify("No project CAPS files loaded — nothing to capture.", "warn");
					return;
				}
				const { overwritten } = saveProfile(cwd, name, toggles);
				const enabled = Object.values(toggles).filter(Boolean).length;
				ctx.ui.notify(
					`${overwritten ? "Updated" : "Saved"} profile "${name}" — ${enabled}/${Object.keys(toggles).length} files enabled.`,
					"info",
				);
				return;
			}

			if (action === "delete") {
				const { deleted } = deleteProfile(cwd, name);
				ctx.ui.notify(
					deleted ? `Deleted profile "${name}".` : `Profile "${name}" not found.`,
					deleted ? "info" : "warn",
				);
				return;
			}

			const profile = loadProfileToggles(cwd, name);
			if (!profile) {
				ctx.ui.notify(`Profile "${name}" not found. /caps-profile to see saved profiles.`, "warn");
				return;
			}

			const dryRun = tokens.includes("--dry-run");
			if (dryRun) {
				const known = new Set<string>();
				for (const f of rootFiles) known.add(f.relativePath);
				for (const f of subdirFiles) known.add(f.relativePath);
				const d = diffProfile(captureCurrentToggles(), profile, known);
				const summary = `enable ${d.toEnable.length} · disable ${d.toDisable.length} · ${d.unchanged} unchanged` +
					(d.missing.length > 0 ? ` · ${d.missing.length} missing` : "");
				const lines = [`profile "${name}" (dry-run): ${summary}`];
				if (d.toEnable.length > 0) lines.push("  + " + d.toEnable.join(", "));
				if (d.toDisable.length > 0) lines.push("  − " + d.toDisable.join(", "));
				if (d.missing.length > 0) lines.push("  ? missing: " + d.missing.join(", "));
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			const d = applyProfileToggles(profile);
			pi.sendMessage({ customType: "caps-context", content: "CAPS context updated", display: true });
			const summary = `enable ${d.toEnable.length} · disable ${d.toDisable.length} · ${d.unchanged} unchanged` +
				(d.missing.length > 0 ? ` · ${d.missing.length} missing` : "");
			ctx.ui.notify(`Loaded profile "${name}" — ${summary}.`, "info");
			return;
		}

		if (action === "rename") {
			const oldName = tokens[1];
			const newName = tokens[2];
			if (!oldName || !newName) {
				ctx.ui.notify("Usage: /caps-advance profile rename <old> <new>", "warn");
				return;
			}
			if (!isValidProfileName(newName)) {
				ctx.ui.notify(`Invalid new name. Use 1–50 chars, no leading/trailing whitespace.`, "warn");
				return;
			}
			const { renamed, reason } = renameProfile(cwd, oldName, newName);
			if (renamed) {
				ctx.ui.notify(`Renamed "${oldName}" → "${newName}".`, "info");
				return;
			}
			const msg = reason === "missing" ? `Profile "${oldName}" not found.`
				: reason === "exists" ? `Profile "${newName}" already exists.`
				: `Old and new names are identical.`;
			ctx.ui.notify(msg, "warn");
			return;
		}

		ctx.ui.notify(`Unknown profile action: ${action}. Try /caps-profile help.`, "warn");
	};

	pi.registerCommand("caps-advance", {
		description: "Power-user config — skip list, profiles, budgets (v2.3+)",
		handler: async (args, ctx) => { await handleAdvance(args, ctx); },
	});

	const applyProfileToggles = (profile: ToggleMap): {
		toEnable: string[]; toDisable: string[]; unchanged: number; missing: string[];
	} => {
		const filesByPath = new Map<string, FileEntry>();
		for (const f of rootFiles) filesByPath.set(f.relativePath, f);
		for (const f of subdirFiles) filesByPath.set(f.relativePath, f);
		const current = captureCurrentToggles();
		const known = new Set(filesByPath.keys());
		const d = diffProfile(current, profile, known);
		for (const k of d.toEnable) { const f = filesByPath.get(k); if (f) f.enabled = true; }
		for (const k of d.toDisable) { const f = filesByPath.get(k); if (f) f.enabled = false; }
		persistProjectState();
		return d;
	};

	const restoreToggles = (snapshot: ToggleMap) => {
		for (const f of rootFiles) if (snapshot[f.relativePath] !== undefined) f.enabled = snapshot[f.relativePath];
		for (const f of subdirFiles) if (snapshot[f.relativePath] !== undefined) f.enabled = snapshot[f.relativePath];
		persistProjectState();
	};

	const openFilePickerForProfile = async (ctx: any): Promise<void> => {
		const allFiles = [...rootFiles, ...subdirFiles, ...globalFiles];
		if (allFiles.length === 0) {
			ctx.ui.notify("No CAPS files to pick from.", "warn");
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
	};

	const openNameInputOverlay = async (
		ctx: any,
		opts: { title: string; hint: string; existing: Set<string>; initial?: string },
	): Promise<string | null> => {
		let saved: string | null = null;
		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const overlay = new NameInputOverlay({
				title: opts.title,
				hint: opts.hint,
				existing: opts.existing,
				initial: opts.initial,
				theme,
			});
			overlay.onSave = (name) => { saved = name; done(); };
			overlay.onDiscard = () => { saved = null; done(); };
			return overlay;
		}, { overlay: true });
		return saved;
	};

	const runCreateProfileFlow = async (ctx: any): Promise<void> => {
		const snapshot = captureCurrentToggles();
		await openFilePickerForProfile(ctx);
		const existing = new Set(Object.keys(loadProfiles(cwd)));
		const name = await openNameInputOverlay(ctx, {
			title: "Name new profile",
			hint: "Captures the toggles you just set. Esc to discard (toggles will revert).",
			existing,
		});
		if (!name) {
			restoreToggles(snapshot);
			pi.sendMessage({ customType: "caps-context", content: "CAPS context updated", display: true });
			ctx.ui.notify("Profile discarded — toggles restored to previous state.", "info");
			return;
		}
		const toggles = captureCurrentToggles();
		saveProfile(cwd, name, toggles);
		const on = Object.values(toggles).filter(Boolean).length;
		ctx.ui.notify(`Saved profile "${name}" — ${on}/${Object.keys(toggles).length} files enabled.`, "info");
	};

	const runRenameProfileFlow = async (ctx: any, oldName: string): Promise<void> => {
		const existing = new Set(Object.keys(loadProfiles(cwd)).filter(n => n !== oldName));
		const newName = await openNameInputOverlay(ctx, {
			title: `Rename profile "${oldName}"`,
			hint: "Edit the name and press Enter. Esc to keep the current name.",
			existing,
			initial: oldName,
		});
		if (!newName || newName === oldName) {
			ctx.ui.notify("Rename discarded.", "info");
			return;
		}
		const { renamed, reason } = renameProfile(cwd, oldName, newName);
		if (renamed) {
			ctx.ui.notify(`Renamed "${oldName}" → "${newName}".`, "info");
			return;
		}
		const msg = reason === "missing" ? `Profile "${oldName}" not found.`
			: reason === "exists" ? `Profile "${newName}" already exists.`
			: "Rename failed.";
		ctx.ui.notify(msg, "warn");
	};

	const runEditProfileFlow = async (ctx: any, name: string): Promise<void> => {
		const toggles = loadProfileToggles(cwd, name);
		if (!toggles) { ctx.ui.notify(`Profile "${name}" not found.`, "warn"); return; }
		applyProfileToggles(toggles);
		await openFilePickerForProfile(ctx);
		const updated = captureCurrentToggles();
		saveProfile(cwd, name, updated);
		const on = Object.values(updated).filter(Boolean).length;
		ctx.ui.notify(`Updated profile "${name}" — ${on}/${Object.keys(updated).length} files enabled.`, "info");
	};

	const openProfileOverlay = async (ctx: any): Promise<void> => {
		let pendingCreate = false;
		let pendingRename: string | null = null;
		let pendingEdit: string | null = null;
		await ctx.ui.custom((_tui: any, theme: Theme, _kb: any, done: () => void) => {
			const filesByPath = new Set<string>();
			for (const f of rootFiles) filesByPath.add(f.relativePath);
			for (const f of subdirFiles) filesByPath.add(f.relativePath);
			const selector = new ProfileSelector(loadProfiles(cwd), captureCurrentToggles(), filesByPath, theme);
			selector.onAction = (a) => {
				if (a.kind === "quit") { done(); return; }
				if (a.kind === "create") { pendingCreate = true; done(); return; }
				if (a.kind === "rename") { pendingRename = a.name; done(); return; }
				if (a.kind === "edit") { pendingEdit = a.name; done(); return; }
				if (a.kind === "load") {
					const toggles = loadProfileToggles(cwd, a.name);
					if (!toggles) { ctx.ui.notify(`Profile "${a.name}" not found.`, "warn"); done(); return; }
					const d = applyProfileToggles(toggles);
					pi.sendMessage({ customType: "caps-context", content: "CAPS context updated", display: true });
					const summary = `enable ${d.toEnable.length} · disable ${d.toDisable.length} · ${d.unchanged} unchanged` +
						(d.missing.length > 0 ? ` · ${d.missing.length} missing` : "");
					ctx.ui.notify(`Loaded profile "${a.name}" — ${summary}.`, "info");
					done();
					return;
				}
				if (a.kind === "delete") {
					deleteProfile(cwd, a.name);
					selector.refresh(loadProfiles(cwd));
					ctx.ui.notify(`Deleted profile "${a.name}".`, "info");
				}
			};
			return selector;
		}, { overlay: true });
		if (pendingCreate) await runCreateProfileFlow(ctx);
		else if (pendingRename) await runRenameProfileFlow(ctx, pendingRename);
		else if (pendingEdit) await runEditProfileFlow(ctx, pendingEdit);
	};

	const handleCapsProfile = async (args: string, ctx: any): Promise<void> => {
		const tokens = args.trim().split(/\s+/).filter(Boolean);
		const sub = tokens[0];

		if (!sub) { await openProfileOverlay(ctx); return; }

		if (sub === "help") {
			ctx.ui.notify(
				"/caps-profile — named toggle snapshots\n" +
				"  /caps-profile                       — open overlay (pick to load/delete)\n" +
				"  /caps-profile list                  — show saved profiles as text\n" +
				"  /caps-profile save <name>           — capture current toggles\n" +
				"  /caps-profile rename <old> <new>    — rename a profile\n" +
				"Project-scoped (project + subdir toggles only). Global CAPS toggles untouched.",
				"info",
			);
			return;
		}

		await handleProfile(tokens, ctx);
	};

	pi.registerCommand("caps-profile", {
		description: "Named toggle snapshots — overlay picker + typed save/rename",
		handler: async (args, ctx) => { await handleCapsProfile(args, ctx); },
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

	pi.registerMessageRenderer("caps-empty", (_message, _options, theme) => {
		return new Text(
			theme.fg("dim", "[CAPS] No CAPS files found. Create STATUS.md or any ALL_CAPS.md file. /caps-doctor for diagnostics."),
			0, 0,
		);
	});

	pi.registerMessageRenderer("caps-doctor", (_message, _options, theme) => {
		if (!doctorInputs) return new Text(theme.fg("dim", "[CAPS Doctor] no report — run /caps-doctor"), 0, 0);
		return new Text(buildDoctorReport(doctorInputs, theme), 0, 0);
	});

	const handleDoctor = async (args: string, ctx: any): Promise<void> => {
		const tokens = args.trim().split(/\s+/).filter(Boolean);
		const wantVerbose = tokens.includes("--verbose") || tokens.includes("-v");
		const wantHelp = tokens.includes("help") || tokens.includes("--help");

		if (wantHelp) {
			ctx.ui.notify(
				"/caps-doctor — diagnose CAPS loading\n" +
				"  /caps-doctor             — show status, loaded files, skip reasons, config sources\n" +
				"  /caps-doctor --verbose   — also list every entry in cwd with classification",
				"info",
			);
			return;
		}

		const projectConfigPath = path.join(cwd, ".pi", PROJECT_CONFIG_NAME);
		const stateFilePath = path.join(cwd, ".pi", STATE_FILE);
		const inspection = await inspectDirectory(cwd, config);

		doctorInputs = {
			cwd,
			globalCapsDir: path.join(os.homedir(), ".pi", "CAPS"),
			stateFilePath,
			stateFileExists: fs.existsSync(stateFilePath),
			projectConfigPath,
			projectConfigExists: fs.existsSync(projectConfigPath),
			globalConfigPath: GLOBAL_CONFIG_PATH,
			globalConfigExists: fs.existsSync(GLOBAL_CONFIG_PATH),
			rootFiles,
			subdirFiles,
			globalFiles,
			watcherCount: watchers.length,
			lastInjection,
			inspection,
			verbose: wantVerbose,
		};
		pi.sendMessage({ customType: "caps-doctor", content: "report", display: true });
	};

	pi.registerCommand("caps-doctor", {
		description: "Diagnose CAPS discovery, state, config sources",
		handler: async (args, ctx) => { await handleDoctor(args, ctx); },
	});
}
