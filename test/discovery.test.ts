import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	findCapsFiles,
	findAllText,
	readFileContent,
} from "../src/discovery.js";
import { defaultConfig } from "../src/config.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-discovery-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

describe("findCapsFiles — SKIP defaults", () => {
	it("excludes LICENSE.md and CHANGELOG.md when present", async () => {
		fs.writeFileSync(path.join(cwd, "STATUS.md"), "ok");
		fs.writeFileSync(path.join(cwd, "LICENSE.md"), "MIT");
		fs.writeFileSync(path.join(cwd, "CHANGELOG.md"), "v1");
		fs.writeFileSync(path.join(cwd, "README.md"), "readme");
		const files = await findCapsFiles(cwd);
		expect(files.some(f => f.endsWith("STATUS.md"))).toBe(true);
		expect(files.some(f => f.endsWith("LICENSE.md"))).toBe(false);
		expect(files.some(f => f.endsWith("CHANGELOG.md"))).toBe(false);
		expect(files.some(f => f.endsWith("README.md"))).toBe(false);
	});
});

describe("readFileContent — size cap", () => {
	it("accepts files under the cap", async () => {
		fs.writeFileSync(path.join(cwd, "OK.md"), "small");
		const r = await readFileContent(path.join(cwd, "OK.md"), cwd);
		expect(r?.content).toBe("small");
	});

	it("rejects files larger than the cap", async () => {
		const big = "x".repeat(200 * 1024);
		fs.writeFileSync(path.join(cwd, "BIG.md"), big);
		const r = await readFileContent(path.join(cwd, "BIG.md"), cwd);
		expect(r).toBeNull();
	});

	it("respects a custom cap from config", async () => {
		fs.writeFileSync(path.join(cwd, "M.md"), "hello");
		const cfg = defaultConfig();
		cfg.maxFileSizeBytes = 3;
		const r = await readFileContent(path.join(cwd, "M.md"), cwd, cfg);
		expect(r).toBeNull();
	});

	it("rejects symlinked files", async () => {
		const target = path.join(cwd, "REAL.md");
		const link = path.join(cwd, "LINK.md");
		fs.writeFileSync(target, "real content");
		try {
			fs.symlinkSync(target, link);
		} catch {
			// Symlinks may require admin on Windows; skip silently.
			return;
		}
		const r = await readFileContent(link, cwd);
		expect(r).toBeNull();
	});
});

describe("findAllText — recursion depth", () => {
	it("caps recursion at configured depth", async () => {
		// Build cwd/a/b/c/d/e/f/g/G.md (depth 7)
		const parts = ["a", "b", "c", "d", "e", "f", "g"];
		let p = cwd;
		for (const seg of parts) {
			p = path.join(p, seg);
			fs.mkdirSync(p);
			fs.writeFileSync(path.join(p, "X.md"), "");
		}
		const cfg = defaultConfig();
		cfg.maxRecursionDepth = 3;
		const found = await findAllText(cwd, cfg);
		// Depth 0 = cwd, 1 = a, 2 = b. Files inside b/X.md should be found, c and deeper should not.
		expect(found.some(f => f.includes(path.join("a", "b", "X.md")))).toBe(true);
		expect(found.some(f => f.includes(path.join("a", "b", "c", "X.md")))).toBe(false);
	});

	it("excludes symlinked directories from traversal", async () => {
		fs.mkdirSync(path.join(cwd, "real"));
		fs.writeFileSync(path.join(cwd, "real", "R.md"), "");
		try {
			fs.symlinkSync(path.join(cwd, "real"), path.join(cwd, "linked"), "dir");
		} catch {
			return;
		}
		const found = await findAllText(cwd);
		expect(found.some(f => f.includes(path.join("real", "R.md")))).toBe(true);
		expect(found.some(f => f.includes(path.join("linked", "R.md")))).toBe(false);
	});
});
