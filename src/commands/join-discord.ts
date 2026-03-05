/**
 * /gsd:join-discord command
 * 
 * Join the GSD Discord community
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function registerJoinDiscordCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:join-discord", {
		description: "Join the GSD Discord community",
		handler: async (args, ctx) => {
			ctx.ui.notify(
				"💬 GSD Community\n\n" +
				"**Original GSD Discord:**\n" +
				"https://discord.gg/gsd\n\n" +
				"**Follow on X:**\n" +
				"https://x.com/gsd_foundation\n\n" +
				"**pi-gsd Issues:**\n" +
				"https://github.com/eirondev/pi-gsd/issues\n\n" +
				"---\n\n" +
				"Note: The original GSD Discord is for Claude Code GSD.\n" +
				"For pi-gsd specific issues, use GitHub issues.",
				"info"
			);
		},
	});
}