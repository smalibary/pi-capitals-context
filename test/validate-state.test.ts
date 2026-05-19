import { describe, it, expect } from "vitest";
import { validateState } from "../extensions/index.js";

describe("validateState", () => {
	it("returns empty object for null", () => {
		expect(validateState(null)).toEqual({});
	});

	it("returns empty object for undefined", () => {
		expect(validateState(undefined)).toEqual({});
	});

	it("returns empty object for a string", () => {
		expect(validateState("not an object")).toEqual({});
	});

	it("returns empty object for a number", () => {
		expect(validateState(42)).toEqual({});
	});

	it("returns empty object for an array", () => {
		expect(validateState(["STATUS.md", true])).toEqual({});
	});

	it("preserves valid boolean entries", () => {
		const input = { "STATUS.md": true, "ARCHITECTURE.md": false };
		expect(validateState(input)).toEqual(input);
	});

	it("drops non-boolean entries while keeping bools", () => {
		const result = validateState({
			"STATUS.md": true,
			"BAD_NUMBER.md": 1,
			"BAD_STRING.md": "yes",
			"BAD_NULL.md": null,
			"GOOD.md": false,
		});
		expect(result).toEqual({ "STATUS.md": true, "GOOD.md": false });
	});

	it("handles empty object", () => {
		expect(validateState({})).toEqual({});
	});

	it("does not propagate prototype-polluted keys as values", () => {
		const input = JSON.parse('{"__proto__": {"polluted": true}, "OK.md": true}');
		const result = validateState(input);
		expect(result["OK.md"]).toBe(true);
		expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
	});
});
