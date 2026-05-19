import { describe, it, expect } from "vitest";
import { simpleLineDiff } from "../src/diff.js";

describe("simpleLineDiff", () => {
	it("reports identical strings", () => {
		expect(simpleLineDiff("a\nb\nc", "a\nb\nc")).toBe(
			"(no changes — current injection identical to previous turn)",
		);
	});

	it("marks changed line with - and +", () => {
		const d = simpleLineDiff("hello\nworld", "hello\nthere");
		expect(d).toContain("- world");
		expect(d).toContain("+ there");
	});

	it("marks added lines at end with +", () => {
		const d = simpleLineDiff("a", "a\nb\nc");
		expect(d).toContain("+ b");
		expect(d).toContain("+ c");
	});

	it("marks removed lines at end with -", () => {
		const d = simpleLineDiff("a\nb\nc", "a");
		expect(d).toContain("- b");
		expect(d).toContain("- c");
	});

	it("handles empty previous", () => {
		const d = simpleLineDiff("", "new content");
		expect(d).toContain("+ new content");
	});

	it("handles empty current", () => {
		const d = simpleLineDiff("old", "");
		expect(d).toContain("- old");
	});
});
