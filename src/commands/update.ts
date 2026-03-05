/**
 * /gsd:update command
 * 
 * Update pi-gsd to latest version
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as child_process from "node:child_process";

export function registerUpdateCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:update", {
		description: "Update pi-gsd to latest version",
		handler: async (args, ctx) => {
			ctx.ui.notify(
				"🔄 Updating pi-gsd...\n\n" +
				"Fetching latest version from npm...",
				"info"
			);

			try {
				// Check current version
				const currentVersion = "0.1.0"; // Would read from package.json

				// Try npm update
				const result = child_process.execSync(
					"npm update @eirondev/pi-gsd",
					{ encoding: "utf-8", cwd: process.cwd() }
				);

				ctx.ui.notify(
					"✅ pi-gsd updated!\n\n" +
					"Run '/gsd:help' to see all available commands.\n" +
					"Restart pi to load the new version.",
					"info"
				);
			} catch (error: any) {
				// If npm fails, suggest manual update
				ctx.ui.notify(
					"⚠️ Update failed\n\n" +
					"Manual update:\n" +
					"```bash\n" +
					"npm install @eirondev/pi-gsd@latest\n" +
					"```\n\n" +
					"Or from GitHub:\n" +
					"```bash\n" +
					"git clone https://github.com/eirondev/pi-gsd.git\n" +
					"cd pi-gsd\n" +
					"npm install && npm run build\n" +
					"```",
					"warning"
				);
			}
		},
	});
}