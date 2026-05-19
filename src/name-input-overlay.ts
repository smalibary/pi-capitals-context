import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { isValidProfileName } from "./profiles.js";

export interface NameInputState {
	value: string;
	valid: boolean;
	reason?: "empty" | "too_long" | "edge_whitespace" | "exists";
}

export class NameInputOverlay {
	private title: string;
	private hint: string;
	private value = "";
	private existing: Set<string>;
	private theme: Theme;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onSave?: (name: string) => void;
	public onDiscard?: () => void;

	constructor(opts: {
		title: string;
		hint: string;
		existing: Set<string>;
		initial?: string;
		theme: Theme;
	}) {
		this.title = opts.title;
		this.hint = opts.hint;
		this.existing = opts.existing;
		this.theme = opts.theme;
		if (opts.initial) this.value = opts.initial;
	}

	getState(): NameInputState {
		const v = this.value;
		if (v.length === 0) return { value: v, valid: false, reason: "empty" };
		if (v.length > 50) return { value: v, valid: false, reason: "too_long" };
		if (!isValidProfileName(v)) return { value: v, valid: false, reason: "edge_whitespace" };
		if (this.existing.has(v)) return { value: v, valid: false, reason: "exists" };
		return { value: v, valid: true };
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			this.onDiscard?.();
			return;
		}
		if (matchesKey(data, Key.enter)) {
			const s = this.getState();
			if (s.valid) this.onSave?.(s.value);
			return;
		}
		if (data === "\x7f" || data === "\b") {
			if (this.value.length > 0) {
				this.value = this.value.slice(0, -1);
				this.invalidate();
			}
			return;
		}
		if (data.length === 1 && data >= " " && data <= "~") {
			if (this.value.length < 60) {
				this.value += data;
				this.invalidate();
			}
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
			const vis = NameInputOverlay.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private reasonText(reason: NameInputState["reason"]): string {
		switch (reason) {
			case "empty": return "type a name";
			case "too_long": return "name too long (max 50)";
			case "edge_whitespace": return "no leading or trailing whitespace";
			case "exists": return "a profile with this name already exists";
			default: return "";
		}
	}

	private buildContent(w: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		lines.push(t.fg("accent", truncateToWidth(this.title, w)));
		if (this.hint) lines.push(t.fg("dim", truncateToWidth(this.hint, w)));
		lines.push("");

		const display = this.value + t.fg("accent", "_");
		lines.push(truncateToWidth("  " + display, w + 30));

		const s = this.getState();
		lines.push("");
		if (s.valid) {
			lines.push(t.fg("accent", "  ✓ ready — press Enter to save"));
		} else {
			lines.push(t.fg("error", "  ✗ " + this.reasonText(s.reason)));
		}

		return lines;
	}

	private helpLine(): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		return "  " + k("⏎") + d(" save · ") + k("esc") + d(" discard");
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
