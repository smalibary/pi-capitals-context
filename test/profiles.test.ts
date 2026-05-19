import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	loadProfiles,
	saveProfile,
	loadProfileToggles,
	deleteProfile,
	renameProfile,
	listProfiles,
	isValidProfileName,
	diffProfile,
	parseProfileArgTokens,
	PROFILES_FILE,
} from "../src/profiles.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-profiles-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

function readFile(): string {
	return fs.readFileSync(path.join(cwd, ".pi", PROFILES_FILE), "utf-8");
}

describe("loadProfiles", () => {
	it("returns empty store when no file exists", () => {
		expect(loadProfiles(cwd)).toEqual({});
	});

	it("returns parsed store when file exists", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(
			path.join(cwd, ".pi", PROFILES_FILE),
			JSON.stringify({ api: { "STATUS.md": true } }),
		);
		expect(loadProfiles(cwd)).toEqual({ api: { "STATUS.md": true } });
	});

	it("ignores malformed entries", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(
			path.join(cwd, ".pi", PROFILES_FILE),
			JSON.stringify({
				good: { "X.md": true, "Y.md": false },
				bad: "not-an-object",
				partial: { "X.md": true, "Y.md": "not-a-bool" },
			}),
		);
		const store = loadProfiles(cwd);
		expect(store.good).toEqual({ "X.md": true, "Y.md": false });
		expect(store.bad).toBeUndefined();
		expect(store.partial).toEqual({ "X.md": true });
	});

	it("returns empty store on invalid JSON", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(path.join(cwd, ".pi", PROFILES_FILE), "{not-json");
		expect(loadProfiles(cwd)).toEqual({});
	});
});

describe("saveProfile", () => {
	it("creates store with new profile", () => {
		const r = saveProfile(cwd, "api", { "STATUS.md": true, "API.md": true });
		expect(r.overwritten).toBe(false);
		const parsed = JSON.parse(readFile());
		expect(parsed.api).toEqual({ "STATUS.md": true, "API.md": true });
	});

	it("overwrites an existing profile", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		const r = saveProfile(cwd, "api", { "API.md": false });
		expect(r.overwritten).toBe(true);
		const parsed = JSON.parse(readFile());
		expect(parsed.api).toEqual({ "API.md": false });
	});

	it("preserves other profiles", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		saveProfile(cwd, "fe", { "UI.md": true });
		const parsed = JSON.parse(readFile());
		expect(Object.keys(parsed).sort()).toEqual(["api", "fe"]);
	});
});

describe("loadProfileToggles", () => {
	it("returns the toggle map for a known profile", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		expect(loadProfileToggles(cwd, "api")).toEqual({ "STATUS.md": true });
	});

	it("returns null for an unknown profile", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		expect(loadProfileToggles(cwd, "nope")).toBeNull();
	});

	it("returns null when no store exists", () => {
		expect(loadProfileToggles(cwd, "anything")).toBeNull();
	});
});

describe("deleteProfile", () => {
	it("removes the profile and writes the store", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		saveProfile(cwd, "fe", { "UI.md": true });
		const r = deleteProfile(cwd, "api");
		expect(r.deleted).toBe(true);
		const parsed = JSON.parse(readFile());
		expect(parsed.api).toBeUndefined();
		expect(parsed.fe).toEqual({ "UI.md": true });
	});

	it("returns deleted=false when profile does not exist", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		const r = deleteProfile(cwd, "nope");
		expect(r.deleted).toBe(false);
	});
});

