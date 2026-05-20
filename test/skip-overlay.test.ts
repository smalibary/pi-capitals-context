import { describe, it, expect } from "vitest";
import { SkipOverlay, type SkipAction } from "../src/skip-overlay.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ENTER = "\r";
const ESC = "\x1b";

function makeOverlay(list: string[] = ["LICENSE", "README.md", "CHANGELOG.md"], source: "default" | "project" = "default") {
	return new SkipOverlay(list, source, fakeTheme);
}

describe("SkipOverlay navigation", () => {
	it("cursor starts on the Add row; Enter emits add", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "add" }]);
	});

	it("down moves cursor onto first entry, d-twice deletes", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(DOWN);
		o.handleInput("d");
		expect(actions).toEqual([]);
		o.handleInput("d");
		expect(actions).toEqual([{ kind: "delete", name: "LICENSE" }]);
	});

	it("a anywhere emits add", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(DOWN);
		o.handleInput("a");
		expect(actions).toEqual([{ kind: "add" }]);
	});

	it("R twice emits reset", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("R");
		expect(actions).toEqual([]);
		o.handleInput("R");
		expect(actions).toEqual([{ kind: "reset" }]);
	});

	it("Esc cancels armed reset and emits quit", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("R");
		o.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("arrow cancels armed delete", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(DOWN);
		o.handleInput("d");
		o.handleInput(DOWN);
		o.handleInput("d");
		expect(actions).toEqual([]);
	});

	it("d on Add row does nothing", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("d");
		o.handleInput("d");
		expect(actions).toEqual([]);
	});

	it("R arms, then a different key cancels", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("R");
		o.handleInput("x");
		o.handleInput("R");
		expect(actions).toEqual([]);
	});
});

describe("SkipOverlay refresh", () => {
	it("cursor clamps when list shrinks", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(DOWN);
		o.handleInput(DOWN);
		o.handleInput(DOWN);
		o.refresh(["ONLY.md"], "project");
		o.handleInput("d");
		o.handleInput("d");
		expect(actions).toEqual([{ kind: "delete", name: "ONLY.md" }]);
	});

	it("refresh clears armed delete and armed reset", () => {
		const o = makeOverlay();
		const actions: SkipAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("R");
		o.refresh(["LICENSE"], "default");
		o.handleInput("R");
		expect(actions).toEqual([]);
	});
});

describe("SkipOverlay render", () => {
	it("returns lines and shows source tag", () => {
		const o = makeOverlay(["LICENSE"], "default");
		const lines = o.render(60);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.some(l => l.includes("Skip List"))).toBe(true);
		expect(lines.some(l => l.includes("defaults"))).toBe(true);
		expect(lines.some(l => l.includes("LICENSE"))).toBe(true);
	});

	it("shows project override tag", () => {
		const o = makeOverlay(["FOO.md"], "project");
		const lines = o.render(60);
		expect(lines.some(l => l.includes("project override"))).toBe(true);
	});

	it("shows Add row", () => {
		const o = makeOverlay();
		const lines = o.render(60);
		expect(lines.some(l => l.includes("Add entry"))).toBe(true);
	});

	it("shows empty-list hint", () => {
		const o = makeOverlay([], "project");
		const lines = o.render(60);
		expect(lines.some(l => l.includes("skip list is empty"))).toBe(true);
	});

	it("shows armed-reset warning", () => {
		const o = makeOverlay();
		o.handleInput("R");
		const lines = o.render(60);
		expect(lines.some(l => l.includes("press R again"))).toBe(true);
	});
});
