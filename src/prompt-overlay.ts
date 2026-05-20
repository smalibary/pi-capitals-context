import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { FileEntry } from "./types.js";
import { buildPromptPreview, formatSystemPromptExtra } from "./injection.js";
import { simpleLineDiff } from "./diff.js";

export type PromptAction =
	| { kind: "copy"; text: string }
	| { kind: "quit" };

export class PromptPreviewOverlay {
	private enabled: FileEntry[];
	private prevInjection: string;
	private mode: "preview" | "diff" = "preview";
	private theme: Theme;
	private scroll = 0;
	private lines: string[] = [];
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onAction?: (action: PromptAction) => void;

	constructor(enabled: FileEntry[], prevInjection: string, theme: Theme) {
		this.enabled = enabled;
		this.prevInjection = prevInjection;
		this.theme = theme;
		this.rebuild();
	}

	private rebuild(): void {
		const t = this.theme;
		if (this.mode === "preview") {
			this.lines = buildPromptPreview(this.enabled, t).split("\n");
		} else {
			const current = formatSystemPromptExtra(this.enabled);
			const header = t.fg("accent", "[CAPS Injection Diff vs previous turn]");
			this.lines = [header, ...simpleLineDiff(this.prevInjection, current).split("\n")];
		}
		this.scroll = 0;
		this.invalidate();
	}

	private currentText(): string {
		return formatSystemPromptExtra(this.enabled);
	}

	private hasDiff(): boolean {
		return this.prevInjection.length > 0;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) { this.onAction?.({ kind: "quit" }); return; }
		if (matchesKey(data, Key.up)) { this.scroll = Math.max(0, this.scroll - 1); this.invalidate(); return; }
		if (matchesKey(data, Key.down)) {
			this.scroll = Math.min(Math.max(0, this.lines.length - 1), this.scroll + 1);
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.pageUp)) { this.scroll = Math.max(0, this.scroll - 8); this.invalidate(); return; }
		if (matchesKey(data, Key.pageDown)) {
			this.scroll = Math.min(Math.max(0, this.lines.length - 1), this.scroll + 8);
			this.invalidate();
			return;
		}
		if (data === "g") { this.scroll = 0; this.invalidate(); return; }
		if (data === "G") { this.scroll = Math.max(0, this.lines.length - 1); this.invalidate(); return; }
		if (data === "c" || data === "C") {
			this.onAction?.({ kind: "copy", text: this.currentText() });
			return;
		}
		if (data === "p" || data === "P") {
			if (!this.hasDiff()) return;
			this.mode = this.mode === "preview" ? "diff" : "preview";
			this.rebuild();
		}
	}

	private static stripAnsi(s: string): string {
		return s.replace(/\x1b\[[0-9;]*m/g, "");
	}

	private boxLines(content: string[], totalWidth: number): string[] {
		const t = this.theme;
		const innerWidth = totalWidth - 4;
		const h = "─".repeat(Math.max(0, totalWidth - 2));
		const top = t.fg("accent", "╭" + h + "╮");
		const bot = t.fg("accent", "╰" + h + "╯");
		const bar = t.fg("accent", "│");
		const lines: string[] = [top];
		for (const line of content) {
			const vis = PromptPreviewOverlay.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private buildContent(w: number, maxRows: number): string[] {
		const t = this.theme;
		const out: string[] = [];
		const modeBadge = this.mode === "diff"
			? t.fg("dim", "  · diff vs previous turn")
			: this.hasDiff() ? t.fg("dim", "  · p for diff") : "";
		out.push(t.fg("accent", "Prompt Preview") + modeBadge);

		const start = this.scroll;
		const end = Math.min(this.lines.length, start + maxRows);
		if (start > 0) out.push(t.fg("dim", `  ↑ ${start} more`));
		for (let i = start; i < end; i++) out.push(truncateToWidth(this.lines[i], w));
		if (end < this.lines.length) out.push(t.fg("dim", `  ↓ ${this.lines.length - end} more`));
		return out;
	}

	private helpLine(): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		const diffHint = this.hasDiff()
			? " · " + k("p") + d(" diff")
			: "";
		return "  " + k("↑↓") + d(" scroll · ") + k("PgUp/PgDn") + d(" page · ") + k("c") + d(" copy") + diffHint + " · " + k("esc") + d(" quit");
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const termHeight: number = (process.stdout as any).rows ?? 24;
		const maxRows = Math.max(4, termHeight - 6);
		const content = this.buildContent(width - 4, maxRows);
		const lines = [...this.boxLines(content, width), this.helpLine()];
		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}
