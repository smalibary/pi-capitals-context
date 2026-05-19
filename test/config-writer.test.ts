import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	addSkipFile,
	removeSkipFile,
	resetSkipFiles,
	listSkipFiles,
	readRawProjectConfig,
} from "../src/config-writer.js";
import { DEFAULT_SKIP_FILES, PROJECT_CONFIG_NAME } from "../src/config.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-writer-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

function readFile(): string {
	return fs.readFileSync(path.join(cwd, ".pi", PROJECT_CONFIG_NAME), "utf-8");
}

describe("listSkipFiles", () => {
	it("returns defaults when no project config exists", () => {
		const { list, source } = listSkipFiles(cwd);
		expect(source).toBe("default");
		expect(list).toEqual(DEFAULT_SKIP_FILES);
	});

	it("returns project list when config exists", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(
			path.join(cwd, ".pi", PROJECT_CONFIG_NAME),
			JSON.stringify({ skipFiles: ["AGENTS.md"] }),
		);
		const { list, source } = listSkipFiles(cwd);
		expect(source).toBe("project");
		expect(list).toEqual(["AGENTS.md"]);
	});
});

describe("addSkipFile", () => {
	it("creates config file with defaults + new entry", () => {
		const { added, list } = addSkipFile(cwd, "EXTRA.md");
		expect(added).toBe(true);
		expect(list).toContain("EXTRA.md");
		expect(list.length).toBe(DEFAULT_SKIP_FILES.length + 1);
		const parsed = JSON.parse(readFile());
		expect(parsed.skipFiles).toContain("EXTRA.md");
	});

	it("is idempotent — re-adding same name returns added=false", () => {
		addSkipFile(cwd, "FOO.md");
		const r = addSkipFile(cwd, "FOO.md");
		expect(r.added).toBe(false);
		const parsed = JSON.parse(readFile());
		expect(parsed.skipFiles.filter((s: string) => s === "FOO.md").length).toBe(1);
	});

	it("preserves other config fields", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(
			path.join(cwd, ".pi", PROJECT_CONFIG_NAME),
			JSON.stringify({ maxFileSizeBytes: 9999, skipDirs: ["FOO"] }),
		);
		addSkipFile(cwd, "BAR.md");
		const parsed = JSON.parse(readFile());
		expect(parsed.maxFileSizeBytes).toBe(9999);
		expect(parsed.skipDirs).toEqual(["FOO"]);
	});
});

describe("removeSkipFile", () => {
	it("removes a default entry by writing project config", () => {
		const r = removeSkipFile(cwd, "LICENSE.md");
		expect(r.removed).toBe(true);
		expect(r.list).not.toContain("LICENSE.md");
		const parsed = JSON.parse(readFile());
		expect(parsed.skipFiles).not.toContain("LICENSE.md");
	});

	it("returns removed=false when entry not present", () => {
		const r = removeSkipFile(cwd, "NEVER_THERE.md");
		expect(r.removed).toBe(false);
	});
});

describe("resetSkipFiles", () => {
	it("deletes skipFiles from project config", () => {
		addSkipFile(cwd, "EXTRA.md");
		const r = resetSkipFiles(cwd);
		expect(r.list).toEqual(DEFAULT_SKIP_FILES);
		const raw = readRawProjectConfig(cwd);
		expect(raw.skipFiles).toBeUndefined();
	});

	it("preserves other fields", () => {
		fs.mkdirSync(path.join(cwd, ".pi"));
		fs.writeFileSync(
			path.join(cwd, ".pi", PROJECT_CONFIG_NAME),
			JSON.stringify({ skipFiles: ["FOO.md"], maxFileSizeBytes: 9999 }),
		);
		resetSkipFiles(cwd);
		const parsed = JSON.parse(readFile());
		expect(parsed.maxFileSizeBytes).toBe(9999);
		expect(parsed.skipFiles).toBeUndefined();
	});
});

describe("atomicity", () => {
	it("does not leave .tmp file after successful write", () => {
		addSkipFile(cwd, "FOO.md");
		const dirEntries = fs.readdirSync(path.join(cwd, ".pi"));
		expect(dirEntries.some(e => e.endsWith(".tmp"))).toBe(false);
	});
});
