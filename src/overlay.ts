import * as path from "node:path";
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { FileEntry, RenderItem, SortMode } from "./types.js";
import { SORT_LABELS } from "./types.js";
import { estimateTokens, formatTokens } from "./tokens.js";
import { CONTEXT_LABEL } from "./env.js";

export class CapsSelector {
	private items: FileEntry[];
	private sorted: FileEntry[];
	private sortMode: SortMode = "discovery";
	private filter = "";
	private cursor = 0;
	private expandedFolders = new Set<string>();
	private theme: Theme;
	private cachedWidth?: number;
	private cachedLines?: string[];
	public onDone?: () => void;

	constructor(items: FileEntry[], theme: Theme) {
		this.items = items;
		this.sorted = [...items];
		this.theme = theme;
	}

	private resort(): void {
		if (this.sortMode === "alpha") {
			this.sorted = [...this.items].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
		} else if (this.sortMode === "tokens") {
			this.sorted = [...this.items].sort((a, b) => estimateTokens(b.content) - estimateTokens(a.content));
		} else {
			this.sorted = [...this.items];
		}
		this.invalidate();
	}

	private getVisible(): FileEntry[] {
		if (!this.filter) return this.sorted;
		const q = this.filter.toLowerCase();
		return this.sorted.filter(f => f.relativePath.toLowerCase().includes(q));
	}

	private buildRenderItems(visible: FileEntry[]): RenderItem[] {
		const items: RenderItem[] = [];
		const processedGroups = new Set<string>();
		for (const f of visible) {
			if (f.folderGroup) {
				if (!processedGroups.has(f.folderGroup)) {
					processedGroups.add(f.folderGroup);
					const groupFiles = visible.filter(v => v.folderGroup === f.folderGroup);
					items.push({ kind: "folder", group: f.folderGroup, files: groupFiles });
					if (this.expandedFolders.has(f.folderGroup) || this.filter !== "") {
						for (const gf of groupFiles) items.push({ kind: "file", entry: gf });
					}
				}
			} else {
				items.push({ kind: "file", entry: f });
			}
		}
		return items;
	}

	handleInput(data: string): void {
		const visible = this.getVisible();
		const renderItems = this.buildRenderItems(visible);

		if (matchesKey(data, Key.up)) {
			if (this.cursor > 0) this.cursor--;
			this.invalidate();
		} else if (matchesKey(data, Key.down)) {
			if (this.cursor < renderItems.length + 1) this.cursor++;
			this.invalidate();
		} else if (matchesKey(data, Key.left)) {
			const item = this.cursor >= 2 ? renderItems[this.cursor - 2] : null;
			if (item?.kind === "folder" && this.expandedFolders.has(item.group)) {
				this.expandedFolders.delete(item.group);
				this.invalidate();
			}
		} else if (matchesKey(data, Key.space)) {
			if (this.cursor === 0) {
				const allFiles = renderItems.filter(i => i.kind === "file").map(i => (i as Extract<RenderItem, { kind: "file" }>).entry);
				const anyOn = allFiles.some(f => f.enabled);
				for (const f of allFiles) f.enabled = !anyOn;
			} else if (this.cursor === 1) {
				const modes: SortMode[] = ["discovery", "alpha", "tokens"];
				this.sortMode = modes[(modes.indexOf(this.sortMode) + 1) % modes.length];
				this.resort();
				return;
			} else {
				const item = renderItems[this.cursor - 2];
				if (item?.kind === "folder") {
					if (this.expandedFolders.has(item.group)) {
						const anyOn = item.files.some(f => f.enabled);
						for (const f of item.files) f.enabled = !anyOn;
					} else {
						this.expandedFolders.add(item.group);
					}
				} else if (item?.kind === "file") {
					item.entry.enabled = !item.entry.enabled;
				}
			}
			this.invalidate();
		} else if (data === "\x7f" || data === "\b") {
			if (this.filter.length > 0) {
				this.filter = this.filter.slice(0, -1);
				this.cursor = 0;
				this.invalidate();
			}
		} else if (matchesKey(data, Key.escape)) {
			if (this.filter) {
				this.filter = "";
				this.cursor = 0;
				this.invalidate();
			} else {
				this.onDone?.();
			}
		} else if (matchesKey(data, Key.enter)) {
			this.onDone?.();
		} else if (data.length === 1 && data >= " ") {
			this.filter += data;
			this.cursor = 0;
			this.invalidate();
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
			const vis = CapsSelector.stripAnsi(line).length;
			const padded = line + " ".repeat(Math.max(0, innerWidth - vis));
			lines.push(bar + " " + padded + " " + bar);
		}
		lines.push(bot);
		return lines;
	}

