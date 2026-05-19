import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadConfig, defaultConfig, PROJECT_CONFIG_NAME } from "../src/config.js";

let cwd: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "caps-config-"));
});

afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
});

function writeProjectConfig(content: unknown) {
	const dir = path.join(cwd, ".pi");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, PROJECT_CONFIG_NAME), JSON.stringify(content));
}

describe("loadConfig", () => {
	it("returns defaults when no config file exists", () => {
		const cfg = loadConfig(cwd);
		expect(cfg.skipFiles.has("LICENSE.md")).toBe(true);
		expect(cfg.capsFileRe.test("STATUS.md")).toBe(true);
	});

	it("project config overrides skipFiles entirely", () => {
		writeProjectConfig({ skipFiles: ["ONLY_THIS.md"] });
		const cfg = loadConfig(cwd);
		expect(cfg.skipFiles.has("ONLY_THIS.md")).toBe(true);
		expect(cfg.skipFiles.has("LICENSE.md")).toBe(false);
		expect(cfg.skipFiles.has("CLAUDE.md")).toBe(false);
	});

	it("project config can opt-in LICENSE.md by replacing skipFiles", () => {
		writeProjectConfig({ skipFiles: ["AGENTS.md", "CLAUDE.md"] });
		const cfg = loadConfig(cwd);
		expect(cfg.skipFiles.has("LICENSE.md")).toBe(false);
	});

	it("project config overrides capsFilePattern", () => {
		writeProjectConfig({ capsFilePattern: "^doc_.*\\.md$" });
		const cfg = loadConfig(cwd);
		expect(cfg.capsFileRe.test("doc_intro.md")).toBe(true);
		expect(cfg.capsFileRe.test("STATUS.md")).toBe(false);
	});

	it("invalid regex string falls back to default", () => {
		writeProjectConfig({ capsFilePattern: "[invalid(regex" });
		const cfg = loadConfig(cwd);
		expect(cfg.capsFileRe.test("STATUS.md")).toBe(true);
	});

	it("malformed JSON file does not crash; defaults preserved", () => {
		const dir = path.join(cwd, ".pi");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, PROJECT_CONFIG_NAME), "{ not json");
		const cfg = loadConfig(cwd);
		expect(cfg.skipFiles.has("CLAUDE.md")).toBe(true);
	});

	it("non-array skipFiles ignored, defaults preserved", () => {
		writeProjectConfig({ skipFiles: "not-an-array" });
		const cfg = loadConfig(cwd);
		expect(cfg.skipFiles.has("CLAUDE.md")).toBe(true);
	});

	it("textExtensions can be overridden", () => {
		writeProjectConfig({ textExtensions: [".md", ".rst"] });
		const cfg = loadConfig(cwd);
		expect(cfg.textExtensions.has(".rst")).toBe(true);
		expect(cfg.textExtensions.has(".json")).toBe(false);
	});

	it("defaultConfig returns independent instances", () => {
		const a = defaultConfig();
		const b = defaultConfig();
		a.skipFiles.add("MUTATED.md");
		expect(b.skipFiles.has("MUTATED.md")).toBe(false);
	});

	it("respects override of maxFileSizeBytes", () => {
		writeProjectConfig({ maxFileSizeBytes: 50_000 });
		expect(loadConfig(cwd).maxFileSizeBytes).toBe(50_000);
	});

	it("respects override of maxRecursionDepth", () => {
		writeProjectConfig({ maxRecursionDepth: 2 });
		expect(loadConfig(cwd).maxRecursionDepth).toBe(2);
	});

	it("respects override of maxSubdirFiles", () => {
		writeProjectConfig({ maxSubdirFiles: 5 });
		expect(loadConfig(cwd).maxSubdirFiles).toBe(5);
	});

	it("rejects non-positive maxFileSizeBytes; defaults preserved", () => {
		writeProjectConfig({ maxFileSizeBytes: -1 });
		expect(loadConfig(cwd).maxFileSizeBytes).toBe(defaultConfig().maxFileSizeBytes);
	});

	it("rejects non-numeric maxRecursionDepth; defaults preserved", () => {
		writeProjectConfig({ maxRecursionDepth: "deep" });
		expect(loadConfig(cwd).maxRecursionDepth).toBe(defaultConfig().maxRecursionDepth);
	});
});
