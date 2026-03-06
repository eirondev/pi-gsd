# Pi-GSD: Get-Shit-Done for Pi-Agent

> ⚠️ **UNTESTED - ALPHA RELEASE**  
> This extension has been implemented but not fully tested end-to-end. Use with caution in production environments. Report issues to help us improve!

Spec-driven development with context engineering, built as a pi-agent extension.

**Based on:** [get-shit-done](https://github.com/gsd-build/get-shit-done) by TÂCHES

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
pi install npm:@eirondev/pi-gsd

# From GitHub
pi install https://github.com/eirondev/pi-gsd

# Local development
git clone https://github.com/eirondev/pi-gsd.git
cd pi-gsd
npm install && npm run build
pi install ./path/to/pi-gsd
```

## All Available Commands (27 Total)

### Core Workflow (7 commands)

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize: questions → research → requirements → roadmap |
| `/gsd:discuss-phase <N>` | Capture implementation decisions in CONTEXT.md |
| `/gsd:plan-phase <N>` | Research + create task plans |
| `/gsd:execute-phase <N>` | Execute plans in parallel waves with sub-agents |
| `/gsd:verify-work <N>` | Manual verification checklist |
| `/gsd:status` | Show project status |
| `/gsd:progress` | Show workflow position |

### Milestone Management (4 commands)

| Command | Description |
|---------|-------------|
| `/gsd:complete-milestone` | Archive milestone, tag release |
| `/gsd:new-milestone [name]` | Start next version |
| `/gsd:audit-milestone` | Verify milestone achieved DoD |
| `/gsd:plan-milestone-gaps` | Create phases to close audit gaps |

### Phase Management (4 commands)

| Command | Description |
|---------|-------------|
| `/gsd:add-phase` | Append phase to roadmap |
| `/gsd:insert-phase <N>` | Insert urgent work between phases |
| `/gsd:remove-phase <N>` | Remove phase, renumber roadmap |
| `/gsd:list-phase-assumptions [N]` | Show planned approach |

### Session Management (2 commands)

| Command | Description |
|---------|-------------|
| `/gsd:pause-work` | Create handoff for next session |
| `/gsd:resume-work` | Restore from handoff state |

### Brownfield (1 command)

| Command | Description |
|---------|-------------|
| `/gsd:map-codebase` | Analyze existing codebase structure |

### Utilities (10 commands)

| Command | Description |
|---------|-------------|
| `/gsd:quick [--full] [--discuss]` | Ad-hoc task with GSD guarantees |
| `/gsd:debug [desc]` | Systematic debugging with state tracking |
| `/gsd:add-todo [desc]` | Capture idea for later |
| `/gsd:check-todos` | List pending todos |
| `/gsd:health [--repair]` | Validate .planning/ integrity |
| `/gsd:settings` | Configure model profile & workflow |
| `/gsd:set-profile <profile>` | Switch: quality/balanced/budget |
| `/gsd:help` | Show all commands |
| `/gsd:update` | Update pi-gsd |
| `/gsd:join-discord` | Join community Discord |

## Workflow

```
/gsd:new-project
    ↓
/gsd:discuss-phase 1 ← Capture decisions (CONTEXT.md)
    ↓
/gsd:plan-phase 1    ← Research + create plans
    ↓
/gsd:execute-phase 1 ← Execute with sub-agents
    ↓
/gsd:verify-work 1   ← Manual verification
    ↓
/gsd:complete-milestone ← Archive, tag, next
    ↓
/gsd:new-milestone      ← Start next version
```

## Quick Mode

For ad-hoc tasks without full GSD overhead:

```bash
# Simple quick task
/gsd:quick "Add dark mode toggle"

# With full verification
/gsd:quick --full "Fix login bug"

# With context gathering
/gsd:quick --discuss "Add export feature"
```

## Project Structure

```
your-project/
├── .planning/
│   ├── STATE.md           # Current position, blockers, next actions
│   ├── PROJECT.md         # Vision and key decisions
│   ├── REQUIREMENTS.md    # V1/V2 requirements
│   ├── ROADMAP.md         # Phases and milestones
│   ├── config.json        # Model profile, workflow settings
│   ├── HANDOFF.md         # Pause/resume handoff
│   ├── MILESTONE-AUDIT.md # Audit results
│   ├── phases/
│   │   ├── 01-setup/
│   │   │   ├── CONTEXT.md      # Implementation decisions
│   │   │   ├── RESEARCH.md     # Background research
│   │   │   ├── PLAN.md         # Task breakdown
│   │   │   ├── SUMMARY.md      # Completion summary
│   │   │   └── VERIFICATION.md # Checklist results
│   │   └── 02-features/
│   ├── quick/             # Ad-hoc tasks
│   ├── debug/             # Debug sessions
│   └── archive/           # Completed milestones
└── src/
    └── ...
```

## Configuration

### Model Profiles

| Profile | Planning | Execution | Verification | Use Case |
|---------|----------|-----------|--------------|----------|
| quality | Opus | Opus | Sonnet | Critical features |
| balanced | Opus | Sonnet | Sonnet | Default (recommended) |
| budget | Sonnet | Sonnet | Haiku | Quick iterations |

### Workflow Settings (.planning/config.json)

```json
{
  "modelProfile": "balanced",
  "workflow": {
    "research": true,
    "planCheck": true,
    "verifier": true,
    "autoAdvance": false
  },
  "parallelization": {
    "enabled": true,
    "maxConcurrent": 4
  },
  "git": {
    "branchingStrategy": "none"
  }
}
```

## Why GSD?

Traditional AI coding suffers from:
- ❌ Context buildup → degrading quality
- ❌ No project memory → repeated mistakes
- ❌ Large tasks → abandoned work
- ❌ No verification → untested code

GSD fixes this with:
- ✅ Structured files → persistent context
- ✅ Phase workflow → manageable chunks
- ✅ Fresh executors → consistent quality
- ✅ Verification step → tested deliverables

## Development Status

**Implemented:** All 27 commands ✅  
**Testing:** In progress 🧪  
**Status:** Alpha - use with caution ⚠️

### Known Limitations
- Sub-agent spawning tested but needs real-world validation
- Some edge cases in phase management untested
- Git integration not yet implemented

## Credits

Based on [get-shit-done](https://github.com/gsd-build/get-shit-done) by TÂCHES.

Adapted for pi-agent by Embedded Iron.

## License

MIT
