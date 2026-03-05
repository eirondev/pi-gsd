/**
 * /gsd:plan-milestone-gaps command
 * 
 * Create phases to close gaps found in audit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	type GsdPhase,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerPlanMilestoneGapsCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:plan-milestone-gaps", {
		description: "Create phases to close gaps from audit",
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

			// Check for audit file
			const auditPath = path.join(planningDir, "MILESTONE-AUDIT.md");
			if (!fs.existsSync(auditPath)) {
				ctx.ui.notify(
					"No audit found. Run /gsd:audit-milestone first.",
					"warning"
				);
				return;
			}

			const audit = fs.readFileSync(auditPath, "utf-8");

			// Parse gaps from audit
			const failedItems: { category: string; item: string }[] = [];
			const failMatches = extractMatches(audit, /- ❌ \*\*([^*]+)\*\*: (.+)/g);
			for (const match of failMatches) {
				failedItems.push({ category: match[1], item: match[2] });
			}

			if (failedItems.length === 0) {
				ctx.ui.notify(
					"No gaps found in audit. All checks passed!",
					"info"
				);
				return;
			}

			// Present gaps
			ctx.ui.notify(
				`Found ${failedItems.length} gap(s) from audit:\n\n` +
				failedItems.map((g, i) => `${i + 1}. [${g.category}] ${g.item}`).join("\n"),
				"info"
			);

			// For each gap, ask if they want to create a phase
			const nextPhaseNum = state.phases.length > 0
				? Math.max(...state.phases.map(p => p.number)) + 1
				: 1;

			let addedCount = 0;

			for (let i = 0; i < failedItems.length; i++) {
				const gap = failedItems[i];
				
				const create = await ctx.ui.confirm(
					`Create phase for: "${gap.item}"?\n\nCategory: ${gap.category}`,
					"Yes, create phase"
				);

				if (!create) {
					continue;
				}

				const phaseName = await ctx.ui.editor(
					`Phase name (suggestion: "Fix ${gap.item.slice(0, 30)}..."):`,
					gap.item
				);

				if (!phaseName?.trim()) {
					continue;
				}

				// Create the phase
				const newPhase: GsdPhase = {
					number: nextPhaseNum + addedCount,
					name: phaseName.trim(),
					description: `Gap fix from audit: ${gap.category} - ${gap.item}`,
					status: "pending",
					plans: [],
					summaries: [],
				};

				state.phases.push(newPhase);
				addedCount++;

				// Create phase directory
				const phaseDir = path.join(
					planningDir,
					"phases",
					`${String(newPhase.number).padStart(2, "0")}-${phaseName.trim().replace(/\s+/g, "-")}`
				);
				fs.mkdirSync(phaseDir, { recursive: true });

				// Create CONTEXT.md with gap context
				const contextContent = `# Phase ${newPhase.number}: ${phaseName.trim()}

## Problem

${gap.item}

## Category

${gap.category}

## Goal

Fix this gap before milestone completion.

## Notes

Identified during milestone audit.
`;
				fs.writeFileSync(path.join(phaseDir, "CONTEXT.md"), contextContent, "utf-8");
			}

			if (addedCount > 0) {
				state.phases.sort((a, b) => a.number - b.number);
				state.nextActions = [
					`Added ${addedCount} gap-fix phase(s)`,
					`Run /gsd:discuss-phase ${nextPhaseNum} to start`,
				];
				writeState(planningDir, state);

				ctx.ui.notify(
					`✅ Added ${addedCount} phase(s) to close gaps.\n\n` +
					`Next: Run /gsd:discuss-phase ${nextPhaseNum}`,
					"info"
				);
			} else {
				ctx.ui.notify("No phases created.", "info");
			}
		},
	});
}

// Helper to extract all matches from markdown
function extractMatches(content: string, regex: RegExp): RegExpExecArray[] {
	const matches: RegExpExecArray[] = [];
	let match: RegExpExecArray | null;
	const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
	while ((match = re.exec(content)) !== null) {
		matches.push(match);
	}
	return matches;
}