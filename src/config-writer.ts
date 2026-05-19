import * as fs from "node:fs";
import * as path from "node:path";
import { DEFAULT_SKIP_FILES, PROJECT_CONFIG_NAME } from "./config.js";

interface RawProjectConfig {
	skipFiles?: string[];
	skipDirs?: string[];
	capsFilePattern?: string;
	capsDirPattern?: string;
	textExtensions?: string[];
	maxFileSizeBytes?: number;
	maxRecursionDepth?: number;
	maxSubdirFiles?: number;
}

function configPath(cwd: string): string {
	return path.join(cwd, ".pi", PROJECT_CONFIG_NAME);
}

export function readRawProjectConfig(cwd: string): RawProjectConfig {
	try {
		const raw = JSON.parse(fs.readFileSync(configPath(cwd), "utf-8"));
		if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return raw as RawProjectConfig;
	} catch {}
	return {};
}

function writeRawProjectConfig(cwd: string, raw: RawProjectConfig): void {
	const dir = path.join(cwd, ".pi");
	fs.mkdirSync(dir, { recursive: true });
	const target = configPath(cwd);
	const tmp = target + ".tmp";
	try {
		fs.writeFileSync(tmp, JSON.stringify(raw, null, "\t"));
		fs.renameSync(tmp, target);
	} catch {
		try { fs.unlinkSync(tmp); } catch {}
		throw new Error("failed to write " + target);
	}
}

function ensureSkipList(raw: RawProjectConfig): string[] {
	if (!Array.isArray(raw.skipFiles)) return [...DEFAULT_SKIP_FILES];
	return raw.skipFiles.filter((s): s is string => typeof s === "string");
}

export function addSkipFile(cwd: string, name: string): { added: boolean; list: string[] } {
	const raw = readRawProjectConfig(cwd);
	const list = ensureSkipList(raw);
	if (list.includes(name)) return { added: false, list };
	list.push(name);
	raw.skipFiles = list;
	writeRawProjectConfig(cwd, raw);
	return { added: true, list };
}

export function removeSkipFile(cwd: string, name: string): { removed: boolean; list: string[] } {
	const raw = readRawProjectConfig(cwd);
	const list = ensureSkipList(raw);
	const i = list.indexOf(name);
	if (i === -1) return { removed: false, list };
	list.splice(i, 1);
	raw.skipFiles = list;
	writeRawProjectConfig(cwd, raw);
	return { removed: true, list };
}

export function resetSkipFiles(cwd: string): { list: string[] } {
	const raw = readRawProjectConfig(cwd);
	delete raw.skipFiles;
	writeRawProjectConfig(cwd, raw);
	return { list: [...DEFAULT_SKIP_FILES] };
}

export function listSkipFiles(cwd: string): { list: string[]; source: "default" | "project" } {
	const raw = readRawProjectConfig(cwd);
	if (Array.isArray(raw.skipFiles)) {
		return { list: raw.skipFiles.filter((s): s is string => typeof s === "string"), source: "project" };
	}
	return { list: [...DEFAULT_SKIP_FILES], source: "default" };
}
