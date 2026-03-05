/**
 * /gsd:help command
 * 
 * Show all commands and usage guide
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const helpText = `# GSD: Get-Shit-Done for Pi-Agent

Spec-driven development with context engineering.

## Core Workflow

| Command | Description |
|---------|-------------|
| /gsd:new-project | Initialize project: questions → research → requirements → roadmap |
| /gsd:discuss-phase [N] | Capture implementation decisions before planning |
| /gsd:plan-phase [N] | Research + plan + verify for a phase |
| /gsd:execute-phase <N> | Execute all plans in parallel waves |
| /gsd:verify-work [N] | Manual user acceptance testing |
| /gsd:complete-milestone | Archive milestone, tag release |
| /gsd:new-milestone [name] | Start next version |

## Milestone Management

| Command | Description |
|---------|-------------|
| /gsd:audit-milestone | Verify milestone achieved DoD |
| /gsd:gap-gaps | Create phases to close audit gaps |

## Phase Management

| Command | Description |
|---------|-------------|
| /gsd:add-phase | Append phase to roadmap |
| /gsd:insert-phase [N] | Insert urgent work between phases |
| /gsd:remove-phase [N] | Remove phase, renumber subsequent |
| /gsd:list-assumptions [N] | See Claude's intended approach |

## Session Management

| Command | Description |
|---------|-------------|
| /gsd:pause-work | Create handoff when stopping |
| /gsd:resume-work | Restore from last session |

## Brownfield Support

| Command | Description |
|---------|-------------|
| /gsd:map-codebase | Analyze existing codebase |

## Utilities

| Command | Description |
|---------|-------------|
| /gsd:quick [--full] | Execute ad-hoc task with GSD guarantees |
| /gsd:debug [desc] | Systematic debugging with state |
| /gsd:add-todo [desc] | Capture idea for later |
| /gsd:check-todos | List pending todos |
| /gsd:health [--repair] | Validate .planning/ integrity |
| /gsd:settings | Configure model profile and workflow |
| /gsd:set-profile <profile> | Switch model (quality/balanced/budget) |
| /gsd:progress | Show current status and next steps |

## Workflow

1. **Initialize**: /gsd:new-project → Creates PROJECT.md, REQUIREMENTS.md, ROADMAP.md
2. **Per Phase**:
   - /gsd:discuss-phase 1 → Capture context (CONTEXT.md)
   - /gsd:plan-phase 1 → Research & create plans
   - /gsd:execute-phase 1 → Execute plans
   - /gsd:verify-work 1 → Verify deliverables
3. **Complete**: /gsd:complete-milestone → Archive, tag, start next

## Quick Mode

For ad-hoc tasks that don't need full planning:

/gsd:quick "Add dark mode toggle"

## Configuration

Files in .planning/:
- STATE.md: Current position, blockers, next actions
- PROJECT.md: Vision, tech stack, key decisions
- REQUIREMENTS.md: V1/V2 scoped requirements
- ROADMAP.md: Phases and milestones
- config.json: Model profile, workflow settings

## More Info

- GitHub: https://github.com/eirondev/pi-gsd
- Based on: https://github.com/gsd-build/get-shit-done`;

export function registerHelpCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:help", {
		description: "Show all commands and usage guide",
		handler: async (args, ctx) => {
			ctx.ui.notify(helpText, "info");
		},
	});
}