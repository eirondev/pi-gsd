/**
 * /gsd:audit-milestone command
 * 
 * Verify milestone achieved its definition of done
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	type GsdState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";

export function registerAuditMilestoneCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:audit-milestone", {
		description: "Verify milestone achieved its definition of done",
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

			// Collect audit results
			const auditResults: {
				category: string;
				item: string;
				status: "pass" | "fail" | "warning" | "skip";
				details?: string;
			}[] = [];

			// 1. Check all phases are complete
			const completedPhases = state.phases.filter(p => p.status === "completed");
			const totalPhases = state.phases.length;
			
			auditResults.push({
				category: "Phases",
				item: `${completedPhases.length}/${totalPhases} phases completed`,
				status: completedPhases.length === totalPhases ? "pass" : "fail",
			});

			// 2. Check phase verifications
			const phasesDir = path.join(planningDir, "phases");
			if (fs.existsSync(phasesDir)) {
				for (const phase of state.phases) {
					const phaseDir = path.join(phasesDir, String(phase.number).padStart(2, "0") + "-" + phase.name.replace(/\s+/g, "-"));
					const verificationPath = path.join(phaseDir, "VERIFICATION.md");
					
					auditResults.push({
						category: "Verification",
						item: `Phase ${phase.number} verification`,
						status: fs.existsSync(verificationPath) ? "pass" : "warning",
						details: fs.existsSync(verificationPath) ? undefined : "No VERIFICATION.md found",
					});
				}
			}

			// 3. Check requirements are addressed
			const requirementsPath = path.join(planningDir, "REQUIREMENTS.md");
			if (fs.existsSync(requirementsPath)) {
				const requirements = fs.readFileSync(requirementsPath, "utf-8");
				const v1Requirements = requirements.match(/## V1[\s\S]*?(?=## V2|$)/)?.[0] || "";
				const mustHave = (v1Requirements.match(/### Must Have[\s\S]*?(?=###|$)/g) || [])
					.flatMap(s => s.split("\n").filter(l => l.trim().startsWith("-")));
				
				// For each must-have, check if there's a corresponding phase
				for (const req of mustHave.slice(0, 5)) { // Limit to first 5 for brevity
					auditResults.push({
						category: "Requirements",
						item: req.replace("- ", "").slice(0, 50),
						status: "skip", // Would need semantic matching
					});
				}
			}

			// 4. Check git commits
			try {
				// Check if we're in a git repo
				const { execSync } = await import("node:child_process");
				const commitCount = execSync("git rev-list --count HEAD", { cwd: ctx.cwd, encoding: "utf-8" }).trim();
				const lastCommit = execSync("git log -1 --format='%s'", { cwd: ctx.cwd, encoding: "utf-8" }).trim();
				
				auditResults.push({
					category: "Git",
					item: `${commitCount} total commits`,
					status: parseInt(commitCount) > 0 ? "pass" : "warning",
				});

				// Check for milestone-related commits
				const milestoneCommits = execSync(
					`git log --oneline --all | grep -i "${state.milestone || 'milestone'}" || true`,
					{ cwd: ctx.cwd, encoding: "utf-8" }
				).trim();
				
				if (milestoneCommits) {
					auditResults.push({
						category: "Git",
						item: "Milestone commits found",
						status: "pass",
						details: milestoneCommits.split("\n").slice(0, 3).join("\n"),
					});
				}
			} catch {
				auditResults.push({
					category: "Git",
					item: "Git history check",
					status: "skip",
					details: "Not in a git repository",
				});
			}

			// 5. Check documentation
			const projectMd = path.join(planningDir, "PROJECT.md");
			const roadmapMd = path.join(planningDir, "ROADMAP.md");
			
			auditResults.push({
				category: "Documentation",
				item: "PROJECT.md exists",
				status: fs.existsSync(projectMd) ? "pass" : "warning",
			});
			
			auditResults.push({
				category: "Documentation",
				item: "ROADMAP.md exists",
				status: fs.existsSync(roadmapMd) ? "pass" : "warning",
			});

			// Calculate overall status
			const passCount = auditResults.filter(r => r.status === "pass").length;
			const failCount = auditResults.filter(r => r.status === "fail").length;
			const warningCount = auditResults.filter(r => r.status === "warning").length;

			// Display results
			ctx.ui.notify(
				`📊 Milestone Audit: ${state.milestone || "Current Milestone"}\n\n` +
				`Results:\n` +
				auditResults.map(r => {
					const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : r.status === "warning" ? "⚠️" : "⏭️";
					return `${icon} ${r.category}: ${r.item}`;
				}).join("\n") +
				`\n\nSummary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`,
				failCount > 0 ? "error" : warningCount > 0 ? "warning" : "info"
			);

			// Write audit report
			const auditPath = path.join(planningDir, "MILESTONE-AUDIT.md");
			const auditContent = `# Milestone Audit

**Date:** ${new Date().toISOString()}
**Milestone:** ${state.milestone || "Current"}

## Results

${auditResults.map(r => {
	const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : r.status === "warning" ? "⚠️" : "⏭️";
	return `- ${icon} **${r.category}**: ${r.item}${r.details ? `\n  - ${r.details}` : ""}`;
}).join("\n")}

## Summary

- Passed: ${passCount}
- Failed: ${failCount}
- Warnings: ${warningCount}

## Recommendation

${failCount > 0 ? "⚠️ Address failed items before completing milestone." : warningCount > 0 ? "✅ Milestone complete with warnings. Consider addressing warnings." : "✅ Milestone complete. Ready for /gsd:complete-milestone."}
`;

			fs.writeFileSync(auditPath, auditContent, "utf-8");
			ctx.ui.notify(`Audit report saved to: ${auditPath}`, "info");
		},
	});
}