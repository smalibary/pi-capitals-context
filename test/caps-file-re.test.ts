import { describe, it, expect } from "vitest";
import {
	defaultConfig,
	DEFAULT_SKIP_FILES,
	DEFAULT_SKIP_DIRS,
} from "../src/config.js";

const config = defaultConfig();
const { capsFileRe, capsDirRe, skipFiles, skipDirs } = config;

describe("default CAPS file regex", () => {
	it("matches ALL_CAPS .md files", () => {
		expect(capsFileRe.test("STATUS.md")).toBe(true);
		expect(capsFileRe.test("ARCHITECTURE.md")).toBe(true);
		expect(capsFileRe.test("API_DESIGN.md")).toBe(true);
		expect(capsFileRe.test("V2_PLAN.md")).toBe(true);
		expect(capsFileRe.test("A.md")).toBe(true);
	});

	it("rejects lowercase and mixed-case names", () => {
		expect(capsFileRe.test("status.md")).toBe(false);
		expect(capsFileRe.test("Status.md")).toBe(false);
		expect(capsFileRe.test("STATUSx.md")).toBe(false);
		expect(capsFileRe.test("readme.md")).toBe(false);
	});

	it("rejects non-.md extensions", () => {
		expect(capsFileRe.test("STATUS.txt")).toBe(false);
		expect(capsFileRe.test("STATUS")).toBe(false);
		expect(capsFileRe.test("STATUS.MD")).toBe(false);
	});

	it("rejects names starting with non-letter", () => {
		expect(capsFileRe.test("_STATUS.md")).toBe(false);
		expect(capsFileRe.test("1STATUS.md")).toBe(false);
	});

	it("regex still structurally matches LICENSE.md and CHANGELOG.md — filtering happens via SKIP_FILES", () => {
		expect(capsFileRe.test("LICENSE.md")).toBe(true);
		expect(capsFileRe.test("CHANGELOG.md")).toBe(true);
	});
});

describe("default CAPS dir regex", () => {
	it("matches ALL_CAPS directory names", () => {
		expect(capsDirRe.test("ARCHITECTURE")).toBe(true);
		expect(capsDirRe.test("API_DESIGN")).toBe(true);
		expect(capsDirRe.test("V2_NOTES")).toBe(true);
	});

	it("rejects mixed-case or lowercase", () => {
		expect(capsDirRe.test("Architecture")).toBe(false);
		expect(capsDirRe.test("api")).toBe(false);
	});
});

describe("default SKIP_FILES + SKIP_DIRS", () => {
	it("skips AGENTS.md and CLAUDE.md", () => {
		expect(skipFiles.has("AGENTS.md")).toBe(true);
		expect(skipFiles.has("CLAUDE.md")).toBe(true);
	});

	it("skips repo-noise files: LICENSE, README, CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY", () => {
		expect(skipFiles.has("LICENSE")).toBe(true);
		expect(skipFiles.has("LICENSE.md")).toBe(true);
		expect(skipFiles.has("README.md")).toBe(true);
		expect(skipFiles.has("CHANGELOG.md")).toBe(true);
		expect(skipFiles.has("CONTRIBUTING.md")).toBe(true);
		expect(skipFiles.has("CODE_OF_CONDUCT.md")).toBe(true);
		expect(skipFiles.has("SECURITY.md")).toBe(true);
	});

	it("skips planning/maintenance docs: MAINTAINING, ROADMAP", () => {
		expect(skipFiles.has("MAINTAINING.md")).toBe(true);
		expect(skipFiles.has("ROADMAP.md")).toBe(true);
	});

	it("skips AGENTS, CLAUDE, NODE_MODULES dirs", () => {
		expect(skipDirs.has("AGENTS")).toBe(true);
		expect(skipDirs.has("CLAUDE")).toBe(true);
		expect(skipDirs.has("NODE_MODULES")).toBe(true);
	});

	it("skips noise dirs: node_modules, .git, .pi", () => {
		expect(skipDirs.has("node_modules")).toBe(true);
		expect(skipDirs.has(".git")).toBe(true);
		expect(skipDirs.has(".pi")).toBe(true);
	});

	it("exposes raw default arrays for inspection", () => {
		expect(DEFAULT_SKIP_FILES).toContain("LICENSE.md");
		expect(DEFAULT_SKIP_DIRS).toContain(".git");
	});
});
