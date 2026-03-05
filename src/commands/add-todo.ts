/**
 * /gsd:add-todo command
 * 
 * Capture an idea/task for later
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";

export function registerAddTodoCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:add-todo", {
		description: "Capture an idea or task for later",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);
			if (!planningDir) {
				ctx.ui.notify("No GSD project found. Run /gsd:new-project first.", "error");
				return;
			}

			const todo = args.trim() || await ctx.ui.editor(
				"What do you want to remember?",
				""
			);

			if (!todo?.trim()) {
				ctx.ui.notify("Todo description required.", "error");
				return;
			}

			const state = readState(planningDir);
			if (!state) {
				ctx.ui.notify("Project found but STATE.md is corrupted.", "error");
				return;
			}

			state.todos = state.todos || [];
			state.todos.push(todo.trim());

			writeState(planningDir, state);

			ctx.ui.notify(
				`✅ Todo Added\n\n` +
				`"${todo.trim()}"\n\n` +
				`Total todos: ${state.todos.length}\n` +
				`View with: /gsd:check-todos`,
				"success"
			);
		},
	});
}