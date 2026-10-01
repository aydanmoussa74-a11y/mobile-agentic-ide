# CHANGELOG.md

All entries describe modular milestones in the mobile-agentic-ide project. Dates reflect the project handover sequence.

## Task 17 — Repository Documentation and Native Child Tasks

- Added `spawn_sub_agent` to the workspace and registry-driven MCP tool surface.
- Added bounded prompt, system-instruction, and allowed-tool metadata.
- Added model-neutral `mobile-agentic-ide.child-task.v1` envelopes to the process scheduler.
- Added `AGENTS.md`, `ENGINEERING.md`, `CONTRIBUTION.md`, and `DOCS.md`.

## Task 16 — Background Process Scheduler and Log Vault

- Added asynchronous Wasm command queueing with bounded concurrency.
- Added queued, running, completed, failed, and cancelled process states.
- Added kill signals and refresh interruption recovery.
- Added persistent process records and structured stdout/stderr/status/error/tool logs.
- Added `process_schedule`, `process_status`, `process_logs`, and `process_kill`.

## Task 15 — Virtual Git and Time Travel

- Added unified line and file-set diffing.
- Added IndexedDB snapshots and one-tap rollback.
- Added lightweight `main` and `experimental` branches.
- Added VFS checkpoint, rollback, diff, and branch tools.

## Task 14 — End-to-End Integration Verification

- Verified IndexedDB persistence, Wasm/polyglot execution, integrations, MCP JSON-RPC, relay fallback, service-worker caching, and manifest metadata.
- Completed production type-check and build validation.

## Task 13 — WebSocket MCP Relay

- Added opt-in browser WebSocket relay client with shareable session IDs.
- Added Cloudflare Worker and Durable Object relay source.
- Added relay status and Claude Desktop/ChatGPT configuration UI.

## Task 12 — Browser MCP Server

- Added JSON-RPC MCP server with `initialize`, `ping`, `tools/list`, and `tools/call`.
- Added MCP schema conversion, HTTP/SSE transport, and mobile control panel.

## Task 11 — Ecosystem Integration Engine

- Added dynamic provider registry and generic HTTP/webhook adapter.
- Added GitHub repository, branch, commit, issue, and PR operations.
- Added Google Docs read/write and Drive export operations.
- Generalized encrypted provider token vault.

## Task 10 — Polyglot Wasm Runtime

- Added JavaScript and Python3 bridge execution.
- Added local module resolution and sandbox benchmark telemetry.
- Added agent `execute_code` support.

## Task 9 — Wasm POSIX Container

- Added WebAssembly memory-backed POSIX adapters.
- Added virtual process lifecycle, streams, pipes, environment expansion, and ANSI rendering.
- Routed agent command execution through the sandbox.

## Task 8 — Offline PWA and Project Export

- Added production service-worker caching and registration status.
- Added complete-project ZIP export.
- Added handover payload inclusion of state and recent test logs.

## Task 7 — In-Browser Testing and Self-Correction

- Added virtual smoke tests, TypeScript syntax checks, and assertions.
- Added bounded auto-correction with up to three iterations.
- Added the Automated Test Matrix to Terminal.

## Task 6 — Agent Workspace Tools

- Added model-neutral file, command, and code tools.
- Added floating natural-language Agent Action Bar.
- Recorded agent turns in the local ledger.

## Task 5 — Execution and Preview Surfaces

- Added touch-friendly VirtualTerminal.
- Added isolated LivePreview iframe with local HTML/CSS/JS assembly.
- Added mobile Terminal and Preview tabs.

## Task 4 — Agent Handover Engine

- Added structured model-agnostic handover payloads.
- Added OpenAI-compatible, Anthropic, and Gemini adapters.
- Added provider failover and local key vault.

## Task 3 — IndexedDB Virtual Filesystem

- Added typed file operations and tree listing.
- Connected persistent files to the mobile workspace UI.

## Tasks 1–2 — Mobile PWA Baseline

- Created Vite + React + TypeScript PWA foundation.
- Added semantic mobile shell, touch-safe controls, safe areas, manifest, icon, and initial state ledger.
