// Naive line-level diff. Marks lines that differ at the same index with - / +.
// Good enough to surface "did anything change vs last turn" for cache-bust awareness.
// Does not align insertions/deletions intelligently — for that, use an external diff tool.

export function simpleLineDiff(a: string, b: string): string {
	if (a === b) return "(no changes — current injection identical to previous turn)";
	const al = a.split("\n");
	const bl = b.split("\n");
	const maxLen = Math.max(al.length, bl.length);
	const out: string[] = [];
	for (let i = 0; i < maxLen; i++) {
		if (al[i] === bl[i]) continue;
		if (al[i] !== undefined) out.push(`- ${al[i]}`);
		if (bl[i] !== undefined) out.push(`+ ${bl[i]}`);
	}
	if (out.length === 0) return "(no changes — current injection identical to previous turn)";
	return out.join("\n");
}
