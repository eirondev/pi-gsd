/**
 * /gsd:insert-phase command
 * 
 * Insert a phase at a specific position, renumbering subsequent phases
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	type GsdState,
	type GsdPhase,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerInsertPhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:insert-phase", {
		description: "Insert urgent work between phases (renumbers subsequent)",
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

			// Parse position
			const insertAt = parseInt(args.trim(), 10);
			if (isNaN(insertAt) || insertAt < 1) {
				ctx.ui.notify("Usage: /gsd:insert-phase <number>\nExample: /gsd:insert-phase 2", "warning");
				return;
			}

			if (insertAt > state.phases.length + 1) {
				ctx.ui.notify(
					`Invalid position. Current phases: ${state.phases.length}\n` +
					`Insert position must be 1-${state.phases.length + 1}`,
					"error"
				);
				return;
			}

			// Warn if inserting before completed phases
			const beforePhase = state.phases.find(p => p.number === insertAt - 1);
			if (beforePhase && beforePhase.status !== "completed") {
				ctx.ui.notify(
					`⚠️ Inserting before Phase ${insertAt - 1} which is not complete yet.\n` +
					`This may affect dependencies.`,
					"warning"
				);
			}

			// Get phase name
			const phaseName = await ctx.ui.editor(
				`Inserting new phase at position ${insertAt}\n\nPhase name:`,
				""
			);

			if (!phaseName?.trim()) {
				ctx.ui.notify("Phase name required.", "error");
				return;
			}

			// Get description
			const description = await ctx.ui.editor(
				`Phase ${insertAt}: ${phaseName.trim()}\n\nDescription:`,
				""
			);

			const proceed = await ctx.ui.confirm(
				`This will renumber phases ${insertAt}+ to make room.\nContinue?`,
				"Yes, insert phase"
			);

			if (!proceed) {
				ctx.ui.notify("Cancelled.", "warning");
				return;
			}

			// Renumber phases from end to insert position
			const phasesDir = path.join(planningDir, "phases");
			
			// Renumber from highest to lowest to avoid conflicts
			const phasesToRenumber = state.phases.filter(p => p.number >= insertAt);
			for (const phase of phasesToRenumber.sort((a, b) => b.number - a.number)) {
				const oldNum = phase.number;
				const newNum = oldNum + 1;
				
				// Rename directory
				const oldDir = path.join(phasesDir, String(oldNum).padStart(2, "0") + "-" + phase.name.replace(/\s+/g, "-"));
				const newDir = path.join(phasesDir, String(newNum).padStart(2, "0") + "-" + phase.name.replace(/\s+/g, "-"));
				
				if (fs.existsSync(oldDir)) {
					fs.renameSync(oldDir, newDir);
				}
				
				// Update phase number
				phase.number = newNum;
			}

			// Create new phase at insert position
			const newPhase: GsdPhase = {
				number: insertAt,
				name: phaseName.trim(),
				description: description?.trim(),
				status: "pending",
				plans: [],
				summaries: [],
			};

			state.phases.push(newPhase);
			state.phases.sort((a, b) => a.number - b.number);

			// Create phase directory
			const newPhaseDir = path.join(
				phasesDir,
				`${String(insertAt).padStart(2, "0")}-${phaseName.trim().replace(/\s+/g, "-")}`
			);
			fs.mkdirSync(newPhaseDir, { recursive: true });

			// Update ROADMAP.md
			const roadmapPath = path.join(planningDir, "ROADMAP.md");
			if (fs.existsSync(roadmapPath)) {
				// Note: Would need proper markdown parsing to update correctly
				// For now, append note about renumbering
				const note = `\n\n<!-- Note: Phase ${insertAt} (${phaseName.trim()}) inserted. Phases ${insertAt}+ renumbered. -->`;
				fs.appendFileSync(roadmapPath, note, "utf-8");
			}

			// Update next actions
			state.nextActions = [
				`Inserted Phase ${insertAt}: ${phaseName.trim()}`,
				`Phases ${insertAt}+ have been renumbered`,
				`Run /gsd:discuss-phase ${insertAt} when ready`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Inserted Phase ${insertAt}: ${phaseName.trim()}\n\n` +
				`Phases ${insertAt}+ have been renumbered.\n` +
				`Directory: ${newPhaseDir}\n\n` +
				`Next: Run /gsd:discuss-phase ${insertAt}`,
				"info"
			);
		},
	});
}