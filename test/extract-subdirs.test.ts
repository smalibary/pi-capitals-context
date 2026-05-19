import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { extractSubdirs } from "../src/discovery.js";

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

	// v2.1-F3 fix: prose mentions no longer auto-load. Explicit path refs required.
	it("does not match dir names mentioned in plain prose", async () => {
		const dirs = await extractSubdirs("check the public library at the corner", cwd);
		expect(dirs.has(path.join(cwd, "lib"))).toBe(false);
	});

	it("does not treat prose mention of 'docs' as a match", async () => {
		const dirs = await extractSubdirs("the docs are unclear", cwd);
		expect(dirs.has(path.join(cwd, "docs"))).toBe(false);
	});

	it("still loads when dir is followed by slash + content (path reference)", async () => {
		const dirs = await extractSubdirs("see docs/README for setup", cwd);
		expect(dirs.has(path.join(cwd, "docs"))).toBe(true);
	});

	it("ignores dir names not present in cwd", async () => {
		const dirs = await extractSubdirs("look at vendor/foo and node_modules/bar", cwd);
		expect(dirs.has(path.join(cwd, "vendor"))).toBe(false);
		expect(dirs.has(path.join(cwd, "node_modules"))).toBe(false);
	});
});
