/**
 * /gsd:status command
 * 
 * Shows current GSD project status
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findPlanningDir, readState, type GsdState } from "../state.js";

export function registerStatusCommand(pi: ExtensionAPI): void {
  pi.registerCommand("gsd:status", {
    description: "Show current GSD project status",
    handler: async (_args, ctx) => {
      const planningDir = findPlanningDir(ctx.cwd);
      
      if (!planningDir) {
        ctx.ui.notify("No GSD project found. Run /gsd:new-project to initialize.", "warning");
        return;
      }
      
      const state = readState(planningDir);
      if (!state) {
        ctx.ui.notify("Found .planning/ but no STATE.md. Project may be corrupted.", "error");
        return;
      }
      
      // Build status message
      const lines: string[] = [
        `📋 **${state.projectName}**`,
        "",
        state.description,
        "",
        `**Current:** Phase ${state.currentPhase} (${state.phaseStatus})`,
        "",
      ];
      
      if (state.phases.length > 0) {
        lines.push("**Phases:**");
        for (const phase of state.phases) {
          const statusIcon = getStatusIcon(phase.status);
          lines.push(`  ${statusIcon} Phase ${phase.number}: ${phase.name}`);
        }
        lines.push("");
      }
      
      if (state.blockers.length > 0) {
        lines.push("**Blockers:**");
        for (const blocker of state.blockers) {
          lines.push(`  🚫 ${blocker}`);
        }
        lines.push("");
      }
      
      if (state.nextActions.length > 0) {
        lines.push("**Next Actions:**");
        for (const action of state.nextActions) {
          lines.push(`  → ${action}`);
        }
      }
      
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

function getStatusIcon(status: GsdState["phaseStatus"]): string {
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