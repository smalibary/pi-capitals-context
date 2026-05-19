import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { FileEntry } from "./types.js";

export const STATE_FILE = "caps-context-state.json";
export const GLOBAL_STATE_FILE = path.join(os.homedir(), ".pi", "caps-global-state.json");

export function validateState(raw: unknown): Record<string, boolean> {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const result: Record<string, boolean> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof v === "boolean") result[k] = v;
	}
	return result;
}

export function loadState(cwd: string): Record<string, boolean> {
	try { return validateState(JSON.parse(fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8"))); }
	catch { return {}; }
}

export function saveState(cwd: string, files: FileEntry[]) {
	const dir = path.join(cwd, ".pi");
	try { fs.mkdirSync(dir, { recursive: true }); } catch {}
	const state: Record<string, boolean> = {};
	for (const f of files) state[f.relativePath] = f.enabled;
	const target = path.join(dir, STATE_FILE);
	const tmp = target + ".tmp";
	try { fs.writeFileSync(tmp, JSON.stringify(state, null, "\t")); fs.renameSync(tmp, target); }
	catch { try { fs.unlinkSync(tmp); } catch {} }
}

export function loadGlobalState(): Record<string, boolean> {
	try { return validateState(JSON.parse(fs.readFileSync(GLOBAL_STATE_FILE, "utf-8"))); }
	catch { return {}; }
}

export function saveGlobalState(files: FileEntry[]) {
	const state: Record<string, boolean> = {};
	for (const f of files) state[f.relativePath] = f.enabled;
	const tmp = GLOBAL_STATE_FILE + ".tmp";
	try { fs.writeFileSync(tmp, JSON.stringify(state, null, "\t")); fs.renameSync(tmp, GLOBAL_STATE_FILE); }
	catch { try { fs.unlinkSync(tmp); } catch {} }
}
