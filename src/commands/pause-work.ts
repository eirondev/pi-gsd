/**
 * /gsd:pause-work command
 * 
 * Create handoff when stopping mid-phase
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

export function registerPauseWorkCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:pause-work", {
		description: "Create handoff when stopping mid-phase",
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

			// Check if there's active work
			if (state.phaseStatus === "pending" || state.phaseStatus === "completed") {
				ctx.ui.notify(
					"No active work to pause.\n\n" +
					`Current status: ${state.phaseStatus}\n` +
					`Phase: ${state.currentPhase || "None"}`,
					"warning"
				);
				return;
			}

			const phase = state.phases.find(p => p.number === state.currentPhase);
			if (!phase) {
				ctx.ui.notify(`Phase ${state.currentPhase} not found.`, "error");
				return;
			}

			// Get what was done
			const whatDone = await ctx.ui.editor(
				"What did you complete in this session?",
				`- [ ] Item 1\n- [ ] Item 2\n`
			);

			// Get what's left
			const whatLeft = await ctx.ui.editor(
				"What's left to do?",
				`- [ ] Remaining task 1\n- [ ] Remaining task 2\n`
			);

			// Get blockers
			const blockers = await ctx.ui.editor(
				"Any blockers or context for next session?",
				""
			);

			// Create handoff file
			const handoffPath = path.join(planningDir, "HANDOFF.md");
			const timestamp = new Date().toISOString();
			
			const handoffContent = `# Handoff

**Created:** ${timestamp}
**Phase:** ${state.currentPhase} - ${phase.name}
**Status:** ${state.phaseStatus}

## Completed This Session

${whatDone || "Nothing explicitly noted."}

## Remaining Work

${whatLeft || "See phase plans."}

## Blockers / Context

${blockers || "None noted."}

## Current Phase State

\`\`\`json
${JSON.stringify(phase, null, 2)}
\`\`\`

## Resume Instructions

1. Read this HANDOFF.md
2. Run /gsd:resume-work
3. Run /gsd:plan-phase ${state.currentPhase} (if still planning)
4. Run /gsd:execute-phase ${state.currentPhase} (if ready to execute)
5. Run /gsd:verify-work ${state.currentPhase} (when done)

---

_Delete this file after resuming._
`;

			fs.writeFileSync(handoffPath, handoffContent, "utf-8");

			// Update state
			state.blockers = blockers?.trim() 
				? [...(state.blockers || []), blockers.trim()]
				: state.blockers;
			state.nextActions = [
				"Work paused. Handoff created.",
				"Run /gsd:resume-work to continue.",
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Handoff Created\n\n` +
				`Phase: ${state.currentPhase} - ${phase.name}\n` +
				`Status: ${state.phaseStatus}\n\n` +
				`Handoff saved to: HANDOFF.md\n\n` +
				`To resume: /gsd:resume-work`,
				"info"
			);
		},
	});
}