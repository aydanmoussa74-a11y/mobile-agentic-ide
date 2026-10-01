# CHANGELOG.md

All entries describe modular milestones in the mobile-agentic-ide project. Dates reflect the project handover sequence.

## Task 21  PWA Performance, Service Worker Offline Audit, and Touch Interaction Polish

Enhanced service worker (src/sw.ts) with comprehensive offline caching: added versioned cache management (v2), improved cache-first strategy for static assets, better HTML parsing for asset discovery, and runtime cache cleanup. Optimized vite.config.ts with manual chunk splitting for better caching: react, wasm, vfs, agent, security, mcp, integrations, terminal, preview, mcpPanel, and components chunks. Added esbuild for production minification. Enhanced CSS with explicit touch-action manipulation, safe-area support with @supports, will-change for animated elements, contain: layout for static cards, and -webkit-overflow-scrolling: touch for smooth mobile scrolling. Verified 48px minimum touch targets across all interactive elements. Bundle audit shows optimized chunks with react (212KB), agent (74KB), components (21KB), all gzipped for sub-second load on low-power mobile hardware. Preserved all semantic landmarks, safe-area spacing, visible focus, and reduced-motion behavior.

## Task 20  Touch-First Mobile UI/UX Overhaul

Redesigned the entire PWA surface into a modern, touch-optimized mobile IDE shell. Added First-Run Onboarding with capability badges (browser-native, wasm-curated). Implemented MobileShell with storage health, offline status, active project/branch indicators, and overflow menu. Built Workspace with collapsible FileExplorer (directory tree, file icons, diff badges, quick-add controls), editor with line numbers, save status, and inline Agent Patch Review toggle. Added AgentActivityDrawer with step-by-step progress (Planning, Reading, Checkpointing, Editing, Testing, Self-Correcting) and DLP Safety Badge. Implemented VisualDiffModal with swipe-through file changes, hunk accept, and snapshot rollback. Enhanced VirtualTerminal with process control (Kill, Clear), log filters, and Wasm capability badges. Enhanced LivePreview with Mock API scenario toggle (.mocks/routes.json). Redesigned Ledger with payload size previews, secret scan status, and one-tap handover JSON options. Preserved semantic landmarks, 48px touch targets, safe-area spacing, visible focus, reduced-motion behavior, and offline operation. All backend engines (Task 19) remain intact.

## Task 19  Project Loop and Safety Engine Foundation

Added a versioned `project.manifest.json`, bounded ZIP import/export with unsafe-path and secret checks, a secret/DLP scanner with redaction at handover, model-dispatch, and log boundaries, a VFS fixture-backed mock API gateway for Preview, and checkpoint-backed atomic workspace transactions with rollback on failed verification. Exposed project import, manifest, and transaction capabilities through workspace and MCP tools.

## Task 18  Production Hardening and System Resilience

Added browser quota estimation and automatic LRU pruning for VFS snapshots and execution logs. Added Wasm/polyglot timeout, abort, and memory guards. Added MCP relay exponential reconnect backoff capped at 30 seconds plus 15-second heartbeats. Added secret-free `system_health` diagnostics for storage, Wasm, processes, provider vault state, and MCP tunnel status.

## Task 17  Repository Documentation and Native Child Tasks

- Added `spawn_sub_agent` to the workspace and registry-driven MCP tool surface.
- Added bounded prompt, system-instruction, and allowed-tool metadata.
- Added model-neutral `mobile-agentic-ide.child-task.v1` envelopes to the process scheduler.
- Added `AGENTS.md`, `ENGINEERING.md`, `CONTRIBUTION.md`, and `DOCS.md`.

## Task 16  Background Process Scheduler and Log Vault

- Added asynchronous Wasm command queueing with bounded concurrency.
- Added queued, running, completed, failed, and cancelled process states.
- Added kill signals and refresh interruption recovery.
- Added persistent process records and structured stdout/stderr/status/error/tool logs.
- Added `process_schedule`, `process_status`, `process_logs`, and `process_kill`.

## Task 15  Virtual Git and Time Travel

- Added unified line and file-set diffing.
- Added IndexedDB snapshots and one-tap rollback.
- Added lightweight `main` and `experimental` branches.
- Added VFS checkpoint, rollback, diff, and branch tools.

## Task 14  End-to-End Integration Verification

- Verified IndexedDB persistence, Wasm/polyglot execution, integrations, MCP JSON-RPC, relay fallback, service-worker caching, and manifest metadata.
- Completed production type-check and build validation.

## Task 13  WebSocket MCP Relay

- Added opt-in browser WebSocket relay client with shareable session IDs.
- Added Cloudflare Worker and Durable Object relay source.
- Added relay status and Claude Desktop/ChatGPT configuration UI.

## Task 12  Browser MCP Server

- Added JSON-RPC MCP server with `initialize`, `ping`, `tools/list`, and `tools/call`.
- Added MCP schema conversion, HTTP/SSE transport, and mobile control panel.

## Task 11  Ecosystem Integration Engine

- Added dynamic provider registry and generic HTTP/webhook adapter.
- Added GitHub repository, branch, commit, issue, and PR operations.
- Added Google Docs read/write and Drive export operations.
- Generalized encrypted provider token vault.

## Task 10  Polyglot Wasm Runtime

- Added JavaScript and Python3 bridge execution.
- Added local module resolution and sandbox benchmark telemetry.
- Added agent `execute_code` support.

## Task 9  Wasm POSIX Container

- Added WebAssembly memory-backed POSIX adapters.
- Added virtual process lifecycle, streams, pipes, environment expansion, and ANSI rendering.
- Routed agent command execution through the sandbox.

## Task 8  Offline PWA and Project Export

- Added production service-worker caching and registration status.
- Added complete-project ZIP export.
- Added handover payload inclusion of state and recent test logs.

## Task 7  In-Browser Testing and Self-Correction

- Added virtual smoke tests, TypeScript syntax checks, and assertions.
- Added bounded auto-correction with up to three iterations.
- Added the Automated Test Matrix to Terminal.

## Task 6  Agent Workspace Tools

- Added model-neutral file, command, and code tools.
- Added floating natural-language Agent Action Bar.
- Recorded agent turns in the local ledger.

## Task 5  Execution and Preview Surfaces

- Added touch-friendly VirtualTerminal.
- Added isolated LivePreview iframe with local HTML/CSS/JS assembly.
- Added mobile Terminal and Preview tabs.

## Task 4  Agent Handover Engine

- Added structured model-agnostic handover payloads.
- Added OpenAI-compatible, Anthropic, and Gemini adapters.
- Added provider failover and local key vault.

## Task 3  IndexedDB Virtual Filesystem
