/**
 * /gsd:verify-work command
 * 
 * Manual verification checklist for phase deliverables
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	getPhaseDir,
	type GsdState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerVerifyWorkCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:verify-work", {
		description: "Manually verify phase deliverables",
		handler: async (args, ctx) => {
			const phaseNum = parseInt(args.trim(), 10);
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:verify-work <phase-number>", "warning");
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

			// Find the phase
			const phase = state.phases.find((p) => p.number === phaseNum);
			if (!phase) {
				ctx.ui.notify(`Phase ${phaseNum} not found.`, "error");
				return;
			}

			const phaseDir = getPhaseDir(planningDir, phaseNum);
			if (!phaseDir) {
				ctx.ui.notify(`Phase ${phaseNum} directory not found.`, "error");
				return;
			}

			// Update status
			phase.status = "verifying";
			state.currentPhase = phaseNum;
			state.phaseStatus = "verifying";
			writeState(planningDir, state);

			// Build verification checklist
			const checklist = await buildVerificationChecklist(ctx, phase, phaseDir, planningDir);

			// Run through checklist
			const allPassed = await runVerificationChecklist(ctx, phase, phaseDir, checklist);

			if (allPassed) {
				// Mark phase as complete
				phase.status = "completed";
				state.phaseStatus = "completed";
				
				// Update next actions
				const nextPhase = state.phases.find(p => p.number === phaseNum + 1);
				if (nextPhase) {
					state.nextActions = [
						`Phase ${phaseNum} complete! ✓`,
						`Run /gsd:discuss-phase ${phaseNum + 1} to start next phase`,
					];
				} else {
					state.nextActions = [
						`All phases complete! 🎉`,
						`Run /gsd:status to see project summary`,
					];
				}

				writeState(planningDir, state);

				ctx.ui.notify(
					`✅ Phase ${phaseNum} verified and complete!\n\n` +
					`All checks passed. Phase marked as complete.\n\n` +
					`Summary saved to: ${path.join(phaseDir, "SUMMARY.md")}`,
					"success"
				);
			} else {
				// Some checks failed
				state.nextActions = [
					`Fix issues found in Phase ${phaseNum}`,
					`Re-run /gsd:verify-work ${phaseNum} after fixes`,
				];
				writeState(planningDir, state);

				ctx.ui.notify(
					`⚠️ Phase ${phaseNum} has issues\n\n` +
					`Fix the issues above and re-run verification.`,
					"warning"
				);
			}
		},
	});
}

interface VerificationItem {
	category: string;
	item: string;
	status: "pass" | "fail" | "skip" | "pending";
	details?: string;
}

async function buildVerificationChecklist(
	ctx: any,
	phase: any,
	phaseDir: string,
	planningDir: string
): Promise<VerificationItem[]> {
	const items: VerificationItem[] = [];

	// 1. Files exist
	const contextPath = path.join(phaseDir, "CONTEXT.md");
	const researchPath = path.join(phaseDir, "RESEARCH.md");
	const summaryPath = path.join(phaseDir, "SUMMARY.md");

	items.push({
		category: "Documentation",
		item: "CONTEXT.md exists",
		status: fs.existsSync(contextPath) ? "pass" : "skip",
	});

	items.push({
		category: "Documentation",
		item: "RESEARCH.md exists",
		status: fs.existsSync(researchPath) ? "pass" : "skip",
	});

	items.push({
		category: "Documentation",
		item: "SUMMARY.md exists",
		status: fs.existsSync(summaryPath) ? "pass" : "fail",
	});

	// 2. Plans were executed
	const planFiles = fs.readdirSync(phaseDir).filter(f => 
		f.match(/^\d+-.*\.md$/) && 
		!f.includes("CONTEXT") && 
		!f.includes("RESEARCH") && 
		!f.includes("SUMMARY") &&
		!f.includes("VERIFICATION")
	);

	for (const planFile of planFiles) {
		items.push({
			category: "Plans",
			item: `${planFile} was executed`,
			status: "pending",
		});
	}

	// 3. Code changes (check git)
	items.push({
		category: "Code",
		item: "Changes committed to git",
		status: "pending",
	});

	// 4. Tests
	items.push({
		category: "Quality",
		item: "Tests pass (if applicable)",
		status: "pending",
	});

	items.push({
		category: "Quality",
		item: "No TypeScript errors (if applicable)",
		status: "pending",
	});

	items.push({
		category: "Quality",
		item: "No lint errors (if applicable)",
		status: "pending",
	});

	return items;
}

async function runVerificationChecklist(
	ctx: any,
	phase: any,
	phaseDir: string,
	items: VerificationItem[]
): Promise<boolean> {
	ctx.ui.notify(
		`🔍 Verification Checklist for Phase ${phase.number}: ${phase.name}\n\n` +
		"Please verify each item:",
		"info"
	);

	let allPassed = true;

	for (const item of items) {
		if (item.status === "skip") {
			ctx.ui.notify(`  ⏭️ ${item.category}: ${item.item} (skipped)`, "info");
			continue;
		}

		if (item.status === "pass") {
			ctx.ui.notify(`  ✓ ${item.category}: ${item.item}`, "info");
			continue;
		}

		// Pending items need user verification
		const result = await ctx.ui.select(
			`${item.category}: ${item.item}`,
			["Pass ✓", "Fail ✗", "Skip ⏭️"]
		);

		if (result === "Pass ✓" || result === "Skip ⏭️") {
			item.status = result === "Pass ✓" ? "pass" : "skip";
			if (result === "Pass ✓") {
				ctx.ui.notify(`  ✓ ${item.category}: ${item.item}`, "info");
			} else {
				ctx.ui.notify(`  ⏭️ ${item.category}: ${item.item} (skipped)`, "info");
			}
		} else {
			item.status = "fail";
			allPassed = false;

			// Get details on what failed
			const details = await ctx.ui.editor(
				`What failed for "${item.item}"?`,
				""
			);

			if (details?.trim()) {
				// Save to verification issues file
				const issuesPath = path.join(phaseDir, "VERIFICATION-ISSUES.md");
				let existing = "";
				if (fs.existsSync(issuesPath)) {
					existing = fs.readFileSync(issuesPath, "utf-8");
				}
				const newIssue = `\n\n## ${item.item}\n\n${details.trim()}\n`;
				fs.writeFileSync(issuesPath, existing + newIssue, "utf-8");
			}
		}
	}

	// Save verification results
	const verificationPath = path.join(phaseDir, "VERIFICATION.md");
	const results = items.map(i => 
		`- [${i.status === "pass" ? "x" : i.status === "skip" ? "~" : " "}] ${i.category}: ${i.item}`
	).join("\n");

	const verificationContent = `# Phase ${phase.number} Verification

**Date:** ${new Date().toISOString()}
**Status:** ${allPassed ? "✅ PASSED" : "⚠️ ISSUES FOUND"}

## Checklist

${results}

${allPassed ? "All checks passed!" : "See VERIFICATION-ISSUES.md for details."}
`;

	fs.writeFileSync(verificationPath, verificationContent, "utf-8");

	return allPassed;
}