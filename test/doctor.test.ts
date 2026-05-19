import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { inspectDirectory, buildDoctorReport, type DoctorInputs } from "../src/doctor.js";
import { defaultConfig } from "../src/config.js";

const stubTheme: any = { fg: (_c: string, s: string) => s };

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-doctor-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

describe("inspectDirectory", () => {
	it("classifies a normal CAPS file as included", async () => {
		fs.writeFileSync(path.join(cwd, "STATUS.md"), "ok");
		const r = await inspectDirectory(cwd, defaultConfig());
		const status = r.find(e => e.name === "STATUS.md");
		expect(status?.included).toBe(true);
		expect(status?.reason).toBe("ok");
	});

	it("marks LICENSE.md as skipped (in skipFiles list)", async () => {
		fs.writeFileSync(path.join(cwd, "LICENSE.md"), "MIT");
		const r = await inspectDirectory(cwd, defaultConfig());
		const lic = r.find(e => e.name === "LICENSE.md");
		expect(lic?.included).toBe(false);
		expect(lic?.reason).toBe("in skipFiles list");
	});

	it("marks lowercase file as 'doesn't match CAPS pattern'", async () => {
		fs.writeFileSync(path.join(cwd, "notes.md"), "stuff");
		const r = await inspectDirectory(cwd, defaultConfig());
		const f = r.find(e => e.name === "notes.md");
		expect(f?.included).toBe(false);
		expect(f?.reason).toBe("filename doesn't match CAPS pattern");
	});

	it("marks oversized file as too large", async () => {
		const big = "x".repeat(200 * 1024);
		fs.writeFileSync(path.join(cwd, "BIG.md"), big);
		const r = await inspectDirectory(cwd, defaultConfig());
		const big1 = r.find(e => e.name === "BIG.md");
		expect(big1?.included).toBe(false);
		expect(big1?.reason).toMatch(/too large/);
	});

	it("marks symlinks as refused for safety", async () => {
		fs.writeFileSync(path.join(cwd, "REAL.md"), "x");
		try { fs.symlinkSync(path.join(cwd, "REAL.md"), path.join(cwd, "LINK.md")); }
		catch { return; }
		const r = await inspectDirectory(cwd, defaultConfig());
		const link = r.find(e => e.name === "LINK.md");
		expect(link?.included).toBe(false);
		expect(link?.reason).toBe("symlink (refused for safety)");
	});

	it("classifies CAPS dirs as included", async () => {
		fs.mkdirSync(path.join(cwd, "DECISIONS"));
		const r = await inspectDirectory(cwd, defaultConfig());
		const dec = r.find(e => e.name === "DECISIONS");
		expect(dec?.included).toBe(true);
		expect(dec?.type).toBe("dir");
	});

	it("classifies skipDir entries as skipped", async () => {
		fs.mkdirSync(path.join(cwd, "node_modules"));
		const r = await inspectDirectory(cwd, defaultConfig());
		const nm = r.find(e => e.name === "node_modules");
		expect(nm?.included).toBe(false);
		expect(nm?.reason).toBe("in skipDirs list");
	});

	it("returns empty array when dir does not exist", async () => {
		const r = await inspectDirectory(path.join(cwd, "nope"), defaultConfig());
		expect(r).toEqual([]);
	});
});

function baseInputs(overrides: Partial<DoctorInputs> = {}): DoctorInputs {
	return {
		cwd: "/tmp/x",
		globalCapsDir: "/home/u/.pi/CAPS",
		stateFilePath: "/tmp/x/.pi/caps-context-state.json",
		stateFileExists: false,
		projectConfigPath: "/tmp/x/.pi/caps-config.json",
		projectConfigExists: false,
		globalConfigPath: "/home/u/.pi/caps-config.json",
		globalConfigExists: false,
		rootFiles: [],
		subdirFiles: [],
		globalFiles: [],
		watcherCount: 0,
		lastInjection: "",
		inspection: [],
		verbose: false,
		...overrides,
	};
}

describe("buildDoctorReport", () => {
	it("renders cwd, globals, state file, watcher count", () => {
		const out = buildDoctorReport(baseInputs({ cwd: "/my/proj", watcherCount: 3 }), stubTheme);
		expect(out).toContain("/my/proj");
		expect(out).toContain("3 active");
	});

	it("shows 'none loaded' when no files", () => {
		const out = buildDoctorReport(baseInputs(), stubTheme);
		expect(out).toContain("none loaded");
		expect(out).toContain("STATUS.md");
	});

	it("lists loaded root files with enabled status", () => {
		const out = buildDoctorReport(baseInputs({
			rootFiles: [
				{ relativePath: "STATUS.md", content: "x", enabled: true, isRoot: true },
				{ relativePath: "ARCH.md", content: "y", enabled: false, isRoot: true },
			],
		}), stubTheme);
		expect(out).toContain("STATUS.md");
		expect(out).toContain("enabled");
		expect(out).toContain("ARCH.md");
		expect(out).toContain("disabled");
	});

	it("non-verbose hides 'doesn't match pattern' entries", () => {
		const out = buildDoctorReport(baseInputs({
			inspection: [
				{ name: "notes.md", fullPath: "/tmp/notes.md", type: "file", included: false, reason: "filename doesn't match CAPS pattern" },
				{ name: "LICENSE.md", fullPath: "/tmp/LICENSE.md", type: "file", included: false, reason: "in skipFiles list" },
			],
		}), stubTheme);
		expect(out).not.toMatch(/notes\.md/);
		expect(out).toContain("LICENSE.md");
	});

	it("verbose shows everything", () => {
		const out = buildDoctorReport(baseInputs({
			verbose: true,
			inspection: [
				{ name: "notes.md", fullPath: "/tmp/notes.md", type: "file", included: false, reason: "filename doesn't match CAPS pattern" },
				{ name: "STATUS.md", fullPath: "/tmp/STATUS.md", type: "file", included: true, reason: "ok" },
			],
		}), stubTheme);
		expect(out).toContain("notes.md");
		expect(out).toContain("STATUS.md");
	});

	it("flags active project config override", () => {
		const out = buildDoctorReport(baseInputs({ projectConfigExists: true }), stubTheme);
		expect(out).toContain("active");
	});

	it("shows last injection size when set", () => {
		const out = buildDoctorReport(baseInputs({ lastInjection: "## hello world\nbody" }), stubTheme);
		expect(out).toMatch(/last inj.*\d+B/);
	});

	it("shows 'none yet' when last injection empty", () => {
		const out = buildDoctorReport(baseInputs(), stubTheme);
		expect(out).toContain("none yet");
	});
});
