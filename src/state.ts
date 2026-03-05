/**
 * GSD State Management
 * 
 * Manages .planning/STATE.md and related files
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface GsdPhase {
  number: number;
  name: string;
  status: "pending" | "discussing" | "planning" | "executing" | "verifying" | "completed";
  contextMd?: string;
  researchMd?: string;
  plans: string[]; // Plan file names
  summaries: string[]; // Summary file names
}

export interface GsdState {
  projectName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  projectVersion?: string;
  milestone?: string | null;
  currentPhase: number;
  phaseStatus: GsdPhase["status"];
  phases: GsdPhase[];
  blockers: string[];
  nextActions: string[];
  todos?: string[];
  debugSessions?: DebugSession[];
}

export interface DebugSession {
  id: string;
  description: string;
  hypotheses: string[];
  tested: { hypothesis: string; result: string }[];
  resolution: string | null;
  created: string;
}

const PLANNING_DIR = ".planning";
const STATE_FILE = "STATE.md";
const PROJECT_FILE = "PROJECT.md";
const REQUIREMENTS_FILE = "REQUIREMENTS.md";
const ROADMAP_FILE = "ROADMAP.md";

/**
 * Find .planning directory walking up from cwd
 */
export function findPlanningDir(cwd: string): string | null {
  let dir = cwd;
  while (dir !== path.dirname(dir)) {
    const planningPath = path.join(dir, PLANNING_DIR);
    if (fs.existsSync(planningPath)) {
      return planningPath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Create .planning directory structure
 */
export function initPlanningDir(cwd: string, projectName: string, description: string): string {
  const planningPath = path.join(cwd, PLANNING_DIR);
  const phasesPath = path.join(planningPath, "phases");
  
  // Create directories
  fs.mkdirSync(planningPath, { recursive: true });
  fs.mkdirSync(phasesPath, { recursive: true });
  
  // Create initial state
  const now = new Date().toISOString();
  const state: GsdState = {
    projectName,
    description,
    createdAt: now,
    updatedAt: now,
    currentPhase: 1,
    phaseStatus: "pending",
    phases: [],
    blockers: [],
    nextActions: ["Run /gsd:discuss-phase 1 to capture implementation decisions"],
  };
  
  writeState(planningPath, state);
  
  // Create PROJECT.md if not exists
  const projectPath = path.join(planningPath, PROJECT_FILE);
  if (!fs.existsSync(projectPath)) {
    const projectContent = `# ${projectName}

${description}

## Vision

[Describe what you're building and why]

## Key Decisions

[Track important decisions here]

## Tech Stack

[List the technologies being used]
`;
    fs.writeFileSync(projectPath, projectContent, "utf-8");
  }
  
  // Create REQUIREMENTS.md if not exists
  const requirementsPath = path.join(planningPath, REQUIREMENTS_FILE);
  if (!fs.existsSync(requirementsPath)) {
    const requirementsContent = `# Requirements

## V1 (MVP)

[Core features for first release]

### Must Have
- [ ] 

### Should Have
- [ ] 

### Nice to Have
- [ ] 

## V2 (Post-MVP)

[Features for second release]

## Out of Scope

[What we're explicitly not doing]
`;
    fs.writeFileSync(requirementsPath, requirementsContent, "utf-8");
  }
  
  // Create ROADMAP.md if not exists
  const roadmapPath = path.join(planningPath, ROADMAP_FILE);
  if (!fs.existsSync(roadmapPath)) {
    const roadmapContent = `# Roadmap

## Milestone 1: [Name]

### Phase 1: [Name]
- Description: [What this phase accomplishes]
- Status: pending

### Phase 2: [Name]
- Description: [What this phase accomplishes]
- Status: pending

## Milestone 2: [Name]

[Future milestones]
`;
    fs.writeFileSync(roadmapPath, roadmapContent, "utf-8");
  }
  
  return planningPath;
}

/**
 * Read STATE.md
 */
export function readState(planningDir: string): GsdState | null {
  const statePath = path.join(planningDir, STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  
  const content = fs.readFileSync(statePath, "utf-8");
  return parseStateMd(content);
}

/**
 * Write STATE.md
 */
export function writeState(planningDir: string, state: GsdState): void {
  state.updatedAt = new Date().toISOString();
  const content = formatStateMd(state);
  const statePath = path.join(planningDir, STATE_FILE);
  fs.writeFileSync(statePath, content, "utf-8");
}

/**
 * Parse STATE.md content
 */
function parseStateMd(content: string): GsdState {
  const lines = content.split("\n");
  const state: Partial<GsdState> = {
    phases: [],
    blockers: [],
    nextActions: [],
  };
  
  let currentSection = "";
  let currentPhase: Partial<GsdPhase> | null = null;
  
  for (const line of lines) {
    // Parse key: value pairs
    const keyMatch = line.match(/^(\w+):\s*(.+)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      switch (key) {
        case "project":
          state.projectName = value;
          break;
        case "description":
          state.description = value;
          break;
        case "created":
          state.createdAt = value;
          break;
        case "updated":
          state.updatedAt = value;
          break;
        case "current_phase":
          state.currentPhase = parseInt(value, 10) || 1;
          break;
        case "phase_status":
          state.phaseStatus = value as GsdPhase["status"];
          break;
        case "version":
          state.projectVersion = value;
          break;
        case "milestone":
          state.milestone = value;
          break;
      }
    }
    
    // Parse sections
    if (line.startsWith("## Phases")) {
      currentSection = "phases";
    } else if (line.startsWith("## Blockers")) {
      currentSection = "blockers";
      currentPhase = null;
    } else if (line.startsWith("## Next Actions")) {
      currentSection = "next";
      currentPhase = null;
    } else if (line.startsWith("### Phase")) {
      const phaseMatch = line.match(/### Phase (\d+): (.+)$/);
      if (phaseMatch) {
        currentPhase = {
          number: parseInt(phaseMatch[1], 10),
          name: phaseMatch[2],
          plans: [],
          summaries: [],
        };
        state.phases!.push(currentPhase as GsdPhase);
        currentSection = "phases";
      }
    } else if (line.startsWith("- status: ") && currentPhase) {
      currentPhase.status = line.replace("- status: ", "") as GsdPhase["status"];
    } else if (line.startsWith("- ")) {
      const item = line.replace("- ", "");
      if (currentSection === "blockers") {
        state.blockers!.push(item);
      } else if (currentSection === "next") {
        state.nextActions!.push(item);
      }
    }
  }
  
  return state as GsdState;
}

/**
 * Format STATE.md content
 */
function formatStateMd(state: GsdState): string {
  const lines: string[] = [
    `# ${state.projectName} - GSD State`,
    "",
    `project: ${state.projectName}`,
    `description: ${state.description}`,
    `created: ${state.createdAt}`,
    `updated: ${state.updatedAt}`,
    `version: ${state.projectVersion || "0.0.0"}`,
    state.milestone ? `milestone: ${state.milestone}` : "# milestone: (none)",
    `current_phase: ${state.currentPhase}`,
    `phase_status: ${state.phaseStatus}`,
    "",
    "## Phases",
    "",
  ];
  
  for (const phase of state.phases) {
    lines.push(`### Phase ${phase.number}: ${phase.name}`);
    lines.push(`- status: ${phase.status}`);
    if (phase.contextMd) lines.push(`- context: ${phase.contextMd}`);
    if (phase.plans.length > 0) lines.push(`- plans: ${phase.plans.join(", ")}`);
    lines.push("");
  }
  
  lines.push("## Blockers");
  lines.push("");
  for (const blocker of state.blockers) {
    lines.push(`- ${blocker}`);
  }
  if (state.blockers.length === 0) lines.push("(none)");
  lines.push("");
  
  lines.push("## Next Actions");
  lines.push("");
  for (const action of state.nextActions) {
    lines.push(`- ${action}`);
  }
  if (state.nextActions.length === 0) lines.push("(none)");
  lines.push("");
  
  return lines.join("\n");
}

/**
 * Create phase directory
 */
export function createPhaseDir(planningDir: string, phaseNumber: number, phaseName: string): string {
  const phaseDir = path.join(planningDir, "phases", `${String(phaseNumber).padStart(2, "0")}-${slugify(phaseName)}`);
  fs.mkdirSync(phaseDir, { recursive: true });
  return phaseDir;
}

/**
 * Simple slugify
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get phase directory
 */
export function getPhaseDir(planningDir: string, phaseNumber: number): string | null {
  const phasesDir = path.join(planningDir, "phases");
  if (!fs.existsSync(phasesDir)) return null;
  
  const dirs = fs.readdirSync(phasesDir);
  const phaseDir = dirs.find(d => d.startsWith(`${String(phaseNumber).padStart(2, "0")}-`));
  
  return phaseDir ? path.join(phasesDir, phaseDir) : null;
}