import { spawn } from "node:child_process";

interface ClipCommand {
	cmd: string;
	args: string[];
}

function clipCommandForPlatform(): ClipCommand | null {
	switch (process.platform) {
		case "win32": return { cmd: "clip", args: [] };
		case "darwin": return { cmd: "pbcopy", args: [] };
		case "linux": return { cmd: "xclip", args: ["-selection", "clipboard"] };
		default: return null;
	}
}

export async function copyToClipboard(text: string): Promise<{ ok: boolean; reason?: string }> {
	const cmd = clipCommandForPlatform();
	if (!cmd) return { ok: false, reason: `unsupported platform: ${process.platform}` };

	return new Promise(resolve => {
		try {
			const p = spawn(cmd.cmd, cmd.args);
			let settled = false;
			const settle = (result: { ok: boolean; reason?: string }) => {
				if (settled) return;
				settled = true;
				resolve(result);
			};
			p.on("error", err => settle({ ok: false, reason: `${cmd.cmd} not found (${err.message})` }));
			p.on("close", code => settle({ ok: code === 0, reason: code === 0 ? undefined : `${cmd.cmd} exited ${code}` }));
			p.stdin.write(text);
			p.stdin.end();
		} catch (err) {
			resolve({ ok: false, reason: err instanceof Error ? err.message : String(err) });
		}
	});
}
