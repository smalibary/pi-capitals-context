export interface FileEntry {
	relativePath: string;
	content: string;
	enabled: boolean;
	isRoot: boolean;
	isGlobal?: boolean;
	folderGroup?: string;
}

export type SortMode = "discovery" | "alpha" | "tokens";

export const SORT_LABELS: Record<SortMode, string> = {
	discovery: "default",
	alpha: "a–z",
	tokens: "tokens↓",
};

export type RenderItem =
	| { kind: "folder"; group: string; files: FileEntry[] }
	| { kind: "file"; entry: FileEntry };
