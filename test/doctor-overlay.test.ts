import { describe, it, expect } from "vitest";
import { DoctorOverlay, type DoctorAction } from "../src/doctor-overlay.js";
import type { DoctorInputs } from "../src/doctor.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ESC = "\x1b";

function makeInputs(verbose = false): DoctorInputs {
	return {
		cwd: "/project",
		globalCapsDir: "/home/user/.pi/CAPS",
		stateFilePath: "/project/.pi/caps-context-state.json",
		stateFileExists: true,
		projectConfigPath: "/project/.pi/caps-config.json",
		projectConfigExists: false,
		globalConfigPath: "/home/user/.pi/caps-config.json",
		globalConfigExists: false,
		rootFiles: [
			{ relativePath: "STATUS.md", content: "x", enabled: true, isRoot: true },
		],
		subdirFiles: [],
		globalFiles: [],
		watcherCount: 1,
		lastInjection: "## Additional Context",
		inspection: [
			{ name: "STATUS.md", fullPath: "/project/STATUS.md", type: "file", included: true, reason: "ok", size: 100 },
			{ name: "LICENSE", fullPath: "/project/LICENSE", type: "file", included: false, reason: "in skipFiles list" },
		],
		verbose,
	};
}

describe("DoctorOverlay scrolling", () => {
	it("Esc emits quit", () => {
		const o = new DoctorOverlay(makeInputs(), fakeTheme);
		const actions: DoctorAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("down increments scroll, up decrements", () => {
		const o = new DoctorOverlay(makeInputs(), fakeTheme);
		const first = o.render(80).join("\n");
		o.handleInput(DOWN);
		const second = o.render(80).join("\n");
		expect(first).not.toBe(second);
		o.handleInput(UP);
		expect(o.render(80).join("\n")).toBe(first);
	});

	it("g jumps to top, G jumps to bottom", () => {
		const o = new DoctorOverlay(makeInputs(), fakeTheme);
		const top = o.render(80).join("\n");
		o.handleInput("G");
		const bottom = o.render(80).join("\n");
		expect(bottom).not.toBe(top);
		o.handleInput("g");
		expect(o.render(80).join("\n")).toBe(top);
	});
});

describe("DoctorOverlay verbose toggle", () => {
	it("v toggles verbose mode and re-renders", () => {
		const o = new DoctorOverlay(makeInputs(false), fakeTheme);
		const before = o.render(80).join("\n");
		o.handleInput("v");
		const after = o.render(80).join("\n");
		expect(after).not.toBe(before);
	});

	it("verbose mode shows the badge", () => {
		const o = new DoctorOverlay(makeInputs(false), fakeTheme);
		o.handleInput("v");
		const lines = o.render(80);
		expect(lines.some(l => l.includes("· verbose"))).toBe(true);
	});

	it("non-verbose shows 'v for verbose' hint", () => {
		const o = new DoctorOverlay(makeInputs(false), fakeTheme);
		const lines = o.render(80);
		expect(lines.some(l => l.includes("v for verbose"))).toBe(true);
	});
});

describe("DoctorOverlay render", () => {
	it("returns lines including the title", () => {
		const o = new DoctorOverlay(makeInputs(), fakeTheme);
		const lines = o.render(80);
		expect(lines.some(l => l.includes("Diagnose / Doctor"))).toBe(true);
	});

	it("includes content from the doctor report", () => {
		const o = new DoctorOverlay(makeInputs(), fakeTheme);
		const lines = o.render(80);
		expect(lines.some(l => l.includes("/project"))).toBe(true);
	});
});
