/**
 * /gsd:map-codebase command
 * 
 * Analyze existing codebase before new-project (brownfield support)
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

export function registerMapCodebaseCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:map-codebase", {
		description: "Analyze existing codebase structure, patterns, and conventions",
		handler: async (args, ctx) => {
			const projectDir = ctx.cwd;
			const planningDir = path.join(projectDir, ".planning");

			// Create planning dir if needed
			if (!fs.existsSync(planningDir)) {
				fs.mkdirSync(planningDir, { recursive: true });
			}

			// Analyze project structure
			const analysis = await analyzeProject(projectDir, ctx);

			// Create research directory
			const researchDir = path.join(planningDir, "research");
			fs.mkdirSync(researchDir, { recursive: true });

			// Save analysis
			const codebasePath = path.join(researchDir, "CODEBASE.md");
			fs.writeFileSync(codebasePath, analysis, "utf-8");

			ctx.ui.notify(
				`✅ Codebase Mapped\n\n` +
				`Analysis saved to: .planning/research/CODEBASE.md\n\n` +
				`Key findings:\n` +
				`- Tech stack identified\n` +
				`- Architecture patterns documented\n` +
				`- Conventions captured\n\n` +
				`Next: Run /gsd:new-project to add new features to this codebase.`,
				"info"
			);
		},
	});
}

async function analyzeProject(projectDir: string, ctx: any): Promise<string> {
	const sections: string[] = [];

	// 1. Tech Stack Detection
	const techStack = await detectTechStack(projectDir);
	sections.push(`## Tech Stack\n\n${techStack}`);

	// 2. Project Structure
	const structure = await analyzeStructure(projectDir);
	sections.push(`## Project Structure\n\n\`\`\`\n${structure}\n\`\`\``);

	// 3. Key Files
	const keyFiles = await findKeyFiles(projectDir);
	sections.push(`## Key Files\n\n${keyFiles.map(f => `- \`${f}\``).join("\n")}`);

	// 4. Architecture Patterns
	const patterns = await detectPatterns(projectDir);
	sections.push(`## Architecture Patterns\n\n${patterns}`);

	// 5. Dependencies
	const deps = await analyzeDependencies(projectDir);
	sections.push(`## Dependencies\n\n${deps}`);

	// 6. Conventions
	const conventions = await detectConventions(projectDir);
	sections.push(`## Conventions\n\n${conventions}`);

	// 7. Potential Concerns
	const concerns = await findConcerns(projectDir);
	sections.push(`## Potential Concerns\n\n${concerns}`);

	return `# Codebase Analysis

**Generated:** ${new Date().toISOString()}
**Project:** ${path.basename(projectDir)}

${sections.join("\n\n---\n\n")}

---

## Summary

This analysis provides context for GSD planning. When adding features:

1. Follow existing patterns in \`src/\`
2. Match naming conventions (see Conventions)
3. Consider architectural decisions (see Architecture Patterns)
4. Be aware of concerns before making changes

Run /gsd:new-project to start planning new features with this context.
`;
}

async function detectTechStack(projectDir: string): Promise<string> {
	const stack: string[] = [];

	// Check for package.json
	const packageJsonPath = path.join(projectDir, "package.json");
	if (fs.existsSync(packageJsonPath)) {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		stack.push(`**Language:** ${pkg.type === "module" ? "JavaScript (ESM)" : "JavaScript/TypeScript"}`);

		// Check for TypeScript
		if (fs.existsSync(path.join(projectDir, "tsconfig.json"))) {
			stack[0] = "**Language:** TypeScript";
		}

		// Framework detection
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		if (deps.react) stack.push("**Frontend:** React");
		if (deps.vue) stack.push("**Frontend:** Vue");
		if (deps.svelte) stack.push("**Frontend:** Svelte");
		if (deps.next) stack.push("**Framework:** Next.js");
		if (deps.nuxt) stack.push("**Framework:** Nuxt");
		if (deps.sveltekit) stack.push("**Framework:** SvelteKit");
		if (deps.express) stack.push("**Backend:** Express");
		if (deps.fastify) stack.push("**Backend:** Fastify");
		if (deps.prisma) stack.push("**ORM:** Prisma");
		if (deps.tailwindcss) stack.push("**CSS:** Tailwind");
	}

	// Check for Python
	if (fs.existsSync(path.join(projectDir, "requirements.txt")) || 
		fs.existsSync(path.join(projectDir, "pyproject.toml")) ||
		fs.existsSync(path.join(projectDir, "setup.py"))) {
		stack.push("**Language:** Python");
	}

	// Check for Rust
	if (fs.existsSync(path.join(projectDir, "Cargo.toml"))) {
		stack.push("**Language:** Rust");
	}

	// Check for Go
	if (fs.existsSync(path.join(projectDir, "go.mod"))) {
		stack.push("**Language:** Go");
	}

	return stack.length > 0 ? stack.join("\n") : "**Language:** Unknown (no standard config found)";
}

async function analyzeStructure(projectDir: string): Promise<string> {
	const lines: string[] = [];
	
	const scan = (dir: string, prefix: string = "", depth: number = 0) => {
		if (depth > 3) return;
		
		const entries = fs.readdirSync(dir, { withFileTypes: true })
			.filter(e => !e.name.startsWith(".") && 
				!["node_modules", "dist", "build", ".git"].includes(e.name))
			.sort((a, b) => a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : b.isDirectory() ? -1 : 1);

		const maxEntries = 15;
		for (let i = 0; i < Math.min(entries.length, maxEntries); i++) {
			const entry = entries[i];
			const isLast = i === entries.length - 1 || i === maxEntries - 1;
			const connector = isLast ? "└── " : "├── ";
			const childPrefix = isLast ? "    " : "│   ";

			if (entry.isDirectory()) {
				lines.push(`${prefix}${connector}${entry.name}/`);
				scan(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
			} else {
				lines.push(`${prefix}${connector}${entry.name}`);
			}
		}

		if (entries.length > maxEntries) {
			lines.push(`${prefix}└── ... (${entries.length - maxEntries} more)`);
		}
	};

	scan(projectDir);
	return lines.join("\n");
}

async function findKeyFiles(projectDir: string): Promise<string[]> {
	const keyFiles: string[] = [];
	const searchDirs = ["src", "lib", "app", "pages", "components", "api", "routes"];

	for (const searchDir of searchDirs) {
		const fullDir = path.join(projectDir, searchDir);
		if (fs.existsSync(fullDir)) {
			const files = fs.readdirSync(fullDir, { recursive: true, withFileTypes: true })
				.filter((e: any) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx") || e.name.endsWith(".js")))
				.slice(0, 10)
				.map((e: any) => path.join(searchDir, e.name));
			keyFiles.push(...files);
		}
	}

	// Add config files
	const configs = ["tsconfig.json", "package.json", "vite.config.ts", "next.config.js", "tailwind.config.js"];
	for (const config of configs) {
		if (fs.existsSync(path.join(projectDir, config))) {
			keyFiles.push(config);
		}
	}

	return [...new Set(keyFiles)].slice(0, 20);
}

async function detectPatterns(projectDir: string): Promise<string> {
	const patterns: string[] = [];

	// Check for common patterns
	const srcDir = path.join(projectDir, "src");
	if (fs.existsSync(srcDir)) {
		// Feature-based structure
		if (fs.existsSync(path.join(srcDir, "features")) || fs.existsSync(path.join(srcDir, "modules"))) {
			patterns.push("- **Feature-based architecture** (features/ or modules/ directory)");
		}

		// Layer-based structure
		if (fs.existsSync(path.join(srcDir, "components")) && 
			fs.existsSync(path.join(srcDir, "hooks")) || 
			fs.existsSync(path.join(srcDir, "utils"))) {
			patterns.push("- **Component-based architecture** (separate concerns)");
		}

		// API routes
		if (fs.existsSync(path.join(srcDir, "api")) || fs.existsSync(path.join(projectDir, "app/api"))) {
			patterns.push("- **API routes** (server endpoints defined)");
		}
	}

	// State management
	const packageJsonPath = path.join(projectDir, "package.json");
	if (fs.existsSync(packageJsonPath)) {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		if (pkg.dependencies?.zustand) patterns.push("- **State:** Zustand");
		if (pkg.dependencies?.jotai) patterns.push("- **State:** Jotai");
		if (pkg.dependencies?.redux) patterns.push("- **State:** Redux");
		if (pkg.dependencies?.["@tanstack/react-query"]) patterns.push("- **Server State:** TanStack Query");
	}

	return patterns.length > 0 ? patterns.join("\n") : "- Standard structure (no specific patterns detected)";
}

async function analyzeDependencies(projectDir: string): Promise<string> {
	const packageJsonPath = path.join(projectDir, "package.json");
	if (!fs.existsSync(packageJsonPath)) {
		return "No package.json found.";
	}

	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	const deps = Object.keys(pkg.dependencies || {}).slice(0, 10);
	const devDeps = Object.keys(pkg.devDependencies || {}).slice(0, 10);

	return `### Production\n${deps.map(d => `- ${d}`).join("\n") || "None"}\n\n### Development\n${devDeps.map(d => `- ${d}`).join("\n") || "None"}`;
}

async function detectConventions(projectDir: string): Promise<string> {
	const conventions: string[] = [];

	// File naming
	const srcDir = path.join(projectDir, "src");
	if (fs.existsSync(srcDir)) {
		const files = fs.readdirSync(srcDir, { recursive: true, withFileTypes: true })
			.filter((e: any) => e.isFile())
			.map((e: any) => e.name) as string[];

		// Check for kebab-case
		if (files.some((f: string) => f.includes("-") && !f.startsWith("."))) {
			conventions.push("- **File naming:** kebab-case (e.g., `user-profile.tsx`)");
		}

		// Check for PascalCase
		if (files.some((f: string) => /^[A-Z]/.test(f))) {
			conventions.push("- **Component naming:** PascalCase (e.g., `UserProfile.tsx`)");
		}

		// Check for test patterns
		if (files.some((f: string) => f.includes(".test.") || f.includes(".spec."))) {
			conventions.push("- **Tests:** Colocated with source files (*.test.ts / *.spec.ts)");
		}
	}

	// Check for ESLint/Prettier
	if (fs.existsSync(path.join(projectDir, ".eslintrc.js")) || 
		fs.existsSync(path.join(projectDir, ".eslintrc.json")) ||
		fs.existsSync(path.join(projectDir, "eslint.config.js"))) {
		conventions.push("- **Linting:** ESLint configured");
	}

	if (fs.existsSync(path.join(projectDir, ".prettierrc")) || 
		fs.existsSync(path.join(projectDir, ".prettierrc.json"))) {
		conventions.push("- **Formatting:** Prettier configured");
	}

	return conventions.length > 0 ? conventions.join("\n") : "- Standard conventions (analyze files for specifics)";
}

async function findConcerns(projectDir: string): Promise<string> {
	const concerns: string[] = [];

	// Check for large files
	const findLargeFiles = (dir: string) => {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".") || ["node_modules", "dist", "build"].includes(entry.name)) continue;
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				findLargeFiles(fullPath);
			} else if (entry.isFile()) {
				try {
					const stats = fs.statSync(fullPath);
					if (stats.size > 100000) { // 100KB
						concerns.push(`- Large file: \`${path.relative(projectDir, fullPath)}\` (${Math.round(stats.size / 1024)}KB)`);
					}
				} catch {}
			}
		}
	};
	findLargeFiles(projectDir);

	// Check for TODOs
	const findTodos = (dir: string, count: number = 0) => {
		if (count > 5 || !fs.existsSync(dir)) return count;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".") || ["node_modules", "dist", "build"].includes(entry.name)) continue;
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				count = findTodos(fullPath, count);
			} else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
				try {
					const content = fs.readFileSync(fullPath, "utf-8");
					const todos = content.match(/TODO|FIXME|XXX|HACK/g) || [];
					count += todos.length;
				} catch {}
			}
		}
		return count;
	};

	const todoCount = findTodos(projectDir);
	if (todoCount > 0) {
		concerns.push(`- **${todoCount} TODO/FIXME** comments found (consider addressing before adding)`);
	}

	return concerns.length > 0 ? concerns.join("\n") : "No major concerns detected.";
}