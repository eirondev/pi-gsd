/**
 * GSD Spawn Tool
 * 
 * Spawns specialized sub-agents for GSD phases:
 * - researcher: Researches domain, stack, patterns
 * - planner: Creates atomic task plans
 * - executor: Executes plans with fresh context
 * - verifier: Verifies code against requirements
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const GsdSpawnParams = Type.Object({
  agent: Type.String({ 
    description: "Agent type: researcher, planner, executor, verifier",
    enum: ["researcher", "planner", "executor", "verifier"],
  }),
  task: Type.String({ description: "Task description for the agent" }),
  context: Type.Optional(Type.String({ description: "Additional context from STATE.md, PROJECT.md, etc." })),
  phase: Type.Optional(Type.Number({ description: "Phase number" })),
});

const AGENT_PROMPTS: Record<string, string> = {
  researcher: `You are a research agent for GSD (Get-Shit-Done).

Your job is to investigate and document everything needed to implement a feature.

## Your Tasks:
1. Read PROJECT.md to understand the overall vision
2. Read REQUIREMENTS.md to understand what's being built
3. Research the domain (frameworks, libraries, patterns)
4. Investigate potential pitfalls and gotchas
5. Document findings in RESEARCH.md

## Output Format:
Write a RESEARCH.md file with:
- Stack Analysis: What technologies to use and why
- Pattern Recommendations: Best practices for this type of feature
- Potential Pitfalls: Things to watch out for
- Implementation Notes: Key considerations
- Links/Resources: Helpful documentation links

Be thorough but concise. Focus on actionable insights.`,

  planner: `You are a planning agent for GSD (Get-Shit-Done).

Your job is to create atomic, verifiable task plans.

## Your Tasks:
1. Read PROJECT.md and REQUIREMENTS.md for context
2. Read CONTEXT.md for implementation decisions
3. Read RESEARCH.md for technical findings
4. Create detailed, atomic task plans

## Output Format:
For each plan, create a PLAN.md file with:
- Task name
- Files to create/modify
- Detailed implementation steps
- Verification steps (how to test)
- Dependencies on other tasks

Plans should be small enough to complete in a single executor run.
Each plan should be independently verifiable.

Use this XML format:
<task type="auto">
  <name>Task name</name>
  <files>list of files</files>
  <action>Detailed implementation steps</action>
  <verify>How to verify it works</verify>
  <done>What success looks like</done>
</task>`,

  executor: `You are an execution agent for GSD (Get-Shit-Done).

Your job is to implement tasks from PLAN.md files.

## Your Tasks:
1. Read the PLAN.md file
2. Implement each task exactly as specified
3. Verify your implementation works
4. Commit your changes atomically

## Guidelines:
- Stay focused on the task at hand
- Don't deviate from the plan without good reason
- If you encounter blockers, document them clearly
- Test your implementation before saying "done"
- Make atomic git commits for each completed task

## Output:
- Execute all tasks in the plan
- Report any issues encountered
- Create SUMMARY.md with what was done`,

  verifier: `You are a verification agent for GSD (Get-Shit-Done).

Your job is to verify that implemented features match requirements.

## Your Tasks:
1. Read REQUIREMENTS.md to understand what should be built
2. Read PLAN.md to understand what was planned
3. Read SUMMARY.md to understand what was implemented
4. Verify the codebase matches the requirements

## Verification Checklist:
- [ ] Do the files exist?
- [ ] Does the code compile/run?
- [ ] Do the tests pass?
- [ ] Does it match the requirements?
- [ ] Are edge cases handled?

## Output:
Create VERIFICATION.md with:
- Pass/Fail status for each requirement
- Issues found (if any)
- Recommendations for fixes
- Sign-off decision (ready/not ready)`,
};

export function registerGsdTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "gsd_spawn",
    label: "GSD Spawn",
    description: "Spawn a specialized GSD sub-agent (researcher, planner, executor, verifier)",
    parameters: GsdSpawnParams,

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const agentPrompt = AGENT_PROMPTS[params.agent];
      if (!agentPrompt) {
        return {
          content: [{ type: "text" as const, text: `Unknown agent type: ${params.agent}. Use: researcher, planner, executor, verifier.` }],
          isError: true,
          details: { agent: params.agent, error: "unknown_agent_type" },
        };
      }

      // Build the prompt for the sub-agent
      let fullPrompt = agentPrompt;
      
      if (params.phase !== undefined) {
        fullPrompt += `\n\n## Phase ${params.phase}`;
      }
      
      if (params.context) {
        fullPrompt += `\n\n## Context:\n${params.context}`;
      }
      
      fullPrompt += `\n\n## Task:\n${params.task}`;

      // Note: This is a stub. The real implementation would:
      // 1. Spawn a separate pi process with this prompt
      // 2. Use --append-system-prompt to inject the agent instructions
      // 3. Capture structured output
      // 4. Update STATE.md and phase files
      
      // For now, return instructions for manual use
      return {
        content: [{
          type: "text" as const,
          text: `GSD Agent: ${params.agent}\n\nThis agent would run with the following context:\n\n${fullPrompt}\n\n---\n\nNote: Sub-agent spawning not yet implemented. The agent prompt above shows what the ${params.agent} agent would receive. Use this to guide your work manually.`,
        }],
        details: { 
          agent: params.agent, 
          phase: params.phase,
          hasContext: !!params.context,
          taskLength: params.task.length,
        },
      };
    },

    renderCall(args, theme) {
      const agent = args.agent || "unknown";
      const phase = args.phase !== undefined ? ` phase ${args.phase}` : "";
      const taskPreview = args.task ? (args.task.length > 50 ? `${args.task.slice(0, 50)}...` : args.task) : "";
      
      // Return undefined to use default rendering
      return undefined;
    },

    renderResult(result, opts, theme) {
      // Return undefined to use default rendering
      return undefined;
    },
  });
}