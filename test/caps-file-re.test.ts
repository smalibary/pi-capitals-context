import { describe, it, expect } from "vitest";
import { CAPS_FILE_RE, CAPS_DIR_RE, SKIP_FILES, SKIP_DIRS } from "../src/discovery.js";

describe("CAPS_FILE_RE", () => {
	it("matches ALL_CAPS .md files", () => {
		expect(CAPS_FILE_RE.test("STATUS.md")).toBe(true);
		expect(CAPS_FILE_RE.test("ARCHITECTURE.md")).toBe(true);
		expect(CAPS_FILE_RE.test("API_DESIGN.md")).toBe(true);
		expect(CAPS_FILE_RE.test("V2_PLAN.md")).toBe(true);
		expect(CAPS_FILE_RE.test("A.md")).toBe(true);
	});

	it("rejects lowercase and mixed-case names", () => {
		expect(CAPS_FILE_RE.test("status.md")).toBe(false);
		expect(CAPS_FILE_RE.test("Status.md")).toBe(false);
		expect(CAPS_FILE_RE.test("STATUSx.md")).toBe(false);
		expect(CAPS_FILE_RE.test("readme.md")).toBe(false);
	});

	it("rejects non-.md extensions", () => {
		expect(CAPS_FILE_RE.test("STATUS.txt")).toBe(false);
		expect(CAPS_FILE_RE.test("STATUS")).toBe(false);
		expect(CAPS_FILE_RE.test("STATUS.MD")).toBe(false);
	});

	it("rejects names starting with non-letter", () => {
		expect(CAPS_FILE_RE.test("_STATUS.md")).toBe(false);
		expect(CAPS_FILE_RE.test("1STATUS.md")).toBe(false);
	});

	// Known bug — documents current behavior; v2.1-F3 will move LICENSE/README/CHANGELOG into SKIP_FILES.
	it("currently matches LICENSE.md, CHANGELOG.md (will be excluded via SKIP_FILES in v2.1-F3)", () => {
		expect(CAPS_FILE_RE.test("LICENSE.md")).toBe(true);
		expect(CAPS_FILE_RE.test("CHANGELOG.md")).toBe(true);
	});
});

describe("CAPS_DIR_RE", () => {
	it("matches ALL_CAPS directory names", () => {
		expect(CAPS_DIR_RE.test("ARCHITECTURE")).toBe(true);
		expect(CAPS_DIR_RE.test("API_DESIGN")).toBe(true);
		expect(CAPS_DIR_RE.test("V2_NOTES")).toBe(true);
	});

	it("rejects mixed-case or lowercase", () => {
		expect(CAPS_DIR_RE.test("Architecture")).toBe(false);
		expect(CAPS_DIR_RE.test("api")).toBe(false);
	});
});

describe("SKIP_FILES + SKIP_DIRS", () => {
	it("currently skips AGENTS.md and CLAUDE.md", () => {
		expect(SKIP_FILES.has("AGENTS.md")).toBe(true);
		expect(SKIP_FILES.has("CLAUDE.md")).toBe(true);
	});

	it("currently skips AGENTS, CLAUDE, NODE_MODULES dirs", () => {
		expect(SKIP_DIRS.has("AGENTS")).toBe(true);
		expect(SKIP_DIRS.has("CLAUDE")).toBe(true);
		expect(SKIP_DIRS.has("NODE_MODULES")).toBe(true);
	});
});
