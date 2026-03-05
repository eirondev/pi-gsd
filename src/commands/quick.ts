/**
 * /gsd:quick command
 * 
 * Execute ad-hoc task with GSD guarantees
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export function registerQuickCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:quick", {
		description: "Execute ad-hoc task with GSD guarantees (atomic commits, state tracking)",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);

			// Parse flags
			const fullMode = args.includes("--full");
			const discussMode = args.includes("--discuss");
			const taskDescription = args
				.replace(/--full|--discuss/g, "")
				.trim();

			// Get task description if not provided
			let description = taskDescription;
			if (!description) {
				description = await ctx.ui.editor(
					"What do you want to do?",
					""
				);
			}

			if (!description?.trim()) {
				ctx.ui.notify("Task description required.", "error");
				return;
			}

			// Create quick directory
			const baseQuickDir = planningDir
				? path.join(planningDir, "quick")
				: path.join(ctx.cwd, ".planning", "quick");

			fs.mkdirSync(baseQuickDir, { recursive: true });

			// Generate task ID
			const taskId = String(
				fs.readdirSync(baseQuickDir).length + 1
			).padStart(3, "0");
			const taskSlug = description.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.slice(0, 40);
			const taskDir = path.join(baseQuickDir, `${taskId}-${taskSlug}`);

			fs.mkdirSync(taskDir, { recursive: true });

			// If discuss mode, gather context first
			if (discussMode) {
				const context = await ctx.ui.editor(
					"Context for this task (what decisions/constraints):",
					`## Task\n\n${description}\n\n## Constraints\n\n- \n\n## Preferences\n\n- \n`
				);
				if (context) {
					fs.writeFileSync(path.join(taskDir, "CONTEXT.md"), context, "utf-8");
				}
			}

			// Create PLAN.md
			const plan = `# Quick Task: ${description.trim()}

**Created:** ${new Date().toISOString()}

## Description

${description.trim()}

## Plan

\`\`\`xml
<task type="auto">
  <name>${description.trim()}</name>
  <files>
    - (to be determined)
  </files>
  <action>
## Context
Quick task execution.

## Implementation Steps
1. Analyze requirements
2. Identify affected files
3. Implement changes
4. Verify functionality
  </action>
  <verify>
- [ ] Task completed as described
- [ ] No regressions introduced
- [ ] Code follows project conventions
  </verify>
  <done>
- Feature works as expected
- Tests pass (if applicable)
- Git commit ready
  </done>
</task>
\`\`\`

## Status

🔄 In Progress

## Notes

${fullMode ? "Full mode enabled: plan-checking and verification included." : "Quick mode: skips plan-checking and verification."}
`;

			fs.writeFileSync(path.join(taskDir, "PLAN.md"), plan, "utf-8");

			// If full mode, verify the plan
			if (fullMode && planningDir) {
				const state = readState(planningDir);
				if (state) {
					state.todos = state.todos || [];
					state.todos.push(`[QUICK] ${taskId}: ${description.trim()}`);
					writeState(planningDir, state);
				}

				ctx.ui.notify(
					`🔍 Full mode: Plan verification\n\n` +
					`Task saved to: ${taskDir}/PLAN.md\n\n` +
					`Verify the plan is correct before executing.`,
					"info"
				);

				const proceed = await ctx.ui.confirm(
					"Proceed with execution?",
					"Yes, execute task"
				);

				if (!proceed) {
					ctx.ui.notify("Cancelled. Edit PLAN.md and re-run.", "warning");
					return;
				}
			}

			// Execute the task (in a real implementation, this would spawn an agent)
			ctx.ui.notify(
				`🚀 Quick Task Ready\n\n` +
				`Task: ${description.trim()}\n` +
				`Directory: ${taskDir}\n\n` +
				`To execute:\n` +
				`1. Spawn an executor agent with:\n` +
				`   pi -p "Execute the task in ${taskDir}/PLAN.md"\n\n` +
				`2. After completion, run:\n` +
				`   /gsd:check-todos to mark complete`,
				"success"
			);
		},
	});
}