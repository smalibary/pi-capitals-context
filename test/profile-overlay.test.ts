import { describe, it, expect } from "vitest";
import { ProfileSelector, type ProfileAction } from "../src/profile-overlay.js";
import type { ProfileStore } from "../src/profiles.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ENTER = "\r";
const ESC = "\x1b";

function makeSelector(
	store: ProfileStore = {
		"api-work": { "STATUS.md": true, "API.md": true },
		"frontend": { "STATUS.md": true, "UI.md": true },
	},
	current: Record<string, boolean> = { "STATUS.md": true, "API.md": false, "UI.md": false },
	known: Set<string> = new Set(["STATUS.md", "API.md", "UI.md"]),
) {
	return new ProfileSelector(store, current, known, fakeTheme);
}

describe("ProfileSelector navigation", () => {
	it("cursor starts on the Create row; Enter emits create", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "create" }]);
	});

	it("DOWN once moves cursor onto first profile and Enter loads it", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "load", name: "api-work" }]);
	});

	it("cursor cannot go below the Create row", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(UP);
		sel.handleInput(UP);
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "create" }]);
	});

	it("cursor cannot exceed last profile row", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput(DOWN);
		sel.handleInput(DOWN);
		sel.handleInput(DOWN);
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "load", name: "frontend" }]);
	});

	it("escape emits quit action", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("empty store still shows Create row that emits create", () => {
		const sel = makeSelector({});
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "create" }]);
	});
});

describe("ProfileSelector delete arming", () => {
	it("d on Create row does nothing", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput("d");
		sel.handleInput("d");
		expect(actions).toEqual([]);
	});

	it("first d on profile row arms, second d emits delete", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput("d");
		expect(actions).toEqual([]);
		sel.handleInput("d");
		expect(actions).toEqual([{ kind: "delete", name: "api-work" }]);
	});

	it("arrow cancels the armed delete", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput("d");
		sel.handleInput(DOWN);
		sel.handleInput("d");
		expect(actions).toEqual([]);
	});

	it("escape cancels armed delete and emits quit", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput("d");
		sel.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("typing a different key cancels the armed delete", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput("d");
		sel.handleInput("x");
		sel.handleInput("d");
		expect(actions).toEqual([]);
	});
});

describe("ProfileSelector refresh", () => {
	it("after refresh, cursor clamps to new list length", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput(DOWN);
		sel.refresh({ "only": { "STATUS.md": true } });
		sel.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "load", name: "only" }]);
	});

	it("refresh clears armed-delete state", () => {
		const sel = makeSelector();
		const actions: ProfileAction[] = [];
		sel.onAction = (a) => actions.push(a);
		sel.handleInput(DOWN);
		sel.handleInput("d");
		sel.refresh({ "api-work": { "STATUS.md": true } });
		sel.handleInput("d");
		expect(actions).toEqual([]);
	});
});

describe("ProfileSelector render", () => {
	it("returns lines without throwing", () => {
		const sel = makeSelector();
		const lines = sel.render(60);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.some(l => l.includes("Create new profile"))).toBe(true);
		expect(lines.some(l => l.includes("api-work"))).toBe(true);
		expect(lines.some(l => l.includes("frontend"))).toBe(true);
	});

	it("renders Create row even with empty store", () => {
		const sel = makeSelector({});
		const lines = sel.render(60);
		expect(lines.some(l => l.includes("Create new profile"))).toBe(true);
		expect(lines.some(l => l.includes("no profiles saved yet"))).toBe(true);
	});

	it("shows diff preview lines for highlighted profile", () => {
		const sel = makeSelector();
		sel.handleInput(DOWN);
		const lines = sel.render(60);
		expect(lines.some(l => l.includes("on load:"))).toBe(true);
	});

	it("Create row shows hint instead of diff", () => {
		const sel = makeSelector();
		const lines = sel.render(60);
		expect(lines.some(l => l.includes("snapshot the toggles"))).toBe(true);
	});

	it("invalidates and re-renders after input", () => {
		const sel = makeSelector();
		const first = sel.render(60).join("\n");
		sel.handleInput(DOWN);
		const second = sel.render(60).join("\n");
		expect(first).not.toBe(second);
	});
});
