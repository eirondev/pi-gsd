/**
 * GSD Extension for Pi-Agent
 * 
 * Get-Shit-Done: Spec-driven development with context engineering
 * 
 * Commands:
 *   Core Workflow:
 *     /gsd:new-project           - Initialize a new GSD project
 *     /gsd:discuss-phase <N>      - Capture implementation decisions
 *     /gsd:plan-phase <N>         - Research and create plans
 *     /gsd:execute-phase <N>      - Execute phase plans
 *     /gsd:verify-work <N>        - Verify deliverables
 *   
 *   Milestone Management:
 *     /gsd:complete-milestone     - Archive milestone, tag release
 *     /gsd:new-milestone [name]   - Start next version
 *     /gsd:audit-milestone        - Verify milestone DoD
 *     /gsd:plan-milestone-gaps    - Create phases to close gaps
 *   
 *   Phase Management:
 *     /gsd:add-phase              - Append phase to roadmap
 *     /gsd:insert-phase <N>       - Insert phase at position
 *     /gsd:remove-phase <N>        - Remove phase
 *     /gsd:list-phase-assumptions - Show planned approach
 *   
 *   Session Management:
 *     /gsd:pause-work             - Create handoff
 *     /gsd:resume-work            - Restore from handoff
 *   
 *   Brownfield:
 *     /gsd:map-codebase           - Analyze existing codebase
 *   
 *   Utilities:
 *     /gsd:status                 - Show project status
 *     /gsd:progress               - Show workflow position
 *     /gsd:quick [--full]         - Ad-hoc task with GSD guarantees
 *     /gsd:debug [desc]           - Systematic debugging
 *     /gsd:add-todo [desc]        - Capture idea for later
 *     /gsd:check-todos            - List pending todos
 *     /gsd:health [--repair]      - Validate .planning/
 *     /gsd:settings               - Configure workflow
 *     /gsd:set-profile <profile>  - Switch model profile
 *     /gsd:help                   - Show all commands
 *     /gsd:update                 - Update pi-gsd
 *     /gsd:join-discord           - Join community
 * 
 * Based on: https://github.com/gsd-build/get-shit-done
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Core workflow
import { registerNewProjectCommand } from "./commands/new-project.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerProgressCommand } from "./commands/progress.js";
import { registerDiscussPhaseCommand } from "./commands/discuss-phase.js";
import { registerPlanPhaseCommand } from "./commands/plan-phase.js";
import { registerExecutePhaseCommand } from "./commands/execute-phase.js";
import { registerVerifyWorkCommand } from "./commands/verify-work.js";

// Milestone management
import { registerCompleteMilestoneCommand } from "./commands/complete-milestone.js";
import { registerNewMilestoneCommand } from "./commands/new-milestone.js";
import { registerAuditMilestoneCommand } from "./commands/audit-milestone.js";
import { registerPlanMilestoneGapsCommand } from "./commands/plan-milestone-gaps.js";

// Phase management
import { registerAddPhaseCommand } from "./commands/add-phase.js";
import { registerInsertPhaseCommand } from "./commands/insert-phase.js";
import { registerRemovePhaseCommand } from "./commands/remove-phase.js";
import { registerListPhaseAssumptionsCommand } from "./commands/list-phase-assumptions.js";

// Session management
import { registerPauseWorkCommand } from "./commands/pause-work.js";
import { registerResumeWorkCommand } from "./commands/resume-work.js";

// Brownfield
import { registerMapCodebaseCommand } from "./commands/map-codebase.js";

// Utilities
import { registerQuickCommand } from "./commands/quick.js";
import { registerDebugCommand } from "./commands/debug.js";
import { registerAddTodoCommand } from "./commands/add-todo.js";
import { registerCheckTodosCommand } from "./commands/check-todos.js";
import { registerHealthCommand } from "./commands/health.js";
import { registerSettingsCommand } from "./commands/settings.js";
import { registerSetProfileCommand } from "./commands/set-profile.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerJoinDiscordCommand } from "./commands/join-discord.js";

// Tools
import { registerGsdTool } from "./tools/gsd-spawn.js";

// State management
import { findPlanningDir, readState } from "./state.js";

export default function gsdExtension(pi: ExtensionAPI): void {
	// Core workflow commands
	registerNewProjectCommand(pi);
	registerStatusCommand(pi);
	registerProgressCommand(pi);
	registerDiscussPhaseCommand(pi);
	registerPlanPhaseCommand(pi);
	registerExecutePhaseCommand(pi);
	registerVerifyWorkCommand(pi);
	
	// Milestone management commands
	registerCompleteMilestoneCommand(pi);
	registerNewMilestoneCommand(pi);
	registerAuditMilestoneCommand(pi);
	registerPlanMilestoneGapsCommand(pi);
	
	// Phase management commands
	registerAddPhaseCommand(pi);
	registerInsertPhaseCommand(pi);
	registerRemovePhaseCommand(pi);
	registerListPhaseAssumptionsCommand(pi);
	
	// Session management commands
	registerPauseWorkCommand(pi);
	registerResumeWorkCommand(pi);
	
	// Brownfield support
	registerMapCodebaseCommand(pi);
	
	// Utility commands
	registerQuickCommand(pi);
	registerDebugCommand(pi);
	registerAddTodoCommand(pi);
	registerCheckTodosCommand(pi);
	registerHealthCommand(pi);
	registerSettingsCommand(pi);
	registerSetProfileCommand(pi);
	registerHelpCommand(pi);
	registerUpdateCommand(pi);
	registerJoinDiscordCommand(pi);
	
	// Tools for sub-agent spawning
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
				
				// Show pending todos if any
				if (state.todos && state.todos.length > 0) {
					pi.log("info", `GSD: ${state.todos.length} pending todo(s)`);
				}
				
				// Show blockers if any
				if (state.blockers && state.blockers.length > 0) {
					pi.log("warn", `GSD: ${state.blockers.length} blocker(s) - ${state.blockers.join(", ")}`);
				}
			}
		}
	});
}