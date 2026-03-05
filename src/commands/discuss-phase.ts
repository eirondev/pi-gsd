/**
 * /gsd:discuss-phase command
 * 
 * Captures implementation decisions for a phase
 * Creates CONTEXT.md with the discussion results
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	createPhaseDir,
	getPhaseDir,
	type GsdState,
	type GsdPhase,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerDiscussPhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:discuss-phase", {
		description: "Capture implementation decisions for a phase",
		handler: async (args, ctx) => {
			const phaseNum = parseInt(args.trim(), 10);
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:discuss-phase <phase-number>", "warning");
				return;
			}

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

			// Find or create the phase
			let phase = state.phases.find((p) => p.number === phaseNum);
			if (!phase) {
				// Interactive phase name
				const phaseName = await ctx.ui.editor(
					`Phase ${phaseNum} name:`,
					`Phase ${phaseNum}: Implementation`
				);
				if (!phaseName?.trim()) {
					ctx.ui.notify("Phase name required. Cancelled.", "error");
					return;
				}
				phase = {
					number: phaseNum,
					name: phaseName.trim(),
					status: "discussing",
					plans: [],
					summaries: [],
				};
				state.phases.push(phase);
			}

			// Update status
			phase.status = "discussing";
			state.currentPhase = phaseNum;
			state.phaseStatus = "discussing";
			writeState(planningDir, state);

			// Create phase directory
			const phaseDir = createPhaseDir(planningDir, phaseNum, phase.name);

			// Check for existing CONTEXT.md
			const contextPath = path.join(phaseDir, "CONTEXT.md");
			let existingContext = "";
			if (fs.existsSync(contextPath)) {
				existingContext = fs.readFileSync(contextPath, "utf-8");
			}

			// Prompt for discussion
			const discussion = await ctx.ui.editor(
				`Phase ${phaseNum}: ${phase.name}\n\nCapture implementation decisions:\n- What problem are we solving?\n- What's our approach?\n- Key trade-offs?\n- Dependencies?`,
				existingContext || `# Phase ${phaseNum}: ${phase.name}\n\n## Problem\n\n[What problem are we solving?]\n\n## Approach\n\n[What's our approach?]\n\n## Key Decisions\n\n1. [Decision 1]\n2. [Decision 2]\n\n## Dependencies\n\n- [ ] Dependency 1\n- [ ] Dependency 2\n\n## Risks\n\n- [Risk 1]\n- [Risk 2]\n`
			);

			if (!discussion?.trim()) {
				ctx.ui.notify("No discussion captured. Cancelled.", "warning");
				return;
			}

			// Save CONTEXT.md
			fs.writeFileSync(contextPath, discussion.trim(), "utf-8");
			phase.contextMd = "CONTEXT.md";

			// Update next actions
			state.nextActions = [
				`Run /gsd:plan-phase ${phaseNum} to create task plans`,
				`Review CONTEXT.md in .planning/phases/${String(phaseNum).padStart(2, "0")}-${phase.name.replace(/\s+/g, "-")}/`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Context captured for Phase ${phaseNum}\n\n` +
					`Saved to: ${contextPath}\n\n` +
					`Next: Run /gsd:plan-phase ${phaseNum} to create task plans`,
				"success"
			);
		},
	});
}