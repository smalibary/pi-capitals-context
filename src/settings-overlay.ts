import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

export interface SettingsRow {
	id: string;
	label: string;
	badge?: string;
	stub?: boolean;
	stubHint?: string;
}

export type SettingsAction =
	| { kind: "open"; id: string }
	| { kind: "quit" };

export class SettingsHubOverlay {
	private rows: SettingsRow[];
	private theme: Theme;
	private cursor = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onAction?: (action: SettingsAction) => void;

	constructor(rows: SettingsRow[], theme: Theme) {
		this.rows = rows;
		this.theme = theme;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.down)) {
			if (this.cursor < this.rows.length - 1) this.cursor++;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.escape)) {
			this.onAction?.({ kind: "quit" });
			return;
		}
		if (matchesKey(data, Key.enter)) {
			const row = this.rows[this.cursor];
			if (!row || row.stub) return;
			this.onAction?.({ kind: "open", id: row.id });
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
			const vis = SettingsHubOverlay.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private buildContent(w: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		lines.push(t.fg("accent", "CAPS Settings"));
		for (let i = 0; i < this.rows.length; i++) {
			const row = this.rows[i];
			const isCursor = i === this.cursor;
			const pre = isCursor ? "> " : "  ";
			const badge = row.badge ? t.fg("dim", `  ${row.badge}`) : "";
			const stub = row.stub ? t.fg("dim", "  (coming soon)") : "";
			const labelStyled = row.stub ? t.fg("dim", row.label) : row.label;
			lines.push(truncateToWidth(`${pre}${labelStyled}${badge}${stub}`, w));
		}
		const sel = this.rows[this.cursor];
		if (sel?.stubHint && sel.stub) {
			lines.push("");
			lines.push(t.fg("dim", truncateToWidth(sel.stubHint, w)));
		}
		return lines;
	}

	private helpLine(): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		return "  " + k("↑↓") + d(" navigate · ") + k("⏎") + d(" open · ") + k("esc") + d(" quit");
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
