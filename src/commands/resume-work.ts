/**
 * /gsd:resume-work command
 * 
 * Restore from last session handoff
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

export function registerResumeWorkCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:resume-work", {
		description: "Restore from last session handoff",
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

			// Check for handoff file
			const handoffPath = path.join(planningDir, "HANDOFF.md");
			if (!fs.existsSync(handoffPath)) {
				// No handoff, show current status
				const phase = state.phases.find(p => p.number === state.currentPhase);
				ctx.ui.notify(
					`📋 Current Status\n\n` +
					`Project: ${state.projectName}\n` +
					`Phase: ${state.currentPhase || "None"} ${phase ? `- ${phase.name}` : ""}\n` +
					`Status: ${state.phaseStatus}\n\n` +
					`Next Actions:\n${state.nextActions.map(a => `  - ${a}`).join("\n")}\n\n` +
					`No handoff found. Continue with your work.`,
					"info"
				);
				return;
			}

			// Read and display handoff
			const handoff = fs.readFileSync(handoffPath, "utf-8");
			
			ctx.ui.notify(
				`📋 Handoff Found\n\n${handoff}\n\n---\n\nReady to continue?`,
				"info"
			);

			// Ask if they want to proceed
			const proceed = await ctx.ui.confirm(
				"Resume from handoff?",
				"Yes, continue"
			);

			if (!proceed) {
				ctx.ui.notify("Cancelled. Handoff file preserved.", "warning");
				return;
			}

			// Extract relevant info from handoff
			const phaseMatch = handoff.match(/\*\*Phase:\*\* (\d+)/);
			const statusMatch = handoff.match(/\*\*Status:\*\* (\w+)/);

			const handoffPhase = phaseMatch ? parseInt(phaseMatch[1], 10) : state.currentPhase;
			const validStatuses = ["pending", "discussing", "planning", "executing", "verifying", "completed"] as const;
			type PhaseStatus = typeof validStatuses[number];
			const handoffStatus: PhaseStatus = statusMatch && validStatuses.includes(statusMatch[1] as PhaseStatus)
				? (statusMatch[1] as PhaseStatus)
				: state.phaseStatus;

			// Update state
			if (handoffPhase !== state.currentPhase || handoffStatus !== state.phaseStatus) {
				state.currentPhase = handoffPhase;
				state.phaseStatus = handoffStatus;
				writeState(planningDir, state);
			}

			// Remove handoff file
			fs.unlinkSync(handoffPath);

			// Determine next action
			const nextCommand = handoffStatus === "planning"
				? `/gsd:plan-phase ${handoffPhase}`
				: handoffStatus === "executing"
				? `/gsd:execute-phase ${handoffPhase}`
				: handoffStatus === "verifying"
				? `/gsd:verify-work ${handoffPhase}`
				: `/gsd:progress`;

			ctx.ui.notify(
				`✅ Resumed\n\n` +
				`Phase: ${handoffPhase}\n` +
				`Status: ${handoffStatus}\n\n` +
				`Next: ${nextCommand}`,
				"info"
			);
		},
	});
}