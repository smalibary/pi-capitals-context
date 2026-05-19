import type { Theme } from "@mariozechner/pi-coding-agent";
import type { FileEntry } from "./types.js";
import { estimateTokens, formatTokens } from "./tokens.js";
import { CONTEXT_LABEL } from "./env.js";

export function buildDisplayText(rootFiles: FileEntry[], subdirFiles: FileEntry[], theme: Theme): string {
	let text = theme.fg("accent", CONTEXT_LABEL);
	const enabled = rootFiles.filter(f => f.enabled);
	const disabled = rootFiles.filter(f => !f.enabled);
	let totalTokens = 0;

	for (const f of enabled) {
		const tokens = estimateTokens(f.content);
		totalTokens += tokens;
		text += "\n" + theme.fg("muted", `  ${f.relativePath}`) + theme.fg("dim", ` · ${formatTokens(tokens)} tokens`);
	}
	for (const f of subdirFiles) {
		const tokens = estimateTokens(f.content);
		totalTokens += tokens;
		text += "\n" + theme.fg("muted", `  ${f.relativePath}`) + theme.fg("dim", ` · ${formatTokens(tokens)} tokens`);
	}
	if (enabled.length > 0 || subdirFiles.length > 0) {
		text += "\n" + theme.fg("dim", `  total: ${formatTokens(totalTokens)} tokens`);
	}
	if (disabled.length > 0) {
		text += "\n" + theme.fg("dim", `  ${disabled.length} item${disabled.length > 1 ? "s" : ""} not in context · /caps to toggle`);
	} else if (rootFiles.length > 0) {
		text += "\n" + theme.fg("dim", "  /caps to toggle");
	}
	return text;
}

export function formatSystemPromptExtra(enabled: FileEntry[]): string {
	if (enabled.length === 0) return "";
	let extra = "\n\n## Additional Context (CAPS files)\n";
	for (const f of enabled) extra += `\n### ${f.relativePath}\n\n${f.content}\n`;
	return extra;
}

function byteLength(s: string): number {
	return Buffer.byteLength(s, "utf-8");
}

function formatBytes(n: number): string {
	if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
	return `${n}B`;
}

export function buildPromptPreview(enabled: FileEntry[], theme: Theme): string {
	const lines: string[] = [];
	lines.push(theme.fg("accent", "[CAPS Injection Preview]"));

	if (enabled.length === 0) {
		lines.push(theme.fg("dim", "  no files enabled — nothing would be injected"));
		return lines.join("\n");
	}

	let totalBytes = 0;
	let totalTokens = 0;
	for (const f of enabled) {
		const b = byteLength(f.content);
		const t = estimateTokens(f.content);
		totalBytes += b;
		totalTokens += t;
		lines.push(
			theme.fg("muted", `  ${f.relativePath}`) +
			theme.fg("dim", ` · ${formatBytes(b)} · ${formatTokens(t)} tokens`),
		);
	}
	lines.push(theme.fg("dim", `  total: ${formatBytes(totalBytes)} · ${formatTokens(totalTokens)} tokens`));
	lines.push("");
	lines.push(theme.fg("accent", "──── Injected text ────"));
	lines.push(formatSystemPromptExtra(enabled).trimStart());
	return lines.join("\n");
}
