/**
 * /gsd:set-profile command
 * 
 * Quick switch between model profiles
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

const profiles = {
	quality: {
		description: "Opus for planning & execution, Sonnet for verification",
		planning: "opus",
		execution: "opus",
		verification: "sonnet",
	},
	balanced: {
		description: "Opus for planning, Sonnet for execution & verification (recommended)",
		planning: "opus",
		execution: "sonnet",
		verification: "sonnet",
	},
	budget: {
		description: "Sonnet for planning & execution, Haiku for verification",
		planning: "sonnet",
		execution: "sonnet",
		verification: "haiku",
	},
};

export function registerSetProfileCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:set-profile", {
		description: "Switch model profile (quality/balanced/budget)",
		handler: async (args, ctx) => {
			const profileArg = args.trim().toLowerCase() as keyof typeof profiles;

			if (!profileArg || !profiles[profileArg]) {
				ctx.ui.notify(
					"Usage: /gsd:set-profile <profile>\n\n" +
					"Available profiles:\n" +
					Object.entries(profiles)
						.map(([k, v]) => `  ${k}: ${v.description}`)
						.join("\n"),
					"warning"
				);
				return;
			}

			const planningDir = findPlanningDir(ctx.cwd);
			if (!planningDir) {
				ctx.ui.notify(
					"No GSD project found. Run /gsd:new-project first.",
					"error"
				);
				return;
			}

			// Update config
			const configPath = path.join(planningDir, "config.json");
			let config: any = {};

			if (fs.existsSync(configPath)) {
				try {
					config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				} catch {
					// Ignore parse errors
				}
			}

			config.modelProfile = profileArg;

			fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

			const profile = profiles[profileArg];
			ctx.ui.notify(
				`✅ Profile: ${profileArg}\n\n` +
				`Planning: ${profile.planning}\n` +
				`Execution: ${profile.execution}\n` +
				`Verification: ${profile.verification}`,
				"info"
			);
		},
	});
}