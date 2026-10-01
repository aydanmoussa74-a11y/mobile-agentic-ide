# CONTRIBUTION.md — Contribution Guide

## Workflow

1. Read `AGENTS.md` and `.agent_state.json`.
2. Identify the smallest modular slice that satisfies the task.
3. Inspect neighboring APIs before editing.
4. Keep source changes typed, local, and reversible.
5. Update documentation and `.agent_state.json` when behavior or boundaries change.
6. Validate, commit, and push the focused change.

## TypeScript Style

- Use strict TypeScript contracts; avoid `any` and unchecked casts.
- Prefer named interfaces for public module boundaries.
- Use explicit unions for statuses, provider IDs, tool names, and branch names.
- Keep browser APIs behind small service modules.
- Use async functions for IndexedDB and runtime operations; do not block the main thread.
- Preserve stable barrel exports when adding reusable modules.

## UI and Mobile Rules

- Design for touch first: controls should be at least 48px where practical.
- Preserve keyboard access, visible focus, semantic labels, safe-area spacing, and reduced-motion behavior.
- Avoid adding a desktop-only multi-pane dependency for a mobile feature.
- Prefer progressive disclosure and short status messages over dense dashboards.

## Storage and Security

- Normalize VFS paths through the storage service.
- Never put tokens, API keys, or secrets into console output, process logs, snapshots, handover JSON, or committed files.
- External GitHub, Google, generic HTTP, webhook, billing, account, or public-relay mutations require the existing confirmation boundary.
- Treat IndexedDB encryption as local-at-rest obfuscation, not a hardware security guarantee.

## Agent and MCP Tools

- Add a tool definition, typed union member, implementation branch, and documentation together.
- Validate required arguments and return structured JSON where a tool is consumed by MCP.
- Keep tool permissions narrow. Child agents must receive explicit prompts and bounded allowed tools.
- Ensure MCP exposure is registry-driven through `mcpSchema.ts`; do not create a second undocumented tool list.

## Required Checks

Run:

```bash
npm run check
npm run build
python3 -m json.tool .agent_state.json >/dev/null
git diff --check
```

Remove generated `vite.config.js` or other build artifacts if they appear. For runtime changes, run a focused browser/module smoke check and record meaningful results in `.agent_state.json`.

## Commits

Use a concise conventional-style message such as `feat: add process scheduler logs`. Keep commits scoped to the task. Do not commit credentials, generated bundles, temporary smoke files, or local database exports.