	private buildContent(w: number, maxFileRows?: number): string[] {
		const t = this.theme;
		const lines: string[] = [];
		const visible = this.getVisible();
		const renderItems = this.buildRenderItems(visible);

		const allFiles = renderItems.filter(i => i.kind === "file").map(i => (i as Extract<RenderItem, { kind: "file" }>).entry);
		const allOn = allFiles.length > 0 && allFiles.every(f => f.enabled);
		const noneOn = allFiles.every(f => !f.enabled);
		const allCheck = allOn ? "☑" : noneOn ? "☐" : "◑";

		const header = t.fg("accent", `${allCheck} ${CONTEXT_LABEL}`);
		lines.push(this.filter ? header + t.fg("dim", ` · /${this.filter}_`) : header);

		const togglePre = this.cursor === 0 ? "> " : "  ";
		const toggleLabel = allFiles.length < this.sorted.length
			? `${allCheck} Toggle all (${allFiles.length} of ${this.sorted.length})`
			: `${allCheck} Toggle all`;
		lines.push(truncateToWidth(`${togglePre}${toggleLabel}`, w));

		const sortPre = this.cursor === 1 ? "> " : "  ";
		lines.push(truncateToWidth(`${sortPre}⇅ Sort: ${SORT_LABELS[this.sortMode]}`, w));

		let start = 0;
		let end = renderItems.length;
		if (maxFileRows !== undefined && renderItems.length > maxFileRows) {
			const cursorInList = Math.max(0, this.cursor - 2);
			const half = Math.floor(maxFileRows / 2);
			start = Math.max(0, Math.min(cursorInList - half, renderItems.length - maxFileRows));
			end = start + maxFileRows;
		}

		if (start > 0) lines.push(t.fg("dim", truncateToWidth(`  ↑ ${start} more`, w)));

		for (let i = start; i < end; i++) {
			const item = renderItems[i];
			const isCursor = this.cursor === i + 2;
			const p = isCursor ? "> " : "  ";

			if (item.kind === "folder") {
				const allOnFolder = item.files.every(f => f.enabled);
				const noneOnFolder = item.files.every(f => !f.enabled);
				const check = allOnFolder ? "☑" : noneOnFolder ? "☐" : "◑";
				const expanded = this.expandedFolders.has(item.group) || this.filter !== "";
				const arrow = expanded ? "▼" : "▶";
				const folderLine = `${p}${arrow} ${check} ${item.group} (${item.files.length} files)`;
				lines.push(truncateToWidth(t.fg("accent", folderLine), w));
			} else {
				const f = item.entry;
				const nested = !!f.folderGroup;
				const indent = nested ? "  " : "";
				const c = f.enabled ? "☑" : "☐";
				const tokens = formatTokens(estimateTokens(f.content));
				const name = nested ? path.basename(f.relativePath) : f.relativePath;
				const line = `${p}${indent}${c} ${name} · ${tokens} tokens`;
				lines.push(truncateToWidth(f.enabled ? line : t.fg("dim", line), w));
			}
		}

		if (end < renderItems.length) lines.push(t.fg("dim", truncateToWidth(`  ↓ ${renderItems.length - end} more`, w)));
		if (visible.length === 0) lines.push(t.fg("dim", `  no matches for "${this.filter}"`));

		const enabledTokens = this.sorted.filter(f => f.enabled).reduce((sum, f) => sum + estimateTokens(f.content), 0);
		lines.push(t.fg("dim", `  total: ${formatTokens(enabledTokens)} tokens`));

		const off = this.sorted.filter(f => !f.enabled).length;
		if (off > 0) lines.push(t.fg("dim", `  ${off} item${off > 1 ? "s" : ""} not in context`));

		return lines;
	}

