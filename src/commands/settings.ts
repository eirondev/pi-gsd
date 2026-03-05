/**
 * /gsd:settings command
 * 
 * Configure model profile and workflow settings
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface GsdSettings {
	modelProfile: "quality" | "balanced" | "budget";
	workflow: {
		research: boolean;
		planCheck: boolean;
		verifier: boolean;
		autoAdvance: boolean;
	};
	parallelization: {
		enabled: boolean;
		maxConcurrent: number;
	};
	git: {
		branchingStrategy: "none" | "phase" | "milestone";
		phaseBranchTemplate: string;
		milestoneBranchTemplate: string;
	};
	planning: {
		commitDocs: boolean;
	};
}

const defaultSettings: GsdSettings = {
	modelProfile: "balanced",
	workflow: {
		research: true,
		planCheck: true,
		verifier: true,
		autoAdvance: false,
	},
	parallelization: {
		enabled: true,
		maxConcurrent: 4,
	},
	git: {
		branchingStrategy: "none",
		phaseBranchTemplate: "gsd/phase-{phase}-{slug}",
		milestoneBranchTemplate: "gsd/{milestone}-{slug}",
	},
	planning: {
		commitDocs: true,
	},
};

export function registerSettingsCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:settings", {
		description: "Configure GSD model profile and workflow settings",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);

			// Load or create settings
			let settings: GsdSettings = defaultSettings;

			if (planningDir) {
				const settingsPath = path.join(planningDir, "config.json");
				if (fs.existsSync(settingsPath)) {
					try {
						const loaded = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
						settings = { ...defaultSettings, ...loaded };
					} catch {
						// Use defaults if config is corrupted
					}
				}
			}

			// Show current settings
			ctx.ui.notify(
				`⚙️ GSD Settings\n\n` +
				`**Model Profile:** ${settings.modelProfile}\n` +
				`  - research: ${settings.workflow.research ? "✅" : "❌"}\n` +
				`  - plan-check: ${settings.workflow.planCheck ? "✅" : "❌"}\n` +
				`  - verifier: ${settings.workflow.verifier ? "✅" : "❌"}\n` +
				`  - auto-advance: ${settings.workflow.autoAdvance ? "✅" : "❌"}\n\n` +
				`**Parallelization:** ${settings.parallelization.enabled ? "Enabled" : "Disabled"} (max: ${settings.parallelization.maxConcurrent})\n\n` +
				`**Git Branching:** ${settings.git.branchingStrategy}\n\n` +
				`Run with --model, --workflow, or --git to change settings.`,
				"info"
			);

			// Ask what to configure
			const category = await ctx.ui.select(
				"What would you like to configure?",
				[
					"Model profile",
					"Workflow settings",
					"Parallelization",
					"Git branching",
					"Done",
				]
			);

			if (!category || category === "Done") {
				return;
			}

			if (category === "Model profile") {
				const profile = await ctx.ui.select(
					"Select model profile:",
					[
						"quality (Opus for planning & execution)",
						"balanced (Opus/Sonnet mix - recommended)",
						"budget (Sonnet/Haiku - faster, cheaper)",
					]
				);

				if (profile) {
					settings.modelProfile = profile.split(" ")[0] as GsdSettings["modelProfile"];
				}
			} else if (category === "Workflow settings") {
				const research = await ctx.ui.confirm("Enable research phase?", "Yes");
				settings.workflow.research = research;

				const planCheck = await ctx.ui.confirm("Enable plan checking?", "Yes");
				settings.workflow.planCheck = planCheck;

				const verifier = await ctx.ui.confirm("Enable verification phase?", "Yes");
				settings.workflow.verifier = verifier;

				const autoAdvance = await ctx.ui.confirm("Auto-advance between phases?", "No");
				settings.workflow.autoAdvance = autoAdvance;
			} else if (category === "Parallelization") {
				const enabled = await ctx.ui.confirm("Enable parallel execution?", "Yes");
				settings.parallelization.enabled = enabled;

				if (enabled) {
					const maxStr = await ctx.ui.editor(
						`Max concurrent executions (currently ${settings.parallelization.maxConcurrent}):`,
						String(settings.parallelization.maxConcurrent)
					);
					const max = parseInt(maxStr?.trim() || "4", 10);
					settings.parallelization.maxConcurrent = isNaN(max) ? 4 : Math.min(Math.max(max, 1), 10);
				}
			} else if (category === "Git branching") {
				const strategy = await ctx.ui.select(
					"Select branching strategy:",
					[
						"none (commit to current branch)",
						"phase (create branch per phase)",
						"milestone (one branch per milestone)",
					]
				);

				if (strategy) {
					settings.git.branchingStrategy = strategy.split(" ")[0] as GsdSettings["git"]["branchingStrategy"];
				}
			}

			// Save settings
			if (planningDir) {
				const settingsPath = path.join(planningDir, "config.json");
				fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
				ctx.ui.notify("✅ Settings saved.", "success");
			} else {
				ctx.ui.notify(
					"⚠️ Settings changed for this session.\n\n" +
					"Run /gsd:new-project first to save settings permanently.",
					"warning"
				);
			}
		},
	});
}