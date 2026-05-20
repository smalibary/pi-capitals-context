import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

export type SkipAction =
	| { kind: "add" }
	| { kind: "delete"; name: string }
	| { kind: "reset" }
	| { kind: "quit" };

export class SkipOverlay {
	private list: string[];
	private source: "default" | "project";
	private theme: Theme;
	private cursor = 0;
	private armedDelete: string | null = null;
	private armedReset = false;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onAction?: (action: SkipAction) => void;

	constructor(list: string[], source: "default" | "project", theme: Theme) {
		this.list = [...list];
		this.source = source;
		this.theme = theme;
	}

	refresh(list: string[], source: "default" | "project"): void {
		this.list = [...list];
		this.source = source;
		const max = this.rowCount() - 1;
		if (this.cursor > max) this.cursor = Math.max(0, max);
		this.armedDelete = null;
		this.armedReset = false;
		this.invalidate();
	}

	private rowCount(): number {
		return this.list.length + 1;
	}

	private isAddRow(idx: number): boolean {
		return idx === 0;
	}

	private entryAt(idx: number): string | undefined {
		if (this.isAddRow(idx)) return undefined;
		return this.list[idx - 1];
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.armedDelete = null;
			this.armedReset = false;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.down)) {
			if (this.cursor < this.rowCount() - 1) this.cursor++;
			this.armedDelete = null;
			this.armedReset = false;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.escape)) {
			this.armedDelete = null;
			this.armedReset = false;
			this.onAction?.({ kind: "quit" });
			return;
		}
		if (matchesKey(data, Key.enter)) {
			if (this.isAddRow(this.cursor)) {
				this.armedDelete = null;
				this.armedReset = false;
				this.onAction?.({ kind: "add" });
				return;
			}
			return;
		}
		if (data === "a" || data === "A") {
			this.armedDelete = null;
			this.armedReset = false;
			this.onAction?.({ kind: "add" });
			return;
		}
		if (data === "d" || data === "D") {
			const name = this.entryAt(this.cursor);
			if (!name) return;
			this.armedReset = false;
			if (this.armedDelete === name) {
				this.armedDelete = null;
				this.onAction?.({ kind: "delete", name });
				return;
			}
			this.armedDelete = name;
			this.invalidate();
			return;
		}
		if (data === "R") {
			this.armedDelete = null;
			if (this.armedReset) {
				this.armedReset = false;
				this.onAction?.({ kind: "reset" });
				return;
			}
			this.armedReset = true;
			this.invalidate();
			return;
		}
		this.armedDelete = null;
		this.armedReset = false;
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
			const vis = SkipOverlay.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private buildContent(w: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const tag = this.source === "default"
			? t.fg("dim", " (defaults)")
			: t.fg("accent", " (project override)");
		lines.push(t.fg("accent", "Skip List") + tag);

		const addCursor = this.isAddRow(this.cursor);
		const addPre = addCursor ? "> " : "  ";
		lines.push(truncateToWidth(t.fg("accent", `${addPre}+ Add entry`), w));

		if (this.list.length === 0) {
			lines.push(t.fg("dim", "  (no entries — skip list is empty)"));
		} else {
			for (let i = 0; i < this.list.length; i++) {
				const name = this.list[i];
				const isCursor = i + 1 === this.cursor;
				const pre = isCursor ? "> " : "  ";
				const armed = this.armedDelete === name;
				const tail = armed ? t.fg("error", "  press d again to remove") : "";
				lines.push(truncateToWidth(`${pre}${name}${tail}`, w));
			}
		}

		lines.push("");
		if (this.armedReset) {
			lines.push(t.fg("error", truncateToWidth("  press R again to reset skip list to defaults", w)));
		} else if (addCursor) {
			lines.push(t.fg("dim", truncateToWidth("type a filename you want CAPS to skip (e.g. NOTES.md)", w)));
		} else {
			lines.push(t.fg("dim", truncateToWidth("entries here will be excluded from CAPS discovery", w)));
		}

		return lines;
	}

	private helpLine(): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		if (this.isAddRow(this.cursor)) {
			return "  " + k("↑↓") + d(" navigate · ") + k("⏎ or a") + d(" add · ") + k("R") + d(" reset · ") + k("esc") + d(" quit");
		}
		return "  " + k("↑↓") + d(" navigate · ") + k("a") + d(" add · ") + k("d") + d(" delete · ") + k("R") + d(" reset · ") + k("esc") + d(" quit");
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const content = this.buildContent(width - 4);
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
