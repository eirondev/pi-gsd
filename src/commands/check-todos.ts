/**
 * /gsd:check-todos command
 * 
 * List pending todos with options to complete/remove
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	findPlanningDir,
	readState,
	writeState,
} from "../state.js";

export function registerCheckTodosCommand(pi: ExtensionAPI): void {
	pi.registerCommand("gsd:check-todos", {
		description: "List pending todos with options to manage",
		handler: async (args, ctx) => {
			const planningDir = findPlanningDir(ctx.cwd);
			if (!planningDir) {
				ctx.ui.notify("No GSD project found. Run /gsd:new-project first.", "error");
				return;
			}

			const state = readState(planningDir);
			if (!state) {
				ctx.ui.notify("Project found but STATE.md is corrupted.", "error");
				return;
			}

			if (!state.todos || state.todos.length === 0) {
				ctx.ui.notify("✅ No pending todos!", "success");
				return;
			}

			// Display todos
			const todoList = state.todos
				.map((t, i) => `${i + 1}. ${t}`)
				.join("\n");

			ctx.ui.notify(
				`📋 Pending Todos\n\n${todoList}\n\n` +
				`Options:\n` +
				`- Mark done: /gsd:complete-todo <number>\n` +
				`- Delete: /gsd:remove-todo <number>`,
				"info"
			);

			// Ask what to do
			const action = await ctx.ui.select(
				"What would you like to do?",
				[
					"Mark a todo as done",
					"Delete a todo",
					"Clear all todos",
					"Nothing (just viewing)",
				]
			);

			if (action === "Mark a todo as done" || action === "Delete a todo") {
				const indexStr = await ctx.ui.editor(
					`Enter the todo number to ${action.includes("done") ? "complete" : "delete"}:`,
					""
				);

				const index = parseInt(indexStr?.trim() || "", 10);
				if (isNaN(index) || index < 1 || index > state.todos.length) {
					ctx.ui.notify(
						`Invalid number. Must be 1-${state.todos.length}.`,
						"error"
					);
					return;
				}

				const todo = state.todos[index - 1];
				state.todos.splice(index - 1, 1);
				writeState(planningDir, state);

				ctx.ui.notify(
					`${action.includes("done") ? "✅ Completed" : "🗑️ Deleted"}: "${todo}"\n\nRemaining todos: ${state.todos.length}`,
					"success"
				);
			} else if (action === "Clear all todos") {
				const confirm = await ctx.ui.confirm(
					"Delete all todos?",
					"Yes, clear all"
				);

				if (confirm) {
					state.todos = [];
					writeState(planningDir, state);
					ctx.ui.notify("✅ All todos cleared.", "success");
				}
			}
		},
	});
}