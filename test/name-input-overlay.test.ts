import { describe, it, expect } from "vitest";
import { NameInputOverlay } from "../src/name-input-overlay.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const ENTER = "\r";
const ESC = "\x1b";
const BACKSPACE = "\x7f";

function makeOverlay(existing: string[] = [], initial?: string) {
	return new NameInputOverlay({
		title: "Name new profile",
		hint: "Use letters, numbers, dashes",
		existing: new Set(existing),
		initial,
		theme: fakeTheme,
	});
}

describe("NameInputOverlay typing", () => {
	it("appends printable characters to the value", () => {
		const o = makeOverlay();
		o.handleInput("a");
		o.handleInput("p");
		o.handleInput("i");
		expect(o.getState().value).toBe("api");
	});

	it("ignores non-printable input", () => {
		const o = makeOverlay();
		o.handleInput("a");
		o.handleInput("\x01");
		o.handleInput("b");
		expect(o.getState().value).toBe("ab");
	});

	it("backspace removes the last character", () => {
		const o = makeOverlay();
		o.handleInput("a");
		o.handleInput("p");
		o.handleInput("i");
		o.handleInput(BACKSPACE);
		expect(o.getState().value).toBe("ap");
	});

	it("backspace on empty value is a no-op", () => {
		const o = makeOverlay();
		o.handleInput(BACKSPACE);
		expect(o.getState().value).toBe("");
	});

	it("respects 60-char hard cap", () => {
		const o = makeOverlay();
		for (let i = 0; i < 70; i++) o.handleInput("a");
		expect(o.getState().value.length).toBe(60);
	});

	it("accepts an initial value", () => {
		const o = makeOverlay([], "preset");
		expect(o.getState().value).toBe("preset");
	});
});

describe("NameInputOverlay validation", () => {
	it("empty value is invalid (reason: empty)", () => {
		const o = makeOverlay();
		const s = o.getState();
		expect(s.valid).toBe(false);
		expect(s.reason).toBe("empty");
	});

	it("value > 50 chars is invalid (reason: too_long)", () => {
		const o = makeOverlay();
		for (let i = 0; i < 51; i++) o.handleInput("a");
		const s = o.getState();
		expect(s.valid).toBe(false);
		expect(s.reason).toBe("too_long");
	});

	it("existing name is invalid (reason: exists)", () => {
		const o = makeOverlay(["api-work"]);
		o.handleInput("a");
		o.handleInput("p");
		o.handleInput("i");
		o.handleInput("-");
		o.handleInput("w");
		o.handleInput("o");
		o.handleInput("r");
		o.handleInput("k");
		const s = o.getState();
		expect(s.valid).toBe(false);
		expect(s.reason).toBe("exists");
	});

	it("valid name passes", () => {
		const o = makeOverlay(["frontend"]);
		o.handleInput("a");
		o.handleInput("p");
		o.handleInput("i");
		const s = o.getState();
		expect(s.valid).toBe(true);
		expect(s.reason).toBeUndefined();
	});
});

describe("NameInputOverlay callbacks", () => {
	it("Enter on valid name calls onSave with the name", () => {
		const o = makeOverlay([]);
		const saved: string[] = [];
		const discarded: number[] = [];
		o.onSave = (n) => saved.push(n);
		o.onDiscard = () => discarded.push(1);
		o.handleInput("a");
		o.handleInput("p");
		o.handleInput("i");
		o.handleInput(ENTER);
		expect(saved).toEqual(["api"]);
		expect(discarded).toEqual([]);
	});

	it("Enter on invalid name does nothing", () => {
		const o = makeOverlay([]);
		const saved: string[] = [];
		o.onSave = (n) => saved.push(n);
		o.handleInput(ENTER);
		expect(saved).toEqual([]);
	});

	it("Esc calls onDiscard", () => {
		const o = makeOverlay([]);
		const saved: string[] = [];
		const discarded: number[] = [];
		o.onSave = (n) => saved.push(n);
		o.onDiscard = () => discarded.push(1);
		o.handleInput("a");
		o.handleInput(ESC);
		expect(saved).toEqual([]);
		expect(discarded).toEqual([1]);
	});

	it("Enter when name conflicts with existing does NOT save", () => {
		const o = makeOverlay(["api-work"]);
		const saved: string[] = [];
		o.onSave = (n) => saved.push(n);
		"api-work".split("").forEach(c => o.handleInput(c));
		o.handleInput(ENTER);
		expect(saved).toEqual([]);
	});
});

describe("NameInputOverlay render", () => {
	it("returns lines without throwing", () => {
		const o = makeOverlay();
		const lines = o.render(60);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.some(l => l.includes("Name new profile"))).toBe(true);
	});

	it("shows validation reason in render", () => {
		const o = makeOverlay();
		const lines = o.render(60);
		expect(lines.some(l => l.includes("type a name"))).toBe(true);
	});

	it("shows ready indicator when valid", () => {
		const o = makeOverlay();
		o.handleInput("a");
		const lines = o.render(60);
		expect(lines.some(l => l.includes("ready"))).toBe(true);
	});
});
