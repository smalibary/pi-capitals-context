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
 *
 * Place in ~/.pi/agent/extensions/ or .pi/extensions/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);

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

// Extract top-level subdirectory names from a blob of text
function extractSubdirs(text: string, cwd: string): Set<string> {
	const dirs = new Set<string>();
	let realDirs: string[] = [];
	try { realDirs = fs.readdirSync(cwd, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
	catch { return dirs; }

	// Strategy 1: match paths with slashes (MGMT5701/foo, ./MGMT5701/foo, etc)
	const re = /(?:\.?[/\\])?([A-Za-z0-9_-]+)[/\\][\w./\\-]+/g;
	let match;
	while ((match = re.exec(text)) !== null) {
		const candidate = match[1];
		if (realDirs.includes(candidate)) dirs.add(path.join(cwd, candidate));
	}

	// Strategy 2: match bare subdirectory names (user types "MGMT5701" with no slash)
	const lower = text.toLowerCase();
	for (const dir of realDirs) {
		if (lower.includes(dir.toLowerCase())) {
			dirs.add(path.join(cwd, dir));
		}
	}

	return dirs;
}

function updateWidget(ctx: any, files: { relativePath: string; content: string }[]) {
	if (!ctx.hasUI || files.length === 0) return;
	const lines = files.map((f) => `  ${f.relativePath}`);
	ctx.ui.setWidget("caps-context", lines);
}

export default function capitalsContextExtension(pi: ExtensionAPI) {
	let rootFiles: { relativePath: string; content: string }[] = [];
	let cwd = "";

	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd;
		const paths = findCapsFiles(cwd);
		rootFiles = paths.map((p) => readFileContent(p, cwd)).filter((f): f is NonNullable<typeof f> => f !== null);
		updateWidget(ctx, rootFiles);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setWidget("caps-context", undefined);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const seenPaths = new Set<string>();
		const allFiles = rootFiles.filter((f) => {
			if (seenPaths.has(f.relativePath)) return false;
			seenPaths.add(f.relativePath);
			return true;
		});

		try {
			const subdirs = new Set<string>();

			// 1. Scan current prompt for subdirectory references
			for (const dir of extractSubdirs(event.prompt, cwd)) subdirs.add(dir);

			// 2. Scan session history for subdirectory references
			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "tool_call" && entry.input) {
					const inputStr = typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input);
					for (const dir of extractSubdirs(inputStr, cwd)) subdirs.add(dir);
				}
			}

			// 3. Scan each subdirectory for caps files
			for (const dir of subdirs) {
				const subPaths = findCapsFiles(dir);
				for (const p of subPaths) {
					const file = readFileContent(p, cwd);
					if (file && !seenPaths.has(file.relativePath)) {
						seenPaths.add(file.relativePath);
						allFiles.push(file);
					}
				}
			}

			// Update widget with all loaded files (root + subdirs)
			updateWidget(ctx, allFiles);
		} catch { /* fallback to root files only */ }

		if (allFiles.length === 0) return;

		let extra = "\n\n## Additional Context (CAPS files)\n";
		for (const f of allFiles) {
			extra += `\n### ${f.relativePath}\n\n${f.content}\n`;
		}

		return { systemPrompt: event.systemPrompt + extra };
	});
}