	private helpLine(hoveredItem?: RenderItem | null): string {
		const t = this.theme;
		const k = (s: string) => t.fg("accent", s);
		const d = (s: string) => t.fg("dim", s);
		if (this.filter) {
			return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" toggle · ") + k("⌫") + d(" erase · ") + k("esc") + d(" clear filter");
		}
		if (hoveredItem?.kind === "folder") {
			const expanded = this.expandedFolders.has(hoveredItem.group) || this.filter !== "";
			if (expanded) {
				return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" toggle all in folder · ") + k("←") + d(" collapse · ") + k("esc") + d(" done");
			}
			return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" expand folder · ") + k("esc") + d(" done");
		}
		return "  " + k("↑↓") + d(" navigate · ") + k("space") + d(" select · ") + d("type to search · ") + k("esc") + d(" done");
	}

	private buildPreview(file: FileEntry, innerWidth: number, maxLines: number): string[] {
		const t = this.theme;
		const all = file.content.split("\n").filter(l => l.trim());
		const lines: string[] = [t.fg("accent", truncateToWidth(file.relativePath, innerWidth))];
		const avail = Math.max(0, maxLines - 1);
		const numW = String(all.length).length + 1;
		const row = (n: number, text: string) =>
			t.fg("dim", String(n).padStart(numW) + " ") + truncateToWidth(text, innerWidth - numW - 1);
		if (all.length <= avail) {
			for (let i = 0; i < all.length; i++) lines.push(row(i + 1, all[i]));
		} else {
			const topCount = Math.floor(avail / 2);
			const botCount = Math.max(0, avail - topCount - 1);
			const hidden = all.length - topCount - botCount;
			const startBot = all.length - botCount;
			for (let i = 0; i < topCount; i++) lines.push(row(i + 1, all[i]));
			lines.push(t.fg("dim", truncateToWidth(`── ${hidden} line${hidden > 1 ? "s" : ""} ──`, innerWidth)));
			for (let i = 0; i < botCount; i++) lines.push(row(startBot + i + 1, all[startBot + i]));
		}
		return lines;
	}

	private buildFolderPreview(item: Extract<RenderItem, { kind: "folder" }>, innerWidth: number): string[] {
		const t = this.theme;
		const totalTokens = item.files.reduce((s, f) => s + estimateTokens(f.content), 0);
		const lines: string[] = [
			t.fg("accent", truncateToWidth(item.group, innerWidth)),
			t.fg("dim", truncateToWidth(`${item.files.length} files · ${formatTokens(totalTokens)} tokens total`, innerWidth)),
		];
		for (const f of item.files) {
			const c = f.enabled ? "☑" : "☐";
			const tokens = formatTokens(estimateTokens(f.content));
			lines.push(truncateToWidth(`  ${c} ${path.basename(f.relativePath)} · ${tokens} tokens`, innerWidth));
		}
		return lines;
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

		const termHeight: number = (process.stdout as any).rows ?? 24;
		const maxAllowed = Math.max(8, termHeight - 4);
		const maxFileRows = Math.max(1, maxAllowed - 2 - 1 - 4);

		const renderItems = this.buildRenderItems(this.getVisible());
		const hoveredItem = this.cursor >= 2 ? renderItems[this.cursor - 2] ?? null : null;
		const hoveredFile = hoveredItem?.kind === "file" ? hoveredItem.entry : null;
		const hoveredFolder = hoveredItem?.kind === "folder" ? hoveredItem : null;

		const LEFT_W = 44;
		const GAP = 2;
		const rightTotalW = width - LEFT_W - GAP;
		const showPreview = hoveredItem !== null && rightTotalW >= 28;

		if (!showPreview) {
			const content = this.buildContent(width - 4, maxFileRows);
			this.cachedLines = [...this.boxLines(content, width), this.helpLine(hoveredItem)];
			this.cachedWidth = width;
			return this.cachedLines;
		}

		const leftContent = this.buildContent(LEFT_W - 4, maxFileRows);
		const leftLines = this.boxLines(leftContent, LEFT_W);

		const rightInnerW = rightTotalW - 4;
		let rightContent: string[];
		if (hoveredFolder) {
			rightContent = this.buildFolderPreview(hoveredFolder, rightInnerW);
		} else {
			const previewMaxLines = Math.min(leftLines.length - 2, Math.max(4, maxAllowed - 3));
			rightContent = this.buildPreview(hoveredFile!, rightInnerW, previewMaxLines);
		}
		const rightLines = this.boxLines(rightContent, rightTotalW);

		const maxH = Math.max(leftLines.length, rightLines.length);
		const gapStr = " ".repeat(GAP);
		const emptyLeft = " ".repeat(LEFT_W);
		const emptyRight = " ".repeat(rightTotalW);
		const lines: string[] = [];
		for (let i = 0; i < maxH; i++) {
			lines.push((leftLines[i] ?? emptyLeft) + gapStr + (rightLines[i] ?? emptyRight));
		}
		lines.push(this.helpLine(hoveredItem));

		this.cachedLines = lines;
		this.cachedWidth = width;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}
