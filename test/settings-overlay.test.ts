import { describe, it, expect } from "vitest";
import { SettingsHubOverlay, type SettingsAction, type SettingsRow } from "../src/settings-overlay.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ENTER = "\r";
const ESC = "\x1b";

function makeHub(rows?: SettingsRow[]) {
	const defaultRows: SettingsRow[] = [
		{ id: "skip", label: "Skip list", badge: "12 entries" },
		{ id: "prompt", label: "Prompt preview", stub: true, stubHint: "soon" },
		{ id: "doctor", label: "Diagnose / Doctor", stub: true },
		{ id: "config", label: "Configuration", stub: true },
	];
	return new SettingsHubOverlay(rows ?? defaultRows, fakeTheme);
}

describe("SettingsHubOverlay navigation", () => {
	it("Enter on a non-stub row emits open with id", () => {
		const hub = makeHub();
		const actions: SettingsAction[] = [];
		hub.onAction = (a) => actions.push(a);
		hub.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "open", id: "skip" }]);
	});

	it("Enter on a stub row does nothing", () => {
		const hub = makeHub();
		const actions: SettingsAction[] = [];
		hub.onAction = (a) => actions.push(a);
		hub.handleInput(DOWN);
		hub.handleInput(ENTER);
		expect(actions).toEqual([]);
	});

	it("Esc emits quit", () => {
		const hub = makeHub();
		const actions: SettingsAction[] = [];
		hub.onAction = (a) => actions.push(a);
		hub.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("up/down clamps within row range", () => {
		const hub = makeHub();
		const actions: SettingsAction[] = [];
		hub.onAction = (a) => actions.push(a);
		hub.handleInput(UP);
		hub.handleInput(UP);
		hub.handleInput(ENTER);
		expect(actions).toEqual([{ kind: "open", id: "skip" }]);
	});

	it("down past end clamps to last row", () => {
		const hub = makeHub();
		const actions: SettingsAction[] = [];
		hub.onAction = (a) => actions.push(a);
		for (let i = 0; i < 10; i++) hub.handleInput(DOWN);
		hub.handleInput(ENTER);
		expect(actions).toEqual([]);
	});
});

describe("SettingsHubOverlay render", () => {
	it("returns lines", () => {
		const hub = makeHub();
		const lines = hub.render(60);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.some(l => l.includes("CAPS Settings"))).toBe(true);
		expect(lines.some(l => l.includes("Skip list"))).toBe(true);
	});

	it("renders badge text", () => {
		const hub = makeHub();
		const lines = hub.render(60);
		expect(lines.some(l => l.includes("12 entries"))).toBe(true);
	});

	it("renders coming-soon for stub rows", () => {
		const hub = makeHub();
		const lines = hub.render(60);
		expect(lines.some(l => l.includes("coming soon"))).toBe(true);
	});

	it("shows stubHint when cursor lands on stub", () => {
		const hub = makeHub();
		hub.handleInput(DOWN);
		const lines = hub.render(60);
		expect(lines.some(l => l.includes("soon"))).toBe(true);
	});
});
