/**
 * /gsd:complete-milestone command
 * 
 * Archive completed milestone, tag release, prepare for next
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
	type GsdState,
} from "../state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";

export function registerCompleteMilestoneCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:complete-milestone", {
		description: "Archive milestone, tag release, and prepare for next",
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

			// Check all phases are complete
			const incompletePhases = state.phases.filter(p => p.status !== "completed");
			if (incompletePhases.length > 0) {
				ctx.ui.notify(
					`Cannot complete milestone. Incomplete phases:\n` +
					incompletePhases.map(p => `  - Phase ${p.number}: ${p.name} (${p.status})`).join("\n"),
					"error"
				);
				return;
			}

			// Generate version tag
			const currentVersion = state.projectVersion || "0.0.0";
			const [major, minor, patch] = currentVersion.split(".").map(Number);
			const versionType = await ctx.ui.select(
				`Current version: ${currentVersion}\n\nSelect version bump:`,
				[
					`Patch (${major}.${minor}.${patch + 1}) - Bug fixes, minor updates`,
					`Minor (${major}.${minor + 1}.0) - New features, backward compatible`,
					`Major (${major + 1}.0.0) - Breaking changes`,
				]
			);

			if (!versionType) {
				ctx.ui.notify("Milestone completion cancelled.", "warning");
				return;
			}

			let newVersion: string;
			if (versionType.includes("Patch")) {
				newVersion = `${major}.${minor}.${patch + 1}`;
			} else if (versionType.includes("Minor")) {
				newVersion = `${major}.${minor + 1}.0`;
			} else {
				newVersion = `${major + 1}.0.0`;
			}

			// Ask about release notes
			const releaseNotes = await ctx.ui.editor(
				"Release notes (optional):",
				`## ${state.milestone || `v${newVersion}`}\n\n- [Feature or fix]\n- [Feature or fix]\n\n### Changes\n\n- [Details]\n`
			);

			// Create archive directory
			const archiveDir = path.join(planningDir, "archive");
			if (!fs.existsSync(archiveDir)) {
				fs.mkdirSync(archiveDir, { recursive: true });
			}

			// Archive milestone name
			const milestoneSlug = (state.milestone || `v${newVersion}`).toLowerCase().replace(/\s+/g, "-");
			const milestoneArchiveDir = path.join(archiveDir, `${newVersion}-${milestoneSlug}`);

			// Archive phases directory
			const phasesDir = path.join(planningDir, "phases");
			if (fs.existsSync(phasesDir)) {
				fs.renameSync(phasesDir, path.join(milestoneArchiveDir, "phases"));
			}

			// Archive milestone files
			const filesToArchive = ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md"];
			for (const file of filesToArchive) {
				const filePath = path.join(planningDir, file);
				if (fs.existsSync(filePath)) {
					fs.copyFileSync(filePath, path.join(milestoneArchiveDir, file));
				}
			}

			// Save release notes
			if (releaseNotes?.trim()) {
				fs.writeFileSync(path.join(milestoneArchiveDir, "RELEASE-NOTES.md"), releaseNotes.trim(), "utf-8");
			}

			// Create git tag
			const createTag = await ctx.ui.confirm(
				"Create git tag for this release?",
				"Yes, create tag"
			);

			if (createTag) {
				try {
					const tagName = `v${newVersion}`;
					const tagMessage = state.milestone || `Release ${newVersion}`;
					
					child_process.execSync(`git tag -a ${tagName} -m "${tagMessage}"`, {
						cwd: ctx.cwd,
						stdio: "pipe"
					});
					
					ctx.ui.notify(`✅ Git tag created: ${tagName}`, "info");
				} catch (error) {
					ctx.ui.notify(`Failed to create git tag: ${error}`, "warning");
				}
			}

			// Update STATE.md for new milestone
			state.projectVersion = newVersion;
			state.milestone = null;
			state.currentPhase = 0;
			state.phaseStatus = "pending";
			state.phases = [];
			state.blockers = [];
			state.todos = state.todos || [];
			state.nextActions = [
				`Milestone v${currentVersion} archived to archive/${newVersion}-${milestoneSlug}/`,
				`Run /gsd:new-milestone to start version ${newVersion}`,
			];

			writeState(planningDir, state);

			ctx.ui.notify(
				`🎉 Milestone Complete!\n\n` +
				`Version: ${currentVersion} → ${newVersion}\n` +
				`Archived to: archive/${newVersion}-${milestoneSlug}/\n\n` +
				`Next: Run /gsd:new-milestone to start version ${newVersion}`,
				"info"
			);
		},
	});
}