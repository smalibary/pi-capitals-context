export function estimateTokens(text: string): number {
	let tokens = 0;
	for (const chunk of text.split(/\s+/)) {
		if (chunk.length === 0) continue;
		tokens += Math.max(1, Math.ceil(chunk.length / 4));
	}
	return tokens;
}

export function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return `${n}`;
}
