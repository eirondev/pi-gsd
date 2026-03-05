/**
 * /gsd:add-phase command
 * 
 * Append a new phase to the roadmap
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

export function registerAddPhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:add-phase", {
		description: "Append a new phase to the roadmap",
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

			// Determine next phase number
			const nextNumber = state.phases.length > 0 
				? Math.max(...state.phases.map(p => p.number)) + 1 
				: 1;

			// Get phase name
			const phaseName = args.trim() || await ctx.ui.editor(
				`Phase ${nextNumber} name:`,
				""
			);

			if (!phaseName?.trim()) {
				ctx.ui.notify("Phase name required.", "error");
				return;
			}

			// Get phase description
			const description = await ctx.ui.editor(
				`Phase ${nextNumber}: ${phaseName.trim()}\n\nDescription (what this phase delivers):`,
				""
			);

			// Create new phase
			const newPhase: GsdPhase = {
				number: nextNumber,
				name: phaseName.trim(),
				description: description?.trim(),
				status: "pending",
				plans: [],
				summaries: [],
			};

			state.phases.push(newPhase);

			// Update roadmap
			const roadmapPath = path.join(planningDir, "ROADMAP.md");
			if (fs.existsSync(roadmapPath)) {
				let roadmap = fs.readFileSync(roadmapPath, "utf-8");
				const phaseEntry = `\n\n## Phase ${nextNumber}: ${phaseName.trim()}\n\n${description?.trim() || "Description TBD."}\n\n**Status:** 🔜 Planned\n`;
				fs.writeFileSync(roadmapPath, roadmap + phaseEntry, "utf-8");
			}

			// Create phase directory
			const phaseDir = path.join(
				planningDir, 
				"phases", 
				`${String(nextNumber).padStart(2, "0")}-${phaseName.trim().replace(/\s+/g, "-")}`
			);
			fs.mkdirSync(phaseDir, { recursive: true });

			// Update next actions
			state.nextActions = [
				`Added Phase ${nextNumber}: ${phaseName.trim()}`,
				`Run /gsd:discuss-phase ${nextNumber} when ready`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Added Phase ${nextNumber}: ${phaseName.trim()}\n\n` +
				`Directory: ${phaseDir}\n\n` +
				`Next: Run /gsd:discuss-phase ${nextNumber} to capture decisions`,
				"success"
			);
		},
	});
}