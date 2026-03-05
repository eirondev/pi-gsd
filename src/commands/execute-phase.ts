/**
 * /gsd:execute-phase command
 * 
 * Execute plans for a phase using sub-agents
 * Supports parallel execution of independent tasks
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

export function registerExecutePhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:execute-phase", {
		description: "Execute phase plans with fresh context agents",
		handler: async (args, ctx) => {
			const phaseNum = parseInt(args.trim(), 10);
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:execute-phase <phase-number>", "warning");
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
				ctx.ui.notify(`Phase ${phaseNum} not found. Create it first.`, "error");
				return;
			}

			// Check for plans
			const phaseDir = getPhaseDir(planningDir, phaseNum);
			if (!phaseDir) {
				ctx.ui.notify(`Phase ${phaseNum} directory not found. Run /gsd:plan-phase first.`, "error");
				return;
			}

			// Find plan files
			const files = fs.readdirSync(phaseDir);
			const planFiles = files.filter(f => 
				f.match(/^\d+-.*\.md$/) && 
				!f.includes("CONTEXT") && 
				!f.includes("RESEARCH") && 
				!f.includes("SUMMARY") &&
				!f.includes("VERIFICATION")
			);

			if (planFiles.length === 0) {
				ctx.ui.notify(`No plans found for Phase ${phaseNum}. Run /gsd:plan-phase first.`, "error");
				return;
			}

			// Load CONTEXT.md for context
			const contextPath = path.join(phaseDir, "CONTEXT.md");
			let context = "";
			if (fs.existsSync(contextPath)) {
				context = fs.readFileSync(contextPath, "utf-8");
			}

			// Update status
			phase.status = "executing";
			state.currentPhase = phaseNum;
			state.phaseStatus = "executing";
			writeState(planningDir, state);

			// Show execution options
			const choice = await ctx.ui.select(
				`Phase ${phaseNum}: ${phase.name}\n\n` +
				`Found ${planFiles.length} plan(s):\n${planFiles.map(p => `  - ${p}`).join("\n")}\n\n` +
				`How would you like to proceed?`,
				[
					"Execute all sequentially",
					"Execute all in parallel",
					"Select specific plan",
					"Show plan details first",
				]
			);

			if (!choice) {
				// Revert status
				phase.status = "planning";
				state.phaseStatus = "planning";
				writeState(planningDir, state);
				return;
			}

			if (choice === "Show plan details first") {
				await showPlanDetails(ctx, phaseDir, planFiles);
				// Re-ask
				phase.status = "planning";
				state.phaseStatus = "planning";
				writeState(planningDir, state);
				return;
			}

			if (choice === "Select specific plan") {
				const selectedPlan = await ctx.ui.select("Select a plan to execute:", planFiles);
				if (!selectedPlan) {
					phase.status = "planning";
					state.phaseStatus = "planning";
					writeState(planningDir, state);
					return;
				}
				await executeSinglePlan(pi, ctx, phase, phaseDir, selectedPlan, context, planningDir);
			} else if (choice === "Execute all in parallel") {
				ctx.ui.notify(
					"⚡ Parallel execution coming soon!\n\n" +
					"Currently executing sequentially to preserve context.\n" +
					"Parallel execution will spawn multiple agents with isolated contexts.",
					"info"
				);
				await executeSequentially(pi, ctx, phase, phaseDir, planFiles, context, planningDir);
			} else {
				await executeSequentially(pi, ctx, phase, phaseDir, planFiles, context, planningDir);
			}

			// Update next actions
			state.nextActions = [
				`Review work in Phase ${phaseNum}`,
				`Run /gsd:verify-work ${phaseNum} to verify deliverables`,
			];
			writeState(planningDir, state);
		},
	});
}

async function showPlanDetails(ctx: any, phaseDir: string, planFiles: string[]): Promise<void> {
	for (const planFile of planFiles) {
		const planPath = path.join(phaseDir, planFile);
		const content = fs.readFileSync(planPath, "utf-8");
		
		// Extract just the task name and action summary
		const nameMatch = content.match(/<name>([^<]+)<\/name>/);
		const name = nameMatch ? nameMatch[1] : planFile;
		
		const lines = content.split("\n").slice(0, 20);
		const preview = lines.join("\n");
		
		await ctx.ui.notify(`${planFile}:\n${preview}\n\n`, "info");
	}
}

async function executeSinglePlan(
	pi: ExtensionAPI,
	ctx: any,
	phase: any,
	phaseDir: string,
	planFile: string,
	context: string,
	planningDir: string
): Promise<void> {
	const planPath = path.join(phaseDir, planFile);
	const planContent = fs.readFileSync(planPath, "utf-8");

	// Extract task details
	const nameMatch = planContent.match(/<name>([^<]+)<\/name>/);
	const taskName = nameMatch ? nameMatch[1] : planFile;

	// Build execution prompt
	const execPrompt = `You are an execution agent for GSD (Get-Shit-Done).

Your job is to implement the task exactly as specified in the plan.

## Phase Context
${context || "No context available."}

## Plan to Execute
${planContent}

## Your Tasks:
1. Read the plan carefully
2. Implement each step exactly as specified
3. Run verification steps
4. Report results

## Guidelines:
- Stay focused on the task
- Don't deviate from the plan without good reason
- If you encounter blockers, document them clearly
- Test your implementation before saying "done"
- Make atomic git commits for completed work

After completion, summarize what was done.`;

	// Show the prompt
	const editedPrompt = await ctx.ui.editor(
		`Task: ${taskName}\n\nExecution prompt (edit if needed):`,
		execPrompt
	);

	if (!editedPrompt?.trim()) {
		ctx.ui.notify("Execution cancelled.", "warning");
		return;
	}

	ctx.ui.notify(
		"🚀 Execution prompt ready.\n\n" +
		"Spawn an executor agent in pi:\n\n" +
		`pi -p "${editedPrompt.replace(/\n/g, " ").slice(0, 150)}..."\n\n` +
		"After completion, paste the summary and run:\n" +
		`/gsd:verify-work ${phase.number}`,
		"info"
	);

	// Save execution request
	const execPath = path.join(phaseDir, ".execution-request.md");
	fs.writeFileSync(execPath, editedPrompt, "utf-8");
}

async function executeSequentially(
	pi: ExtensionAPI,
	ctx: any,
	phase: any,
	phaseDir: string,
	planFiles: string[],
	context: string,
	planningDir: string
): Promise<void> {
	ctx.ui.notify(
		"📋 Sequential Execution\n\n" +
		`Running ${planFiles.length} plan(s) one at a time.\n\n` +
		"For each plan:\n" +
		"1. Spawn a fresh executor agent\n" +
		"2. Paste the summary here\n" +
		"3. Continue to next plan\n\n" +
		"Let's start with the first plan.",
		"info"
	);

	for (let i = 0; i < planFiles.length; i++) {
		const planFile = planFiles[i];
		const planPath = path.join(phaseDir, planFile);
		const planContent = fs.readFileSync(planPath, "utf-8");

		const nameMatch = planContent.match(/<name>([^<]+)<\/name>/);
		const taskName = nameMatch ? nameMatch[1] : planFile;

		const proceed = await ctx.ui.confirm(
			`Plan ${i + 1}/${planFiles.length}: ${taskName}\n\nReady to execute?`,
			"Yes, execute this plan"
		);

		if (!proceed) {
			ctx.ui.notify(`Skipping ${planFile}. Run it later with /gsd:execute-phase ${phase.number}`, "warning");
			break;
		}

		await executeSinglePlan(pi, ctx, phase, phaseDir, planFile, context, planningDir);

		// Ask for summary after each plan
		const summary = await ctx.ui.editor(
			`Paste the execution summary for ${planFile}:`,
			""
		);

		if (summary?.trim()) {
			// Append to SUMMARY.md
			const summaryPath = path.join(phaseDir, "SUMMARY.md");
			let existingSummary = "";
			if (fs.existsSync(summaryPath)) {
				existingSummary = fs.readFileSync(summaryPath, "utf-8");
			}
			
			const newEntry = `\n\n## ${planFile}\n\n${summary.trim()}\n\n---\n`;
			fs.writeFileSync(summaryPath, existingSummary + newEntry, "utf-8");
			phase.summaries.push(planFile.replace(".md", "-summary"));
		}

		// Ask if continuing
		if (i < planFiles.length - 1) {
			const cont = await ctx.ui.confirm(
				"Continue to next plan?",
				"Yes, continue"
			);
			if (!cont) {
				break;
			}
		}
	}
}