describe("renameProfile", () => {
	it("renames an existing profile", () => {
		saveProfile(cwd, "api", { "STATUS.md": true });
		const r = renameProfile(cwd, "api", "backend");
		expect(r.renamed).toBe(true);
		const parsed = JSON.parse(readFile());
		expect(parsed.api).toBeUndefined();
		expect(parsed.backend).toEqual({ "STATUS.md": true });
	});

	it("refuses when source missing", () => {
		const r = renameProfile(cwd, "missing", "new");
		expect(r.renamed).toBe(false);
		expect(r.reason).toBe("missing");
	});

	it("refuses when target exists", () => {
		saveProfile(cwd, "a", { "X.md": true });
		saveProfile(cwd, "b", { "Y.md": true });
		const r = renameProfile(cwd, "a", "b");
		expect(r.renamed).toBe(false);
		expect(r.reason).toBe("exists");
	});

	it("refuses when names equal", () => {
		saveProfile(cwd, "a", { "X.md": true });
		const r = renameProfile(cwd, "a", "a");
		expect(r.renamed).toBe(false);
		expect(r.reason).toBe("same");
	});
});

describe("listProfiles", () => {
	it("returns names sorted alphabetically", () => {
		saveProfile(cwd, "zeta", {});
		saveProfile(cwd, "alpha", {});
		saveProfile(cwd, "mid", {});
		expect(listProfiles(cwd)).toEqual(["alpha", "mid", "zeta"]);
	});

	it("returns empty array when no store exists", () => {
		expect(listProfiles(cwd)).toEqual([]);
	});
});

describe("isValidProfileName", () => {
	it("accepts simple names", () => {
		expect(isValidProfileName("api")).toBe(true);
		expect(isValidProfileName("api-work")).toBe(true);
		expect(isValidProfileName("Frontend 2")).toBe(true);
	});

	it("rejects empty / whitespace-only names", () => {
		expect(isValidProfileName("")).toBe(false);
		expect(isValidProfileName("   ")).toBe(false);
	});

	it("rejects names with leading/trailing whitespace", () => {
		expect(isValidProfileName(" api")).toBe(false);
		expect(isValidProfileName("api ")).toBe(false);
	});

	it("rejects overly long names", () => {
		expect(isValidProfileName("a".repeat(51))).toBe(false);
		expect(isValidProfileName("a".repeat(50))).toBe(true);
	});
});

describe("diffProfile", () => {
	it("classifies enable/disable/unchanged/missing", () => {
		const current = { "A.md": true, "B.md": false, "C.md": true };
		const profile = { "A.md": false, "B.md": true, "C.md": true, "D.md": true };
		const known = new Set(["A.md", "B.md", "C.md"]);
		const d = diffProfile(current, profile, known);
		expect(d.toDisable).toEqual(["A.md"]);
		expect(d.toEnable).toEqual(["B.md"]);
		expect(d.unchanged).toBe(1);
		expect(d.missing).toEqual(["D.md"]);
	});

	it("treats missing current keys as false", () => {
		const profile = { "X.md": true };
		const d = diffProfile({}, profile, new Set(["X.md"]));
		expect(d.toEnable).toEqual(["X.md"]);
		expect(d.toDisable).toEqual([]);
	});
});

describe("parseProfileArgTokens", () => {
	it("strips --flags from the name", () => {
		const r = parseProfileArgTokens(["api-work", "--dry-run"]);
		expect(r.name).toBe("api-work");
		expect(r.flags).toEqual(["--dry-run"]);
	});

	it("supports multi-word names", () => {
		const r = parseProfileArgTokens(["api", "work"]);
		expect(r.name).toBe("api work");
		expect(r.flags).toEqual([]);
	});

	it("returns empty name when only flags given", () => {
		const r = parseProfileArgTokens(["--dry-run"]);
		expect(r.name).toBe("");
		expect(r.flags).toEqual(["--dry-run"]);
	});

	it("handles flags in any position", () => {
		const r = parseProfileArgTokens(["--dry-run", "api-work"]);
		expect(r.name).toBe("api-work");
		expect(r.flags).toEqual(["--dry-run"]);
	});
});

describe("atomicity", () => {
	it("does not leave .tmp file after successful write", () => {
		saveProfile(cwd, "x", { "Y.md": true });
		const dirEntries = fs.readdirSync(path.join(cwd, ".pi"));
		expect(dirEntries.some(e => e.endsWith(".tmp"))).toBe(false);
	});
});
