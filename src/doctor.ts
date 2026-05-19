import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { CapsConfig } from "./config.js";
import type { FileEntry } from "./types.js";
import { estimateTokens, formatTokens } from "./tokens.js";

export interface InspectedEntry {
	name: string;
	fullPath: string;
	type: "file" | "dir" | "symlink";
	included: boolean;
	reason: string;
	size?: number;
}

function formatBytes(n: number): string {
	if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
	return `${n}B`;
}

export async function inspectDirectory(dir: string, config: CapsConfig): Promise<InspectedEntry[]> {
	const out: InspectedEntry[] = [];
	let items;
	try { items = await fsp.readdir(dir, { withFileTypes: true }); }
	catch { return out; }

	for (const e of items) {
		const fullPath = path.join(dir, e.name);

		if (e.isSymbolicLink()) {
			out.push({ name: e.name, fullPath, type: "symlink", included: false, reason: "symlink (refused for safety)" });
			continue;
		}

		if (e.isDirectory()) {
			const matchesRegex = config.capsDirRe.test(e.name);
			const inSkip = config.skipDirs.has(e.name);
			let reason: string;
			let included = false;
			if (inSkip) reason = "in skipDirs list";
			else if (!matchesRegex) reason = "not a CAPS dir (regex mismatch)";
			else { reason = "CAPS dir"; included = true; }
			out.push({ name: e.name, fullPath, type: "dir", included, reason });
			continue;
		}

		if (e.isFile()) {
			const matchesRegex = config.capsFileRe.test(e.name);
			const inSkip = config.skipFiles.has(e.name);
			let size: number | undefined;
			let tooLarge = false;
			try {
				const stat = await fsp.stat(fullPath);
				size = stat.size;
				tooLarge = size > config.maxFileSizeBytes;
			} catch {}

			let reason: string;
			let included = false;
			if (!matchesRegex) reason = "filename doesn't match CAPS pattern";
			else if (inSkip) reason = "in skipFiles list";
			else if (tooLarge) reason = `too large (${formatBytes(size!)} > ${formatBytes(config.maxFileSizeBytes)})`;
			else { reason = "ok"; included = true; }

			out.push({ name: e.name, fullPath, type: "file", included, reason, ...(size !== undefined ? { size } : {}) });
		}
	}
	return out;
}

export interface DoctorInputs {
	cwd: string;
	globalCapsDir: string;
	stateFilePath: string;
	stateFileExists: boolean;
	projectConfigPath: string;
	projectConfigExists: boolean;
	globalConfigPath: string;
	globalConfigExists: boolean;
	rootFiles: FileEntry[];
	subdirFiles: FileEntry[];
	globalFiles: FileEntry[];
	watcherCount: number;
	lastInjection: string;
	inspection: InspectedEntry[];
	verbose: boolean;
}

export function buildDoctorReport(inputs: DoctorInputs, theme: Theme): string {
	const lines: string[] = [];
	const h = (s: string) => theme.fg("accent", s);
	const m = (s: string) => theme.fg("muted", s);
	const d = (s: string) => theme.fg("dim", s);

	lines.push(h("[CAPS Doctor]"));
	lines.push(m(`  cwd:        `) + inputs.cwd);
	lines.push(m(`  global:     `) + inputs.globalCapsDir);
	lines.push(m(`  state file: `) + inputs.stateFilePath + d(inputs.stateFileExists ? " (exists)" : " (missing — will be created on first toggle)"));
	lines.push(m(`  watchers:   `) + `${inputs.watcherCount} active`);
	const injSize = Buffer.byteLength(inputs.lastInjection, "utf-8");
	const injTok = estimateTokens(inputs.lastInjection);
	lines.push(m(`  last inj.:  `) + (inputs.lastInjection ? `${formatBytes(injSize)} / ${formatTokens(injTok)} tokens` : d("none yet — send a message first")));
	lines.push("");

	lines.push(h("Loaded files"));
	if (inputs.rootFiles.length === 0 && inputs.subdirFiles.length === 0 && inputs.globalFiles.length === 0) {
		lines.push(d("  none loaded — create STATUS.md or any ALL_CAPS.md file to start"));
	} else {
		for (const f of inputs.rootFiles) {
			lines.push(m(`  ${f.relativePath}`) + d(f.enabled ? " · enabled" : " · disabled"));
		}
		for (const f of inputs.subdirFiles) {
			lines.push(m(`  ${f.relativePath}`) + d(f.enabled ? " · subdir-loaded" : " · subdir-loaded · disabled"));
		}
		for (const f of inputs.globalFiles) {
			lines.push(m(`  ${f.relativePath}`) + d(f.enabled ? " · global" : " · global · disabled"));
		}
	}
	lines.push("");

	lines.push(h("Project directory scan"));
	const included = inputs.inspection.filter(e => e.included);
	const skipped = inputs.inspection.filter(e => !e.included);
	lines.push(d(`  ${included.length} included · ${skipped.length} skipped`));

	if (inputs.verbose) {
		for (const e of inputs.inspection) {
			const mark = e.included ? "✓" : "✗";
			const sizeStr = e.size !== undefined ? d(` (${formatBytes(e.size)})`) : "";
			lines.push(`  ${e.included ? theme.fg("accent", mark) : theme.fg("dim", mark)} ` + m(e.name) + sizeStr + d(` — ${e.reason}`));
		}
	} else {
		const interesting = skipped.filter(e => !e.reason.startsWith("filename doesn't match") && !e.reason.startsWith("not a CAPS dir"));
		for (const e of interesting) {
			const sizeStr = e.size !== undefined ? d(` (${formatBytes(e.size)})`) : "";
			lines.push(d("  ✗ ") + m(e.name) + sizeStr + d(` — ${e.reason}`));
		}
		if (skipped.length > interesting.length) {
			lines.push(d(`  (${skipped.length - interesting.length} more uninteresting skips — /caps-doctor --verbose for full trace)`));
		}
	}
	lines.push("");

	lines.push(h("Config sources"));
	lines.push(m(`  defaults:  `) + d("built-in"));
	lines.push(m(`  global:    `) + inputs.globalConfigPath + d(inputs.globalConfigExists ? " (active)" : " (none)"));
	lines.push(m(`  project:   `) + inputs.projectConfigPath + d(inputs.projectConfigExists ? " (active — overrides defaults)" : " (none — /caps-advance skip add/remove to override)"));

	return lines.join("\n");
}
