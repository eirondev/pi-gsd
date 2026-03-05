/**
 * /gsd:health command
 * 
 * Validate .planning/ directory integrity
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerHealthCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:health", {
		description: "Validate .planning/ directory integrity",
		handler: async (args, ctx) => {
			const shouldRepair = args.includes("--repair");
			const planningDir = findPlanningDir(ctx.cwd);

			if (!planningDir) {
				if (shouldRepair) {
					// Create .planning structure
					const newPlanningDir = path.join(ctx.cwd, ".planning");
					fs.mkdirSync(newPlanningDir, { recursive: true });

					const state = {
						projectName: path.basename(ctx.cwd),
						projectVersion: "0.0.0",
						currentPhase: 0,
						phaseStatus: "pending",
						phases: [],
						blockers: [],
						todos: [],
						nextActions: ["Run /gsd:new-project to initialize"],
					};

					writeState(newPlanningDir, state);

					// Create required files
					fs.writeFileSync(
						path.join(newPlanningDir, "PROJECT.md"),
						`# ${state.projectName}\n\n## Vision\n\n[Describe your project vision]\n\n## Tech Stack\n\n- \n`,
						"utf-8"
					);

					fs.mkdirSync(path.join(newPlanningDir, "phases"), { recursive: true });

					ctx.ui.notify(
						"✅ Created .planning/ structure.\n\nRun /gsd:new-project to initialize the project.",
						"success"
					);
					return;
				}

				ctx.ui.notify(
					"No GSD project found.\n\nRun /gsd:new-project to initialize, or use /gsd:health --repair to create structure.",
					"error"
				);
				return;
			}

			const issues: { severity: "error" | "warning"; message: string; fix?: () => void }[] = [];

			// Check required files
			const requiredFiles = ["STATE.md", "PROJECT.md"];
			for (const file of requiredFiles) {
				if (!fs.existsSync(path.join(planningDir, file))) {
					issues.push({
						severity: "error",
						message: `Missing ${file}`,
						fix: () => {
							if (file === "STATE.md") {
								writeState(planningDir, readState(planningDir) || {
									projectName: "Unknown",
									currentPhase: 0,
									phaseStatus: "pending",
									phases: [],
								});
							} else if (file === "PROJECT.md") {
								fs.writeFileSync(
									path.join(planningDir, "PROJECT.md"),
									"# Project\n\n[Update this with your project details]\n",
									"utf-8"
								);
							}
						},
					});
				}
			}

			// Check phases directory
			const phasesDir = path.join(planningDir, "phases");
			if (!fs.existsSync(phasesDir)) {
				issues.push({
					severity: "warning",
					message: "Missing phases/ directory",
					fix: () => fs.mkdirSync(phasesDir, { recursive: true }),
				});
			}

			// Check STATE.md validity
			const state = readState(planningDir);
			if (!state) {
				issues.push({
					severity: "error",
					message: "STATE.md is corrupted or invalid",
					fix: () => writeState(planningDir, {
						projectName: path.basename(ctx.cwd),
						currentPhase: 0,
						phaseStatus: "pending",
						phases: [],
						nextActions: ["State reset - run /gsd:new-project"],
					}),
				});
			} else {
				// Check phase consistency
				for (const phase of state.phases) {
					const phaseDir = path.join(
						phasesDir,
						`${String(phase.number).padStart(2, "0")}-${phase.name.replace(/\s+/g, "-")}`
					);

					if (!fs.existsSync(phaseDir) && fs.existsSync(phasesDir)) {
						issues.push({
							severity: "warning",
							message: `Phase ${phase.number} directory missing`,
							fix: () => fs.mkdirSync(phaseDir, { recursive: true }),
						});
					}
				}

				// Check for orphan phase directories
				if (fs.existsSync(phasesDir)) {
					const dirs = fs.readdirSync(phasesDir, { withFileTypes: true })
						.filter(d => d.isDirectory())
						.map(d => d.name);

					const validDirs = state.phases.map(
						p => `${String(p.number).padStart(2, "0")}-${p.name.replace(/\s+/g, "-")}`
					);

					for (const dir of dirs) {
						if (!validDirs.includes(dir)) {
							issues.push({
								severity: "warning",
								message: `Orphan phase directory: ${dir}`,
								// Don't auto-delete, might be manual work
							});
						}
					}
				}
			}

			// Display results
			if (issues.length === 0) {
				ctx.ui.notify("✅ All checks passed! Project is healthy.", "success");
				return;
			}

			const errorCount = issues.filter(i => i.severity === "error").length;
			const warningCount = issues.filter(i => i.severity === "warning").length;

			ctx.ui.notify(
				`⚠️ Health Check\n\n` +
				`Errors: ${errorCount}\n` +
				`Warnings: ${warningCount}\n\n` +
				issues.map(i => `${i.severity === "error" ? "❌" : "⚠️"} ${i.message}`).join("\n") +
				(shouldRepair ? "" : "\n\nRun /gsd:health --repair to fix."),
				errorCount > 0 ? "error" : "warning"
			);

			// Repair if requested
			if (shouldRepair) {
				for (const issue of issues) {
					if (issue.fix) {
						issue.fix();
					}
				}
				ctx.ui.notify("✅ Repaired all fixable issues.", "success");
			}
		},
	});
}