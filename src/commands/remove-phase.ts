/**
 * /gsd:remove-phase command
 * 
 * Remove a future phase and renumber subsequent phases
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

export function registerRemovePhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:remove-phase", {
		description: "Remove a phase and renumber subsequent phases",
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

			// Parse phase number
			const phaseNum = parseInt(args.trim(), 10);
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:remove-phase <number>\nExample: /gsd:remove-phase 3", "warning");
				return;
			}

			// Find the phase
			const phase = state.phases.find(p => p.number === phaseNum);
			if (!phase) {
				ctx.ui.notify(
					`Phase ${phaseNum} not found.\n` +
					`Current phases: ${state.phases.map(p => p.number).join(", ")}`,
					"error"
				);
				return;
			}

			// Prevent removing completed or in-progress phases
			if (phase.status === "completed") {
				ctx.ui.notify(
					`Cannot remove Phase ${phaseNum} (${phase.name}) - it's already completed.\n` +
					`Completed phases cannot be removed.`,
					"error"
				);
				return;
			}

			if (phase.status === "executing" || phase.status === "planning" || phase.status === "discussing") {
				ctx.ui.notify(
					`Cannot remove Phase ${phaseNum} (${phase.name}) - it's currently ${phase.status}.\n` +
					`Only pending phases can be removed.`,
					"error"
				);
				return;
			}

			// Confirm removal
			const proceed = await ctx.ui.confirm(
				`Remove Phase ${phaseNum}: ${phase.name}?\n\n` +
				`This will also renumber phases ${phaseNum + 1}+ and archive the phase directory.\n` +
				`This cannot be undone.`,
				"Yes, remove phase"
			);

			if (!proceed) {
				ctx.ui.notify("Cancelled.", "warning");
				return;
			}

			const phasesDir = path.join(planningDir, "phases");
			const archiveDir = path.join(planningDir, "archive", "removed-phases");
			fs.mkdirSync(archiveDir, { recursive: true });

			// Archive the phase directory
			const phaseDirName = `${String(phaseNum).padStart(2, "0")}-${phase.name.replace(/\s+/g, "-")}`;
			const phaseDir = path.join(phasesDir, phaseDirName);
			if (fs.existsSync(phaseDir)) {
				const archivePath = path.join(archiveDir, `${new Date().toISOString().slice(0, 10)}-${phaseDirName}`);
				fs.renameSync(phaseDir, archivePath);
			}

			// Remove from state
			state.phases = state.phases.filter(p => p.number !== phaseNum);

			// Renumber subsequent phases
			const phasesToRenumber = state.phases.filter(p => p.number > phaseNum);
			for (const p of phasesToRenumber) {
				const oldNum = p.number;
				const newNum = oldNum - 1;
				
				// Rename directory
				const oldDir = path.join(phasesDir, String(oldNum).padStart(2, "0") + "-" + p.name.replace(/\s+/g, "-"));
				const newDir = path.join(phasesDir, String(newNum).padStart(2, "0") + "-" + p.name.replace(/\s+/g, "-"));
				
				if (fs.existsSync(oldDir)) {
					fs.renameSync(oldDir, newDir);
				}
				
				// Update number
				p.number = newNum;
			}

			// Sort phases
			state.phases.sort((a, b) => a.number - b.number);

			// Update next actions
			state.nextActions = [
				`Removed Phase ${phaseNum}: ${phase.name}`,
				`Phases ${phaseNum + 1}+ have been renumbered`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Removed Phase ${phaseNum}: ${phase.name}\n\n` +
				`Archived to: archive/removed-phases/\n` +
				`Remaining phases: ${state.phases.length}\n\n` +
				`Next: Continue with roadmap or run /gsd:add-phase`,
				"success"
			);
		},
	});
}