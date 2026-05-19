import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export const CAPS_FILE_RE = /^[A-Z][A-Z0-9_]*\.md$/;
export const CAPS_DIR_RE = /^[A-Z][A-Z0-9_]*$/;
export const SKIP_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);
export const SKIP_DIRS = new Set(["AGENTS", "CLAUDE", "NODE_MODULES"]);
export const TEXT_EXTENSIONS = new Set([".md", ".txt", ".yaml", ".yml", ".json", ".toml"]);
export const GLOBAL_CAPS_DIR = path.join(os.homedir(), ".pi", "CAPS");

export async function findCapsFiles(dir: string): Promise<string[]> {
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		return entries
			.filter(e => e.isFile() && CAPS_FILE_RE.test(e.name) && !SKIP_FILES.has(e.name))
			.map(e => path.join(dir, e.name));
	} catch { return []; }
}

export async function findAllText(dir: string): Promise<string[]> {
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

export async function findCapsDirs(dir: string): Promise<{ dirName: string; files: string[] }[]> {
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

export async function readFileContent(fp: string, cwd: string): Promise<{ relativePath: string; content: string } | null> {
	try {
		const content = await fsp.readFile(fp, "utf-8");
		return { relativePath: path.relative(cwd, fp).replace(/\\/g, "/"), content };
	} catch { return null; }
}

export async function extractSubdirs(text: string, cwd: string): Promise<Set<string>> {
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
