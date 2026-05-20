import { describe, it, expect } from "vitest";
import { PromptPreviewOverlay, type PromptAction } from "../src/prompt-overlay.js";
import type { FileEntry } from "../src/types.js";

const fakeTheme = { fg: (_role: string, s: string) => s } as any;

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ESC = "\x1b";

function makeOverlay(opts: { withPrev?: boolean; files?: FileEntry[] } = {}) {
	const files: FileEntry[] = opts.files ?? [
		{ relativePath: "STATUS.md", content: "Status content\nline 2\nline 3", enabled: true, isRoot: true },
		{ relativePath: "API.md", content: "API content", enabled: true, isRoot: true },
	];
	const prev = opts.withPrev ? "previous injection text" : "";
	return new PromptPreviewOverlay(files, prev, fakeTheme);
}

describe("PromptPreviewOverlay scrolling", () => {
	it("Esc emits quit", () => {
		const o = makeOverlay();
		const actions: PromptAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput(ESC);
		expect(actions).toEqual([{ kind: "quit" }]);
	});

	it("down increments scroll, up decrements", () => {
		const o = makeOverlay();
		const first = o.render(80).join("\n");
		o.handleInput(DOWN);
		const second = o.render(80).join("\n");
		expect(first).not.toBe(second);
		o.handleInput(UP);
		const third = o.render(80).join("\n");
		expect(third).toBe(first);
	});

	it("scroll cannot go below 0", () => {
		const o = makeOverlay();
		const first = o.render(80).join("\n");
		o.handleInput(UP);
		o.handleInput(UP);
		expect(o.render(80).join("\n")).toBe(first);
	});

	it("g jumps to top", () => {
		const o = makeOverlay();
		const first = o.render(80).join("\n");
		o.handleInput(DOWN);
		o.handleInput(DOWN);
		o.handleInput("g");
		expect(o.render(80).join("\n")).toBe(first);
	});

	it("G jumps to bottom", () => {
		const o = makeOverlay();
		const first = o.render(80).join("\n");
		o.handleInput("G");
		expect(o.render(80).join("\n")).not.toBe(first);
	});
});

describe("PromptPreviewOverlay copy + diff", () => {
	it("c emits copy with the current injection text", () => {
		const o = makeOverlay();
		const actions: PromptAction[] = [];
		o.onAction = (a) => actions.push(a);
		o.handleInput("c");
		expect(actions.length).toBe(1);
		expect(actions[0].kind).toBe("copy");
		expect((actions[0] as { kind: "copy"; text: string }).text).toContain("STATUS.md");
	});

	it("p toggles diff mode when prevInjection exists", () => {
		const o = makeOverlay({ withPrev: true });
		const preview = o.render(80).join("\n");
		o.handleInput("p");
		const diff = o.render(80).join("\n");
		expect(preview).not.toBe(diff);
	});

	it("p does nothing when prevInjection is empty", () => {
		const o = makeOverlay({ withPrev: false });
		const before = o.render(80).join("\n");
		o.handleInput("p");
		const after = o.render(80).join("\n");
		expect(after).toBe(before);
	});
});

describe("PromptPreviewOverlay render", () => {
	it("returns lines including the title", () => {
		const o = makeOverlay();
		const lines = o.render(80);
		expect(lines.some(l => l.includes("Prompt Preview"))).toBe(true);
	});

	it("shows the diff badge when in diff mode", () => {
		const o = makeOverlay({ withPrev: true });
		o.handleInput("p");
		const lines = o.render(80);
		expect(lines.some(l => l.includes("diff vs previous"))).toBe(true);
	});

	it("shows 'p for diff' hint when prev exists but in preview mode", () => {
		const o = makeOverlay({ withPrev: true });
		const lines = o.render(80);
		expect(lines.some(l => l.includes("p for diff"))).toBe(true);
	});

	it("does not show diff hint when no previous turn", () => {
		const o = makeOverlay({ withPrev: false });
		const lines = o.render(80);
		expect(lines.some(l => l.includes("p for diff"))).toBe(false);
	});
});
