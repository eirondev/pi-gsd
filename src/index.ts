/**
 * GSD Extension for Pi-Agent
 * 
 * Get-Shit-Done: Spec-driven development with context engineering
 * 
 * Commands:
 *   /gsd:new-project - Initialize a new GSD project
 *   /gsd:status - Show current project status
 *   /gsd:progress - Show workflow position and next steps
 *   /gsd:discuss-phase <N> - Capture implementation decisions for a phase
 *   /gsd:plan-phase <N> - Research and create plans for a phase
 *   /gsd:execute-phase <N> - Execute phase plans
 *   /gsd:verify-work <N> - Manual verification of deliverables
 * 
 * Based on: https://github.com/gsd-build/get-shit-done
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerStatusCommand } from "./commands/status.js";
import { registerNewProjectCommand } from "./commands/new-project.js";
import { registerProgressCommand } from "./commands/progress.js";
import { registerDiscussPhaseCommand } from "./commands/discuss-phase.js";
import { registerPlanPhaseCommand } from "./commands/plan-phase.js";
import { registerExecutePhaseCommand } from "./commands/execute-phase.js";
import { registerVerifyWorkCommand } from "./commands/verify-work.js";
import { registerGsdTool } from "./tools/gsd-spawn.js";
import { findPlanningDir, readState, writeState } from "./state.js";

export default function gsdExtension(pi: ExtensionAPI): void {
	// Register all commands
	registerStatusCommand(pi);
	registerNewProjectCommand(pi);
	registerProgressCommand(pi);
	registerDiscussPhaseCommand(pi);
	registerPlanPhaseCommand(pi);
	registerExecutePhaseCommand(pi);
	registerVerifyWorkCommand(pi);
	
	// Register tools for sub-agent spawning
	registerGsdTool(pi);
	
	// Session restoration - reload state on startup
	pi.on("session_start", async (_event, ctx) => {
		const planningDir = findPlanningDir(ctx.cwd);
		if (planningDir) {
			const state = readState(planningDir);
			if (state) {
				pi.log("info", `GSD: Restored state for project "${state.projectName}"`);
				pi.log("info", `GSD: Phase ${state.currentPhase} (${state.phaseStatus})`);
				
				// Set status indicator
				if (state.phaseStatus !== "pending" && state.phaseStatus !== "completed") {
					ctx.ui.setStatus("gsd-phase", `📋 P${state.currentPhase}: ${state.phaseStatus}`);
				}
			}
		}
	});
}