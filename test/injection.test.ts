import { describe, it, expect } from "vitest";
import { formatSystemPromptExtra, buildPromptPreview } from "../src/injection.js";
import type { FileEntry } from "../src/types.js";

// Theme stub — strip color, return text only. Lets us assert on content without ANSI codes.
const stubTheme: any = { fg: (_color: string, text: string) => text };

function entry(relativePath: string, content: string, enabled = true): FileEntry {
	return { relativePath, content, enabled, isRoot: true };
}

describe("formatSystemPromptExtra", () => {
	it("returns empty string when no files enabled", () => {
		expect(formatSystemPromptExtra([])).toBe("");
	});

	it("formats single file with ### header", () => {
		const r = formatSystemPromptExtra([entry("STATUS.md", "Current focus: F4")]);
		expect(r).toContain("## Additional Context (CAPS files)");
		expect(r).toContain("### STATUS.md");
		expect(r).toContain("Current focus: F4");
	});

	it("concatenates multiple files in order", () => {
		const r = formatSystemPromptExtra([
			entry("A.md", "alpha"),
			entry("B.md", "beta"),
		]);
		const aIdx = r.indexOf("### A.md");
		const bIdx = r.indexOf("### B.md");
		expect(aIdx).toBeGreaterThan(-1);
		expect(bIdx).toBeGreaterThan(aIdx);
	});
});

describe("buildPromptPreview", () => {
	it("shows 'no files enabled' when empty", () => {
		const out = buildPromptPreview([], stubTheme);
		expect(out).toContain("no files enabled");
	});

	it("includes file name, byte count, token count for each file", () => {
		const out = buildPromptPreview([entry("STATUS.md", "hello world")], stubTheme);
		expect(out).toContain("STATUS.md");
		expect(out).toContain("11B");
		expect(out).toMatch(/\d+ tokens/);
	});

	it("includes the actual injection text after the divider", () => {
		const out = buildPromptPreview([entry("STATUS.md", "the body content")], stubTheme);
		expect(out).toContain("──── Injected text ────");
		expect(out).toContain("### STATUS.md");
		expect(out).toContain("the body content");
	});

	it("shows total bytes + tokens", () => {
		const out = buildPromptPreview([
			entry("A.md", "x".repeat(500)),
			entry("B.md", "y".repeat(600)),
		], stubTheme);
		expect(out).toMatch(/total: 1\.1KB/);
	});
});
