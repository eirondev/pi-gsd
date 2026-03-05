/**
 * /gsd:new-project command
 * 
 * Initialize a new GSD project
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findPlanningDir, initPlanningDir, writeState, type GsdState } from "../state.js";

export function registerNewProjectCommand(pi: ExtensionAPI): void {
  pi.registerCommand("gsd:new-project", {
    description: "Initialize a new GSD project",
    handler: async (_args, ctx) => {
      // Check if already in a GSD project
      const existingPlanning = findPlanningDir(ctx.cwd);
      if (existingPlanning) {
        const existingState = readState(existingPlanning);
        if (existingState) {
          const overwrite = await ctx.ui.confirm(
            "GSD project exists",
            `Found "${existingState.projectName}". Overwrite?`,
          );
          if (!overwrite) {
            ctx.ui.notify("Keeping existing project.", "info");
            return;
          }
        }
      }
      
      // Get project name
      const projectName = await ctx.ui.editor("Project name:", "My Project");
      if (!projectName?.trim()) {
        ctx.ui.notify("Project name required. Cancelled.", "error");
        return;
      }
      
      // Get description
      const description = await ctx.ui.editor("Description (one line):", "");
      
      // Get phases
      const phasesInput = await ctx.ui.editor(
        "Phases (one per line, format: 'N: Phase Name'):",
        `1: Setup & Infrastructure\n2: Core Features\n3: Polish & Deploy`,
      );
      
      const phases: GsdState["phases"] = [];
      if (phasesInput) {
        for (const line of phasesInput.split("\n")) {
          const match = line.trim().match(/^(\d+):\s*(.+)$/);
          if (match) {
            phases.push({
              number: parseInt(match[1], 10),
              name: match[2].trim(),
              status: "pending",
              plans: [],
              summaries: [],
            });
          }
        }
      }
      
      // If no phases, create default
      if (phases.length === 0) {
        phases.push(
          { number: 1, name: "Phase 1", status: "pending", plans: [], summaries: [] },
          { number: 2, name: "Phase 2", status: "pending", plans: [], summaries: [] },
          { number: 3, name: "Phase 3", status: "pending", plans: [], summaries: [] },
        );
      }
      
      // Initialize
      const planningDir = initPlanningDir(ctx.cwd, projectName.trim(), description?.trim() || "");
      
      // Write state with phases
      const state: GsdState = {
        projectName: projectName.trim(),
        description: description?.trim() || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentPhase: 1,
        phaseStatus: "pending",
        phases,
        blockers: [],
        nextActions: ["Run /gsd:discuss-phase 1 to capture implementation decisions"],
      };
      writeState(planningDir, state);
      
      // Success message
      ctx.ui.notify(
        `✅ GSD project "${projectName.trim()}" initialized!\n\n` +
        `Created:\n` +
        `  - .planning/STATE.md\n` +
        `  - .planning/PROJECT.md\n` +
        `  - .planning/REQUIREMENTS.md\n` +
        `  - .planning/ROADMAP.md\n\n` +
        `Next: Run /gsd:discuss-phase 1 to start planning.`,
        "success",
      );
    },
  });
}

function readState(dir: string): GsdState | null {
  // Import at runtime to avoid circular dependency
  const { readState } = require("../state.js");
  return readState(dir);
}