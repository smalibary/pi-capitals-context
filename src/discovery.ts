import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { CapsConfig } from "./config.js";
import { defaultConfig } from "./config.js";

export const GLOBAL_CAPS_DIR = path.join(os.homedir(), ".pi", "CAPS");

export async function findCapsFiles(dir: string, config: CapsConfig = defaultConfig()): Promise<string[]> {
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		return entries
			.filter(e => e.isFile() && config.capsFileRe.test(e.name) && !config.skipFiles.has(e.name))
			.map(e => path.join(dir, e.name));
	} catch { return []; }
}

export async function findAllText(dir: string, config: CapsConfig = defaultConfig(), depth = 0): Promise<string[]> {
	if (depth >= config.maxRecursionDepth) return [];
	const results: string[] = [];
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			if (e.isSymbolicLink()) continue;
			const full = path.join(dir, e.name);
			if (e.isDirectory()) {
				if (config.skipDirs.has(e.name)) continue;
				results.push(...await findAllText(full, config, depth + 1));
			} else if (e.isFile() && config.textExtensions.has(path.extname(e.name).toLowerCase())) {
				results.push(full);
			}
		}
	} catch {}
	return results;
}

export async function findCapsDirs(dir: string, config: CapsConfig = defaultConfig()): Promise<{ dirName: string; files: string[] }[]> {
	const results: { dirName: string; files: string[] }[] = [];
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			if (!e.isDirectory() || e.isSymbolicLink()) continue;
			if (!config.capsDirRe.test(e.name) || config.skipDirs.has(e.name)) continue;
			const files = await findAllText(path.join(dir, e.name), config);
			if (files.length > 0) results.push({ dirName: e.name, files });
		}
	} catch {}
	return results;
}

export async function readFileContent(
	fp: string,
	cwd: string,
	config: CapsConfig = defaultConfig(),
): Promise<{ relativePath: string; content: string } | null> {
	try {
		const lstat = await fsp.lstat(fp);
		if (lstat.isSymbolicLink()) return null;
		if (lstat.size > config.maxFileSizeBytes) return null;
		const content = await fsp.readFile(fp, "utf-8");
		return { relativePath: path.relative(cwd, fp).replace(/\\/g, "/"), content };
	} catch { return null; }
}

export async function extractSubdirs(text: string, cwd: string, config: CapsConfig = defaultConfig()): Promise<Set<string>> {
	const dirs = new Set<string>();
	let realDirs: string[] = [];
	try {
		const entries = await fsp.readdir(cwd, { withFileTypes: true });
		realDirs = entries
			.filter(e => e.isDirectory() && !e.isSymbolicLink() && !config.skipDirs.has(e.name))
			.map(e => e.name);
	} catch { return dirs; }
	const re = /(?:\.?[/\\])?([A-Za-z0-9_-]+)[/\\][\w./\\-]+/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		if (realDirs.includes(m[1])) dirs.add(path.join(cwd, m[1]));
	}
	return dirs;
}
