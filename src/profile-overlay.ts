import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { diffProfile, type ProfileStore, type ToggleMap } from "./profiles.js";

export type ProfileAction =
	| { kind: "load"; name: string }
	| { kind: "delete"; name: string }
	| { kind: "rename"; name: string }
	| { kind: "edit"; name: string }
	| { kind: "create" }
	| { kind: "quit" };

export class ProfileSelector {
	private names: string[];
	private store: ProfileStore;
	private current: ToggleMap;
	private known: Set<string>;
	private theme: Theme;
	private cursor = 0;
	private armedDelete: string | null = null;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onAction?: (action: ProfileAction) => void;

	constructor(
		store: ProfileStore,
		current: ToggleMap,
		knownPaths: Set<string>,
		theme: Theme,
	) {
		this.store = store;
		this.names = Object.keys(store).sort();
		this.current = current;
		this.known = knownPaths;
		this.theme = theme;
	}

	private rowCount(): number {
		return this.names.length + 1;
	}

	private isCreateRow(idx: number): boolean {
		return idx === 0;
	}

	private profileAt(idx: number): string | undefined {
		if (this.isCreateRow(idx)) return undefined;
		return this.names[idx - 1];
	}

	refresh(store: ProfileStore): void {
		this.store = store;
		this.names = Object.keys(store).sort();
		const max = this.rowCount() - 1;
		if (this.cursor > max) this.cursor = Math.max(0, max);
		this.armedDelete = null;
		this.invalidate();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.armedDelete = null;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.down)) {
			if (this.cursor < this.rowCount() - 1) this.cursor++;
			this.armedDelete = null;
			this.invalidate();
			return;
		}
		if (matchesKey(data, Key.escape)) {
			this.armedDelete = null;
			this.onAction?.({ kind: "quit" });
			return;
		}
		if (matchesKey(data, Key.enter)) {
			if (this.isCreateRow(this.cursor)) {
				this.armedDelete = null;
				this.onAction?.({ kind: "create" });
				return;
			}
			const name = this.profileAt(this.cursor);
			if (!name) return;
			this.armedDelete = null;
			this.onAction?.({ kind: "load", name });
			return;
		}
		if (data === "d" || data === "D") {
			const name = this.profileAt(this.cursor);
			if (!name) return;
			if (this.armedDelete === name) {
				this.armedDelete = null;
				this.onAction?.({ kind: "delete", name });
				return;
			}
			this.armedDelete = name;
			this.invalidate();
			return;
		}
		if (data === "r" || data === "R") {
			const name = this.profileAt(this.cursor);
			if (!name) return;
			this.armedDelete = null;
			this.onAction?.({ kind: "rename", name });
			return;
		}
		if (data === "e" || data === "E") {
			const name = this.profileAt(this.cursor);
			if (!name) return;
			this.armedDelete = null;
			this.onAction?.({ kind: "edit", name });
			return;
		}
		this.armedDelete = null;
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
			const vis = ProfileSelector.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private summariseProfile(name: string): string {
		const toggles = this.store[name];
		if (!toggles) return "";
		const total = Object.keys(toggles).length;
		const on = Object.values(toggles).filter(Boolean).length;
		return `${on}/${total} enabled`;
	}

	private diffLines(name: string, innerWidth: number): string[] {
		const t = this.theme;
		const toggles = this.store[name];
		if (!toggles) return [];
		const d = diffProfile(this.current, toggles, this.known);
		const lines: string[] = [];
		const summary = `enable ${d.toEnable.length} · disable ${d.toDisable.length} · ${d.unchanged} unchanged` +
			(d.missing.length > 0 ? ` · ${d.missing.length} missing` : "");
		lines.push(t.fg("dim", truncateToWidth(`on load: ${summary}`, innerWidth)));
		for (const f of d.toEnable.slice(0, 3)) lines.push(truncateToWidth(t.fg("accent", "  + " + f), innerWidth));
		if (d.toEnable.length > 3) lines.push(t.fg("dim", `  + ${d.toEnable.length - 3} more`));
		for (const f of d.toDisable.slice(0, 3)) lines.push(truncateToWidth(t.fg("dim", "  − " + f), innerWidth));
		if (d.toDisable.length > 3) lines.push(t.fg("dim", `  − ${d.toDisable.length - 3} more`));
		if (d.missing.length > 0) {
			lines.push(t.fg("dim", `  ? missing: ${d.missing.slice(0, 2).join(", ")}${d.missing.length > 2 ? "…" : ""}`));
		}
		return lines;
	}

	private buildContent(w: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		lines.push(t.fg("accent", "CAPS Profiles"));

		const createCursor = this.isCreateRow(this.cursor);
		const createPre = createCursor ? "> " : "  ";
		lines.push(truncateToWidth(t.fg("accent", `${createPre}+ Create new profile`), w));

		if (this.names.length === 0) {
			lines.push(t.fg("dim", "  (no profiles saved yet)"));
		} else {
			for (let i = 0; i < this.names.length; i++) {
				const name = this.names[i];
				const isCursor = i + 1 === this.cursor;
				const pre = isCursor ? "> " : "  ";
				const armed = this.armedDelete === name;
				const summary = this.summariseProfile(name);
				const tail = armed ? t.fg("error", "  press d again to delete") : t.fg("dim", `  ${summary}`);
				lines.push(truncateToWidth(`${pre}${name}${tail}`, w));
			}
		}

		const sel = this.profileAt(this.cursor);
		if (sel) {
			lines.push("");
			for (const line of this.diffLines(sel, w)) lines.push(line);
		} else if (createCursor) {
			lines.push("");
			lines.push(t.fg("dim", truncateToWidth("snapshot the toggles you want, then name the profile", w)));
		}

		return lines;
	}

	private helpLine(): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		if (this.isCreateRow(this.cursor)) {
			return "  " + k("↑↓") + d(" navigate · ") + k("⏎") + d(" create new · ") + k("esc") + d(" quit");
		}
		return "  " + k("↑↓") + d(" navigate · ") + k("⏎") + d(" load · ") + k("e") + d(" edit · ") + k("r") + d(" rename · ") + k("d") + d(" delete · ") + k("esc") + d(" quit");
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
