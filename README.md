# Pi-GSD: Get-Shit-Done for Pi-Agent

Spec-driven development with context engineering, built as a pi-agent extension.

## What is GSD?

**Get-Shit-Done (GSD)** is a meta-prompting, context engineering, and spec-driven development system that solves "context rot" — the quality degradation that happens as AI fills its context window.

GSD provides:
- **Context Engineering**: Structured files that persist across sessions
- **Phase Workflow**: discuss → plan → execute → verify
- **Fresh Execution**: Sub-agents with clean context for each task
- **State Persistence**: Track where you are in the project

## Installation

```bash
# From npm (when published)
pi install npm:@embeddediron/pi-gsd

# From local directory
pi install ./path/to/pi-gsd
```

Or copy to `~/.pi/agent/extensions/pi-gsd/` for global access.

## Commands

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize a new GSD project in current directory |
| `/gsd:status` | Show current project status and blockers |
| `/gsd:progress` | Show workflow position and next steps |
| `/gsd:discuss-phase <N>` | Capture implementation decisions for phase N |
| `/gsd:plan-phase <N>` | Research and create plans for phase N |
| `/gsd:execute-phase <N>` | Execute phase N plans (sequential or parallel) |
| `/gsd:verify-work <N>` | Manual verification checklist for phase N |

## Workflow

```
/gsd:new-project
    ↓
/gsd:discuss-phase 1    ← Capture decisions (CONTEXT.md)
    ↓
/gsd:plan-phase 1       ← Research + create plans (PLAN.md files)
    ↓
/gsd:execute-phase 1    ← Execute plans with sub-agents
    ↓
/gsd:verify-work 1      ← Manual verification checklist
    ↓
(goto next phase)
```

## Project Structure

```
your-project/
├── .planning/
│   ├── STATE.md           # Current position, blockers, next actions
│   ├── PROJECT.md         # Vision and key decisions
│   ├── REQUIREMENTS.md    # V1/V2 requirements
│   ├── ROADMAP.md         # Phases and milestones
│   └── phases/
│       ├── 01-setup/
│       │   ├── CONTEXT.md    # Implementation decisions
│       │   ├── RESEARCH.md   # Research findings
│       │   ├── 01-task.md    # Plan files
│       │   ├── 02-task.md
│       │   ├── SUMMARY.md    # What was done
│       │   └── VERIFICATION.md
│       └── 02-features/
└── src/
    └── ...
```

## Key Files

### STATE.md
Tracks current state:
```yaml
project: MyProject
current_phase: 2
phase_status: planning
phases:
  - number: 1
    name: Setup
    status: completed
  - number: 2
    name: Features
    status: planning
blockers: []
next_actions:
  - Run /gsd:plan-phase 2
```

### CONTEXT.md (per phase)
Implementation decisions, preferences, trade-offs.

### PLAN.md (per task)
Atomic task with XML structure:
```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>
    - src/api/auth/login.ts
    - tests/api/auth.test.ts
  </files>
  <action>
## Context
Brief context for this task.

## Implementation Steps
1. Create route handler
2. Add validation
3. Write tests
  </action>
  <verify>
- [ ] Tests pass
- [ ] TypeScript compiles
- [ ] Manual test works
  </verify>
  <done>
- Feature works as expected
- Tests passing
- Code reviewed
  </done>
</task>
```

## Sub-Agent Spawning

GSD supports spawning specialized agents:

| Agent | Purpose |
|-------|---------|
| **researcher** | Research domain, stack, patterns |
| **planner** | Create atomic task plans |
| **executor** | Execute plans with fresh context |
| **verifier** | Verify code against requirements |

Use `/gsd:plan-phase` and `/gsd:execute-phase` to trigger these agents.

## Why GSD?

Traditional AI coding suffers from:
- Context buildup → degrading quality
- No project memory → repeated mistakes
- Large tasks → abandoned work
- No verification → untested code

GSD fixes this with:
- Structured files → persistent context
- Phase workflow → manageable chunks
- Fresh executors → consistent quality
- Verification step → tested deliverables

## Comparison with Original GSD

| Feature | Original GSD | Pi-GSD |
|---------|--------------|--------|
| Platform | Claude Code | pi-agent |
| Commands | /new-project, etc. | /gsd:new-project, etc. |
| Sub-agents | Claude sub-tasks | pi sub-agents |
| Context files | .gsd/CLAUDE.md | .planning/STATE.md |
| State persistence | CLAUDE.md + session | STATE.md + entries |

## Credits

Based on [get-shit-done](https://github.com/gsd-build/get-shit-done) by TÂCHES.

Adapted for pi-agent by Embedded Iron.

## License

MIT