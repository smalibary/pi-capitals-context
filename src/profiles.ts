import * as fs from "node:fs";
import * as path from "node:path";

export const PROFILES_FILE = "caps-profiles.json";

export type ToggleMap = Record<string, boolean>;
export type ProfileStore = Record<string, ToggleMap>;

function profilesPath(cwd: string): string {
	return path.join(cwd, ".pi", PROFILES_FILE);
}

function validateStore(raw: unknown): ProfileStore {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
	const out: ProfileStore = {};
	for (const [name, map] of Object.entries(raw as Record<string, unknown>)) {
		if (typeof map !== "object" || map === null || Array.isArray(map)) continue;
		const toggles: ToggleMap = {};
		for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
			if (typeof v === "boolean") toggles[k] = v;
		}
		out[name] = toggles;
	}
	return out;
}

export function loadProfiles(cwd: string): ProfileStore {
	try { return validateStore(JSON.parse(fs.readFileSync(profilesPath(cwd), "utf-8"))); }
	catch { return {}; }
}

function writeStore(cwd: string, store: ProfileStore): void {
	const dir = path.join(cwd, ".pi");
	fs.mkdirSync(dir, { recursive: true });
	const target = profilesPath(cwd);
	const tmp = target + ".tmp";
	try {
		fs.writeFileSync(tmp, JSON.stringify(store, null, "\t"));
		fs.renameSync(tmp, target);
	} catch {
		try { fs.unlinkSync(tmp); } catch {}
		throw new Error("failed to write " + target);
	}
}

export function parseProfileArgTokens(tokens: string[]): { name: string; flags: string[] } {
	const flags: string[] = [];
	const nameParts: string[] = [];
	for (const t of tokens) {
		if (t.startsWith("--")) flags.push(t);
		else nameParts.push(t);
	}
	return { name: nameParts.join(" ").trim(), flags };
}

export function isValidProfileName(name: string): boolean {
	if (typeof name !== "string") return false;
	const trimmed = name.trim();
	if (trimmed.length === 0 || trimmed.length > 50) return false;
	return trimmed === name;
}

export function listProfiles(cwd: string): string[] {
	return Object.keys(loadProfiles(cwd)).sort();
}

export function saveProfile(cwd: string, name: string, toggles: ToggleMap): { overwritten: boolean } {
	const store = loadProfiles(cwd);
	const overwritten = Object.prototype.hasOwnProperty.call(store, name);
	store[name] = { ...toggles };
	writeStore(cwd, store);
	return { overwritten };
}

export function loadProfileToggles(cwd: string, name: string): ToggleMap | null {
	const store = loadProfiles(cwd);
	return Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null;
}

export function deleteProfile(cwd: string, name: string): { deleted: boolean } {
	const store = loadProfiles(cwd);
	if (!Object.prototype.hasOwnProperty.call(store, name)) return { deleted: false };
	delete store[name];
	writeStore(cwd, store);
	return { deleted: true };
}

export function renameProfile(
	cwd: string,
	oldName: string,
	newName: string,
): { renamed: boolean; reason?: "missing" | "exists" | "same" } {
	const store = loadProfiles(cwd);
	if (oldName === newName) return { renamed: false, reason: "same" };
	if (!Object.prototype.hasOwnProperty.call(store, oldName)) return { renamed: false, reason: "missing" };
	if (Object.prototype.hasOwnProperty.call(store, newName)) return { renamed: false, reason: "exists" };
	store[newName] = store[oldName];
	delete store[oldName];
	writeStore(cwd, store);
	return { renamed: true };
}

export interface ProfileDiff {
	toEnable: string[];
	toDisable: string[];
	unchanged: number;
	missing: string[];
}

export function diffProfile(
	current: ToggleMap,
	profile: ToggleMap,
	knownPaths: Set<string>,
): ProfileDiff {
	const toEnable: string[] = [];
	const toDisable: string[] = [];
	const missing: string[] = [];
	let unchanged = 0;
	for (const [k, desired] of Object.entries(profile)) {
		if (!knownPaths.has(k)) { missing.push(k); continue; }
		const cur = current[k] ?? false;
		if (cur === desired) { unchanged++; continue; }
		if (desired) toEnable.push(k); else toDisable.push(k);
	}
	return { toEnable, toDisable, unchanged, missing };
}
