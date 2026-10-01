# AGENTS.md — Mobile Agentic IDE Operating Rules

## Mission

This repository is a mobile-first, low-memory, offline-capable agentic development environment inspired by `odysseus-dev/odysseus`. Preserve the single-surface touch-first experience, device-local persistence, progressive disclosure, and model-neutral tool boundaries.

## Before Every Change

1. Read `.agent_state.json` before writing code.
2. Read the nearest applicable source and documentation files.
3. Keep work modular: implement only the assigned slice; do not rewrite the application wholesale.
4. Preserve semantic landmarks, 48px touch targets, safe-area spacing, visible focus, reduced-motion behavior, and offline operation.

## State Boundaries

- **VFS files and directories:** IndexedDB database `mobile-agentic-ide`; use `src/lib/storage/` APIs.
- **VFS history:** `src/lib/vfs/`; snapshots are local, branch-scoped, and rollback-capable.
- **Provider and ecosystem credentials:** device-local encrypted vaults only; never log or expose secrets.
- **Process state and execution logs:** `src/lib/agent/logStorage.ts` in the separate runtime IndexedDB database.
- **Model calls:** remain behind `multiModelBridge.ts` and provider configuration; do not hard-code API keys or silently send data remotely.
- **MCP:** expose only registered workspace tools through `mcpSchema.ts`; external mutations require explicit confirmation.
- **`.agent_state.json`:** authoritative handover ledger. Update it with exact completed work, validation, limitations, and the next step.

## Tool and Security Rules

- Keep tool inputs typed and bounded. Reject malformed paths, commands, provider IDs, and child-task bounds.
- Treat GitHub, Google, generic HTTP, webhooks, public relays, and remote model calls as external boundaries.
- Never invent confirmation for an external mutation. Require `confirm: true` where the tool contract says so.
- Do not place OAuth tokens, API keys, prompts containing secrets, or raw credentials in logs, snapshots, README files, or state ledgers.
- Keep child agents bounded by an explicit prompt, system instructions, and allowed tool names. Track spawned work by process ID and logs.

## Sub-Agent Spawning

Use `spawn_sub_agent` for asynchronous, bounded child work. Every child task must provide a specific prompt; include minimal system instructions and the smallest possible `allowedTools` list. The parent must retain ownership of integration, validation, state-ledger updates, and final commits. Follow up with `process_status`, `process_logs`, and `process_kill` when appropriate. Child tasks must not broaden permissions, modify credentials, or bypass confirmation requirements.

## Validation and Handover

Run `npm run check` and `npm run build` before handover. Run focused browser or module smoke checks when the task changes runtime behavior. Use `git diff --check`, validate `.agent_state.json` as JSON, remove generated config artifacts, commit the modular change, and push to `main` unless the user explicitly says otherwise.

When a task is complete, update `.agent_state.json`, README/API docs where relevant, and leave the repository clean. Stop at the requested review checkpoint instead of starting unrelated features.
