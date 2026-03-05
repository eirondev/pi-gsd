/**
 * /gsd:new-milestone command
 * 
 * Start next version/milestone for existing project
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	type GsdState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerNewMilestoneCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:new-milestone", {
		description: "Start next milestone/version for existing project",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);
			if (!planningDir) {
				ctx.ui.notify("No GSD project found. Run /gsd:new-project first.", "error");
				return;
			}

			const state = readState(planningDir);
			if (!state) {
				ctx.ui.notify("Project found but STATE.md is corrupted.", "error");
				return;
			}

			// Check if there's an incomplete milestone
			const incompletePhases = state.phases.filter(p => p.status !== "completed");
			if (incompletePhases.length > 0 && !args.includes("--force")) {
				const proceed = await ctx.ui.confirm(
					`There are ${incompletePhases.length} incomplete phase(s):\n` +
					incompletePhases.map(p => `  - Phase ${p.number}: ${p.name}`).join("\n") +
					`\n\nStart new milestone anyway?`,
					"Yes, start new milestone"
				);
				if (!proceed) {
					ctx.ui.notify("Cancelled. Complete phases or use --force.", "warning");
					return;
				}
			}

			// Get milestone name
			const milestoneName = args.trim() || await ctx.ui.editor(
				"Milestone name (e.g., 'User Authentication', 'Q1 Release'):",
				""
			);

			if (!milestoneName?.trim()) {
				ctx.ui.notify("Milestone name required.", "error");
				return;
			}

			// Description of what this milestone adds
			const description = await ctx.ui.editor(
				`What does "${milestoneName.trim()}" deliver?`,
				`## ${milestoneName.trim()}\n\n### Goals\n\n- \n\n### Non-Goals\n\n- \n`
			);

			// Update state for new milestone
			state.milestone = milestoneName.trim();
			state.currentPhase = 0;
			state.phaseStatus = "pending";
			state.phases = [];
			state.blockers = [];

			// Create new requirements section
			const requirementsPath = path.join(planningDir, "REQUIREMENTS.md");
			if (fs.existsSync(requirementsPath)) {
				const existing = fs.readFileSync(requirementsPath, "utf-8");
				const milestoneSection = `\n\n---\n\n## ${milestoneName.trim()}\n\n${description || "Goals for this milestone."}\n`;
				fs.writeFileSync(requirementsPath, existing + milestoneSection, "utf-8");
			}

			// Create milestone directory
			const phasesDir = path.join(planningDir, "phases");
			if (!fs.existsSync(phasesDir)) {
				fs.mkdirSync(phasesDir, { recursive: true });
			}

			// Update next actions
			state.nextActions = [
				`Milestone: ${milestoneName.trim()}`,
				`Run /gsd:discuss-phase 1 to capture implementation decisions`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ New Milestone: ${milestoneName.trim()}\n\n` +
				`Version: ${state.projectVersion || "0.0.0"}\n\n` +
				`Next steps:\n` +
				`1. Run /gsd:discuss-phase 1 to capture decisions\n` +
				`2. Run /gsd:plan-phase 1 to create plans\n` +
				`3. Run /gsd:execute-phase 1 to implement`,
				"success"
			);
		},
	});
}