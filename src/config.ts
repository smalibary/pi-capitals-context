import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface CapsConfig {
	skipFiles: Set<string>;
	skipDirs: Set<string>;
	capsFileRe: RegExp;
	capsDirRe: RegExp;
	textExtensions: Set<string>;
	maxFileSizeBytes: number;
	maxRecursionDepth: number;
	maxSubdirFiles: number;
}

export const DEFAULT_SKIP_FILES = [
	"AGENTS.md",
	"CLAUDE.md",
	"LICENSE",
	"LICENSE.md",
	"README.md",
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"CODE_OF_CONDUCT.md",
	"SECURITY.md",
	"MAINTAINING.md",
	"ROADMAP.md",
];

export const DEFAULT_SKIP_DIRS = [
	"AGENTS",
	"CLAUDE",
	"NODE_MODULES",
	"node_modules",
	".git",
	".pi",
];

export const DEFAULT_CAPS_FILE_PATTERN = "^[A-Z][A-Z0-9_]*\\.md$";
export const DEFAULT_CAPS_DIR_PATTERN = "^[A-Z][A-Z0-9_]*$";
export const DEFAULT_TEXT_EXTENSIONS = [".md", ".txt", ".yaml", ".yml", ".json", ".toml"];
export const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024;
export const DEFAULT_MAX_RECURSION_DEPTH = 6;
export const DEFAULT_MAX_SUBDIR_FILES = 20;

export function defaultConfig(): CapsConfig {
	return {
		skipFiles: new Set(DEFAULT_SKIP_FILES),
		skipDirs: new Set(DEFAULT_SKIP_DIRS),
		capsFileRe: new RegExp(DEFAULT_CAPS_FILE_PATTERN),
		capsDirRe: new RegExp(DEFAULT_CAPS_DIR_PATTERN),
		textExtensions: new Set(DEFAULT_TEXT_EXTENSIONS),
		maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
		maxRecursionDepth: DEFAULT_MAX_RECURSION_DEPTH,
		maxSubdirFiles: DEFAULT_MAX_SUBDIR_FILES,
	};
}

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), ".pi", "caps-config.json");
export const PROJECT_CONFIG_NAME = "caps-config.json";

interface RawConfig {
	skipFiles?: unknown;
	skipDirs?: unknown;
	capsFilePattern?: unknown;
	capsDirPattern?: unknown;
	textExtensions?: unknown;
	maxFileSizeBytes?: unknown;
	maxRecursionDepth?: unknown;
	maxSubdirFiles?: unknown;
}

function safePositiveInt(v: unknown, fallback: number): number {
	if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
	return Math.floor(v);
}

function readJsonSafe(p: string): RawConfig | null {
	try { return JSON.parse(fs.readFileSync(p, "utf-8")) as RawConfig; }
	catch { return null; }
}

function arrayOfStrings(v: unknown): string[] | null {
	if (!Array.isArray(v)) return null;
	return v.filter((x): x is string => typeof x === "string");
}

function safeRegex(v: unknown, fallback: RegExp): RegExp {
	if (typeof v !== "string") return fallback;
	try { return new RegExp(v); } catch { return fallback; }
}

function mergeConfig(raw: RawConfig | null, base: CapsConfig): CapsConfig {
	if (!raw) return base;
	const skipFiles = arrayOfStrings(raw.skipFiles);
	const skipDirs = arrayOfStrings(raw.skipDirs);
	const textExts = arrayOfStrings(raw.textExtensions);
	return {
		skipFiles: skipFiles ? new Set(skipFiles) : base.skipFiles,
		skipDirs: skipDirs ? new Set(skipDirs) : base.skipDirs,
		capsFileRe: safeRegex(raw.capsFilePattern, base.capsFileRe),
		capsDirRe: safeRegex(raw.capsDirPattern, base.capsDirRe),
		textExtensions: textExts ? new Set(textExts) : base.textExtensions,
		maxFileSizeBytes: safePositiveInt(raw.maxFileSizeBytes, base.maxFileSizeBytes),
		maxRecursionDepth: safePositiveInt(raw.maxRecursionDepth, base.maxRecursionDepth),
		maxSubdirFiles: safePositiveInt(raw.maxSubdirFiles, base.maxSubdirFiles),
	};
}

export function loadConfig(cwd: string): CapsConfig {
	let cfg = defaultConfig();
	cfg = mergeConfig(readJsonSafe(GLOBAL_CONFIG_PATH), cfg);
	cfg = mergeConfig(readJsonSafe(path.join(cwd, ".pi", PROJECT_CONFIG_NAME)), cfg);
	return cfg;
}
