/**
 * /gsd:debug command
 * 
 * Systematic debugging with persistent state
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerDebugCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:debug", {
		description: "Systematic debugging with persistent state",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);
			if (!planningDir) {
				ctx.ui.notify("No GSD project found. Run /gsd:new-project first.", "error");
				return;
			}

			const description = args.trim() || await ctx.ui.editor(
				"What are you debugging?",
				""
			);

			if (!description?.trim()) {
				ctx.ui.notify("Debug description required.", "error");
				return;
			}

			// Create debug session
			const state = readState(planningDir);
			if (!state) {
				ctx.ui.notify("Project found but STATE.md is corrupted.", "error");
				return;
			}

			// Initialize debug sessions if needed
			state.debugSessions = state.debugSessions || [];

			const sessionId = `debug-${Date.now()}`;
			const session = {
				id: sessionId,
				description: description.trim(),
				hypotheses: [] as string[],
				tested: [] as { hypothesis: string; result: string }[],
				resolution: null as string | null,
				created: new Date().toISOString(),
			};

			state.debugSessions.push(session);

			// Hypothesis generation
			ctx.ui.notify(
				`🐛 Debug Session: ${sessionId}\n\n` +
				`Issue: ${description.trim()}\n\n` +
				`Let's approach this systematically.`,
				"info"
			);

			// Gather initial context
			const initialContext = await ctx.ui.editor(
				"Initial context (error messages, behavior, steps to reproduce):",
				`## Error Message\n\n\`\`\`\n\n\`\`\`\n\n## Steps to Reproduce\n\n1. \n\n## Expected Behavior\n\n\n\n## Actual Behavior\n\n`
			);

			if (initialContext) {
				session.hypotheses.push(`Initial context: ${initialContext.slice(0, 200)}...`);
			}

			// Ask for hypotheses
			let moreHypotheses = true;
			while (moreHypotheses) {
				const hypothesis = await ctx.ui.editor(
					"Hypothesis (what might be causing this):",
					""
				);

				if (hypothesis?.trim()) {
					session.hypotheses.push(hypothesis.trim());

					// Test the hypothesis
					const test = await ctx.ui.confirm(
						"Test this hypothesis?",
						"Yes, I'll test it"
					);

					if (test) {
						const result = await ctx.ui.select(
							"Test result:",
							[
								"✅ Hypothesis confirmed - this is the cause",
								"❌ Hypothesis ruled out - not the cause",
								"❓ Inconclusive - needs more investigation",
								"🔧 Fixed - the issue is resolved",
							]
						);

						if (result) {
							session.tested.push({
								hypothesis: hypothesis.trim(),
								result: result,
							});

							if (result.includes("Fixed")) {
								moreHypotheses = false;
								session.resolution = hypothesis.trim();

								const resolution = await ctx.ui.editor(
									"How was it fixed?",
									`## Solution\n\n${hypothesis.trim()}\n\n## Changes Made\n\n- \n\n## Prevention\n\n- `
								);

								if (resolution) {
									session.resolution = resolution;
								}
							}
						}
					}
				}

				if (moreHypotheses) {
					moreHypotheses = await ctx.ui.confirm(
						"Add another hypothesis?",
						"Yes, add more"
					);
				}
			}

			// Save debug session
			writeState(planningDir, state);

			// Create debug log file
			const debugDir = path.join(planningDir, "debug");
			fs.mkdirSync(debugDir, { recursive: true });

			const debugLog = `# Debug Session: ${sessionId}

**Issue:** ${description.trim()}
**Created:** ${session.created}
${session.resolution ? `**Resolution:** ✅ Resolved` : `**Status:** 🔍 Open`}

## Hypotheses

${session.hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}

## Tests Performed

${session.tested.map(t => `- **${t.hypothesis}**: ${t.result}`).join("\n") || "None yet"}

${session.resolution ? `## Resolution\n\n${session.resolution}` : ""}

---
${session.resolution ? "" : "Run /gsd:debug again to continue investigating."}
`;

			fs.writeFileSync(path.join(debugDir, `${sessionId}.md`), debugLog, "utf-8");

			ctx.ui.notify(
				session.resolution
					? `✅ Debug Session Resolved\n\nIssue: ${description.trim()}\nSolution saved to: ${sessionId}.md`
					: `🔍 Debug Session Saved\n\nSession: ${sessionId}\nHypotheses: ${session.hypotheses.length}\nTested: ${session.tested.length}\n\nContinue with /gsd:debug "${description.trim()}"`,
				session.resolution ? "success" : "info"
			);
		},
	});
}