/**
 * /gsd:progress command
 * 
 * Shows workflow progress and next steps
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findPlanningDir, readState } from "../state.js";

export function registerProgressCommand(pi: ExtensionAPI): void {
  pi.registerCommand("gsd:progress", {
    description: "Show GSD workflow progress and next steps",
    handler: async (_args, ctx) => {
      const planningDir = findPlanningDir(ctx.cwd);
      
      if (!planningDir) {
        const helpText = [
          "## GSD Workflow",
          "",
          "1. **Initialize**: `/gsd:new-project`",
          "2. **Discuss**: `/gsd:discuss-phase N` - Capture decisions",
          "3. **Plan**: `/gsd:plan-phase N` - Research and create plans",
          "4. **Execute**: `/gsd:execute-phase N` - Run plans",
          "5. **Verify**: `/gsd:verify-work N` - Manual verification",
          "",
          "Start with `/gsd:new-project` to initialize.",
        ].join("\n");
        ctx.ui.notify(helpText, "info");
        return;
      }
      
      const state = readState(planningDir);
      if (!state) {
        ctx.ui.notify("Project found but STATE.md is corrupted.", "error");
        return;
      }
      
      // Show current phase and workflow position
      const currentPhase = state.phases.find(p => p.number === state.currentPhase);
      const phaseName = currentPhase?.name || `Phase ${state.currentPhase}`;
      
      const workflowStep = getWorkflowStep(state.phaseStatus);
      
      const lines: string[] = [
        `## ${state.projectName}`,
        "",
        `**Current:** ${phaseName}`,
        `**Status:** ${state.phaseStatus}`,
        `**Step:** ${workflowStep}`,
        "",
        "**Phases:**",
      ];
      
      for (const phase of state.phases) {
        const current = phase.number === state.currentPhase;
        const icon = current ? "→" : " ";
        const statusIcon = getStatusIcon(phase.status);
        lines.push(`${icon} ${statusIcon} Phase ${phase.number}: ${phase.name}`);
      }
      
      lines.push("");
      lines.push("**Next:");
      for (const action of state.nextActions.slice(0, 3)) {
        lines.push(`  - ${action}`);
      }
      
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

function getWorkflowStep(status: string): string {
  switch (status) {
    case "pending": return "1/5 - Ready to discuss";
    case "discussing": return "2/5 - Capture decisions";
    case "planning": return "3/5 - Research and plan";
    case "executing": return "4/5 - Execute plans";
    case "verifying": return "5/5 - Manual verification";
    case "completed": return "✓ Done";
    default: return "?";
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "pending": return "⏳";
    case "discussing": return "💬";
    case "planning": return "📝";
    case "executing": return "🔧";
    case "verifying": return "✅";
    case "completed": return "✓";
    default: return "○";
  }
}