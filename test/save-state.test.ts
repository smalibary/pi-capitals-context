import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { saveState, loadState, STATE_FILE } from "../src/state.js";
import type { FileEntry } from "../src/types.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-state-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

function makeEntry(relativePath: string, enabled: boolean): FileEntry {
	return { relativePath, content: "", enabled, isRoot: true };
}

describe("saveState", () => {
	it("creates .pi directory if missing", () => {
		saveState(cwd, [makeEntry("STATUS.md", true)]);
		expect(fs.existsSync(path.join(cwd, ".pi"))).toBe(true);
	});

	it("writes state file as JSON containing toggles", () => {
		saveState(cwd, [
			makeEntry("STATUS.md", true),
			makeEntry("ARCHITECTURE.md", false),
		]);
		const raw = fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed).toEqual({ "STATUS.md": true, "ARCHITECTURE.md": false });
	});

	it("does not leave .tmp file after successful write", () => {
		saveState(cwd, [makeEntry("STATUS.md", true)]);
		const dirEntries = fs.readdirSync(path.join(cwd, ".pi"));
		expect(dirEntries.some(e => e.endsWith(".tmp"))).toBe(false);
	});

	it("overwrites existing state file atomically", () => {
		saveState(cwd, [makeEntry("STATUS.md", true)]);
		saveState(cwd, [makeEntry("STATUS.md", false)]);
		const parsed = JSON.parse(fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8"));
		expect(parsed["STATUS.md"]).toBe(false);
	});

	it("handles empty file list (writes empty object)", () => {
		saveState(cwd, []);
		const parsed = JSON.parse(fs.readFileSync(path.join(cwd, ".pi", STATE_FILE), "utf-8"));
		expect(parsed).toEqual({});
	});

	it("does not crash if .pi already exists", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		expect(() => saveState(cwd, [makeEntry("STATUS.md", true)])).not.toThrow();
	});

	it("round-trips with loadState", () => {
		saveState(cwd, [
			makeEntry("STATUS.md", true),
			makeEntry("DECISIONS.md", false),
		]);
		const loaded = loadState(cwd);
		expect(loaded).toEqual({ "STATUS.md": true, "DECISIONS.md": false });
	});

	it("loadState returns empty object when state file missing", () => {
		expect(loadState(cwd)).toEqual({});
	});

	it("loadState returns empty object when state file is malformed JSON", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(path.join(cwd, ".pi", STATE_FILE), "{ not json");
		expect(loadState(cwd)).toEqual({});
	});
});
