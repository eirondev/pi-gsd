/**
 * /gsd:list-phase-assumptions command
 * 
 * Show Claude's intended approach before planning
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	getPhaseDir,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerListPhaseAssumptionsCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:list-phase-assumptions", {
		description: "Show what Claude assumes before planning a phase",
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

			// Parse phase number or use current
			const phaseNum = args.trim() ? parseInt(args.trim(), 10) : state.currentPhase;
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:list-phase-assumptions [phase-number]", "warning");
				return;
			}

			const phase = state.phases.find(p => p.number === phaseNum);
			if (!phase) {
				ctx.ui.notify(`Phase ${phaseNum} not found.`, "error");
				return;
			}

			// Gather assumptions from available context
			const assumptions: string[] = [];

			// From PROJECT.md
			const projectPath = path.join(planningDir, "PROJECT.md");
			if (fs.existsSync(projectPath)) {
				const project = fs.readFileSync(projectPath, "utf-8");
				// Extract tech stack, decisions
				const techMatch = project.match(/## Tech Stack[\s\S]*?(?=##|$)/);
				if (techMatch) {
					assumptions.push(`**Tech Stack:**\n${techMatch[0]}`);
				}
				const decisionsMatch = project.match(/## Key Decisions[\s\S]*?(?=##|$)/);
				if (decisionsMatch) {
					assumptions.push(`**Key Decisions:**\n${decisionsMatch[0]}`);
				}
			}

			// From REQUIREMENTS.md
			const requirementsPath = path.join(planningDir, "REQUIREMENTS.md");
			if (fs.existsSync(requirementsPath)) {
				const requirements = fs.readFileSync(requirementsPath, "utf-8");
				const mustMatch = requirements.match(/### Must Have[\s\S]*?(?=###|$)/);
				if (mustMatch) {
					assumptions.push(`**Must Have:**\n${mustMatch[0].slice(0, 500)}...`);
				}
			}

			// From phase CONTEXT.md
			const phaseDir = getPhaseDir(planningDir, phaseNum);
			if (phaseDir) {
				const contextPath = path.join(phaseDir, "CONTEXT.md");
				if (fs.existsSync(contextPath)) {
					const context = fs.readFileSync(contextPath, "utf-8");
					assumptions.push(`**Phase ${phaseNum} Context:**\n\`\`\`\n${context.slice(0, 800)}...\n\`\`\``);
				}
			}

			// From STATE.md
			if (state.blockers.length > 0) {
				assumptions.push(`**Current Blockers:**\n${state.blockers.map(b => `- ${b}`).join("\n")}`);
			}

			// Display assumptions
			ctx.ui.notify(
				`📋 Assumptions for Phase ${phaseNum}: ${phase.name}\n\n` +
				(assumptions.length > 0 
					? assumptions.join("\n\n")
					: "No assumptions documented yet.\n\nRun /gsd:discuss-phase to capture context."),
				"info"
			);

			// Ask if they want to add more assumptions
			const addMore = await ctx.ui.confirm(
				"Would you like to add or clarify assumptions?",
				"Yes, edit CONTEXT.md"
			);

			if (addMore && phaseDir) {
				const contextPath = path.join(phaseDir, "CONTEXT.md");
				const existing = fs.existsSync(contextPath) 
					? fs.readFileSync(contextPath, "utf-8")
					: `# Phase ${phaseNum}: ${phase.name}\n\n## Assumptions\n\n- \n\n## Dependencies\n\n- \n`;
				
				const edited = await ctx.ui.editor("Edit assumptions:", existing);
				if (edited) {
					fs.writeFileSync(contextPath, edited, "utf-8");
					ctx.ui.notify("Assumptions saved.", "success");
				}
			}
		},
	});
}