import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { extractSubdirs } from "../extensions/index.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-extract-"));
	fs.mkdirSync(path.join(cwd, "src"));
	fs.mkdirSync(path.join(cwd, "lib"));
	fs.mkdirSync(path.join(cwd, "docs"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

describe("extractSubdirs", () => {
	it("returns empty set for prompts referencing no real dirs", () => {
		return extractSubdirs("nothing to see here", cwd).then(dirs => {
			expect(dirs.size).toBe(0);
		});
	});

	it("extracts dir from path-like reference", async () => {
		const dirs = await extractSubdirs("look at src/index.ts", cwd);
		expect(dirs.has(path.join(cwd, "src"))).toBe(true);
	});

	it("handles Windows-style backslashes", async () => {
		const dirs = await extractSubdirs("see src\\index.ts for details", cwd);
		expect(dirs.has(path.join(cwd, "src"))).toBe(true);
	});

	it("returns empty set when cwd does not exist", async () => {
		const fake = path.join(cwd, "does-not-exist");
		const dirs = await extractSubdirs("src/foo", fake);
		expect(dirs.size).toBe(0);
	});

	// Documents the loose-match bug. v2.1-F3 will tighten this — when it does, update these tests.
	it("currently matches dir names mentioned in plain prose (loose-match bug)", async () => {
		const dirs = await extractSubdirs("check the public library at the corner", cwd);
		expect(dirs.has(path.join(cwd, "lib"))).toBe(true); // "library" contains "lib"
	});

	it("currently treats prose mention of 'docs' as a match (loose-match bug)", async () => {
		const dirs = await extractSubdirs("the docs are unclear", cwd);
		expect(dirs.has(path.join(cwd, "docs"))).toBe(true);
	});

	it("ignores dir names not present in cwd", async () => {
		const dirs = await extractSubdirs("look at vendor/foo and node_modules/bar", cwd);
		expect(dirs.has(path.join(cwd, "vendor"))).toBe(false);
		expect(dirs.has(path.join(cwd, "node_modules"))).toBe(false);
	});
});
