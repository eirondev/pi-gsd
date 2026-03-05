/**
 * /gsd:plan-phase command
 * 
 * Research and create plans for a phase
 * Uses sub-agent for research, then creates PLAN.md files
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	getPhaseDir,
	createPhaseDir,
	type GsdState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerPlanPhaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:plan-phase", {
		description: "Research and create plans for a phase",
		handler: async (args, ctx) => {
			const phaseNum = parseInt(args.trim(), 10);
			if (isNaN(phaseNum) || phaseNum < 1) {
				ctx.ui.notify("Usage: /gsd:plan-phase <phase-number>", "warning");
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
			let phase = state.phases.find((p) => p.number === phaseNum);
			if (!phase) {
				ctx.ui.notify(
					`Phase ${phaseNum} not found. Run /gsd:discuss-phase ${phaseNum} first.`,
					"error"
				);
				return;
			}

			// Update status
			phase.status = "planning";
			state.currentPhase = phaseNum;
			state.phaseStatus = "planning";
			writeState(planningDir, state);

			// Ensure phase directory exists
			let phaseDir = getPhaseDir(planningDir, phaseNum);
			if (!phaseDir) {
				phaseDir = createPhaseDir(planningDir, phaseNum, phase.name);
			}

			// Check for CONTEXT.md
			const contextPath = path.join(phaseDir, "CONTEXT.md");
			let context = "";
			if (fs.existsSync(contextPath)) {
				context = fs.readFileSync(contextPath, "utf-8");
			}

			// Check for existing RESEARCH.md
			const researchPath = path.join(phaseDir, "RESEARCH.md");
			let existingResearch = "";
			if (fs.existsSync(researchPath)) {
				existingResearch = fs.readFileSync(researchPath, "utf-8");
			}

			// Ask if they want to research first
			const choice = await ctx.ui.select(
				`Phase ${phaseNum}: ${phase.name}\n\nHow would you like to proceed?`,
				[
					"Research first (spawn sub-agent)",
					"Manual planning",
					"Load existing plans",
				]
			);

			if (choice === "Research first (spawn sub-agent)") {
				await runResearchPhase(pi, ctx, phase, phaseDir, context, existingResearch, planningDir);
			} else if (choice === "Manual planning") {
				await manualPlanning(ctx, phase, phaseDir);
			} else if (choice === "Load existing plans") {
				await loadExistingPlans(ctx, phase, phaseDir);
			}

			// Update state
			state.nextActions = [
				`Review plans in .planning/phases/${String(phaseNum).padStart(2, "0")}-${phase.name.replace(/\s+/g, "-")}/`,
				`Run /gsd:execute-phase ${phaseNum} when ready`,
			];
			writeState(planningDir, state);
		},
	});
}

async function runResearchPhase(
	pi: ExtensionAPI,
	ctx: any,
	phase: any,
	phaseDir: string,
	context: string,
	existingResearch: string,
	planningDir: string
): Promise<void> {
	// Build research prompt
	const researchPrompt = `You are a research agent for GSD (Get-Shit-Done).

Your job is to research and document everything needed to implement Phase ${phase.number}: ${phase.name}.

## Your Tasks:
1. Read PROJECT.md and REQUIREMENTS.md for context (if they exist in .planning/)
2. Research the domain (technologies, libraries, patterns)
3. Identify potential implementation approaches
4. Document findings in RESEARCH.md

## Output Format:
Write a RESEARCH.md file with:
- Stack Analysis: What technologies to consider
- Approach Comparison: Pros/cons of different approaches
- Implementation Notes: Key considerations and gotchas
- Recommended Approach: Your recommendation
- References: Links to documentation

Be thorough but focus on actionable insights.`;

	// Show research prompt for editing
	const editedPrompt = await ctx.ui.editor(
		"Research prompt (edit if needed):",
		researchPrompt
	);

	if (!editedPrompt?.trim()) {
		ctx.ui.notify("Research cancelled.", "warning");
		return;
	}

	ctx.ui.notify(
		"🔬 Research prompt ready.\n\n" +
		"The sub-agent will research and create RESEARCH.md.\n" +
		"After research: create plans manually with /gsd:plan-phase (Manual planning)",
		"info"
	);

	// Note: Actual sub-agent spawning would use pi.spawnAgent() or similar
	// For now, we save the prompt and let the user run it manually
	const researchRequestPath = path.join(phaseDir, ".research-request.md");
	fs.writeFileSync(researchRequestPath, editedPrompt.trim(), "utf-8");

	ctx.ui.notify(
		`✅ Research request saved to: ${researchRequestPath}\n\n` +
		`Run the research agent in pi:\n` +
		`pi -p "${editedPrompt.replace(/\n/g, " ").slice(0, 100)}..."\n\n` +
		`Then paste the results and run /gsd:plan-phase again with "Manual planning"`,
		"info"
	);
}

async function manualPlanning(ctx: any, phase: any, phaseDir: string): Promise<void> {
	// Check for research
	const researchPath = path.join(phaseDir, "RESEARCH.md");
	let research = "";
	if (fs.existsSync(researchPath)) {
		research = fs.readFileSync(researchPath, "utf-8");
	}

	// Prompt for plan creation
	const planCount = await ctx.ui.select(
		"How many task plans do you want to create?",
		["1 plan", "2 plans", "3 plans", "4 plans", "5 plans"]
	);

	if (!planCount) {
		ctx.ui.notify("Planning cancelled.", "warning");
		return;
	}

	const numPlans = parseInt(planCount, 10);

	for (let i = 1; i <= numPlans; i++) {
		const planContent = await ctx.ui.editor(
			`Plan ${i} of ${numPlans}\n\nDescribe the atomic task:`,
			`<task type="auto">
  <name>Task ${i}: [Task Name]</name>
  <files>
    - src/path/to/file.ts
    - tests/path/to/file.test.ts
  </files>
  <action>
## Context
[Brief context for this task]

## Implementation Steps
1. [Step 1]
2. [Step 2]

## Dependencies
- None (or list dependencies)
  </action>
  <verify>
- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] Manual test: [description]
  </verify>
  <done>
- Feature works as expected
- Tests are passing
- No regressions
  </done>
</task>
`
		);

		if (planContent?.trim()) {
			const planFile = `${String(i).padStart(2, "0")}-task.md`;
			fs.writeFileSync(path.join(phaseDir, planFile), planContent.trim(), "utf-8");
			phase.plans.push(planFile);
		}
	}

	ctx.ui.notify(
		`✅ Created ${phase.plans.length} plan(s) for Phase ${phase.number}\n\n` +
		`Files: ${phase.plans.join(", ")}\n\n` +
		`Next: Run /gsd:execute-phase ${phase.number} when ready`,
		"info"
	);
}

async function loadExistingPlans(ctx: any, phase: any, phaseDir: string): Promise<void> {
	// Find all plan files
	const files = fs.readdirSync(phaseDir);
	const planFiles = files.filter(f => f.match(/^\d+-.*\.md$/) && !f.includes("CONTEXT") && !f.includes("RESEARCH") && !f.includes("SUMMARY"));

	if (planFiles.length === 0) {
		ctx.ui.notify("No existing plans found. Use Manual planning instead.", "warning");
		return;
	}

	// Load plans into phase
	phase.plans = planFiles;
	phase.status = "planning";

	ctx.ui.notify(
		`✅ Loaded ${planFiles.length} plan(s):\n` +
		planFiles.map(p => `  - ${p}`).join("\n") +
		`\n\nNext: Run /gsd:execute-phase ${phase.number} when ready`,
		"info"
	);
}