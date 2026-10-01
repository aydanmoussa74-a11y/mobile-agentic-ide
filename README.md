# Mobile Agentic IDE

A **mobile-first agentic development environment** built as a lightweight PWA foundation. This repository is structurally inspired by [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus), while adapting its workspace and agent-handover direction for touch-first interaction, constrained memory, and fast future session transitions.

## Current scope

The app includes a mobile-safe workspace shell, a device-local virtual file system backed by IndexedDB, an Agent Ledger tab, a virtual terminal, and an isolated live preview. Files and directories can be created, opened, edited, saved, deleted, and listed without a server; they remain available after a browser reload in the same origin.

The orchestration boundary under `src/lib/agent/` provides:

- `handoverEngine.ts` — exports and imports `mobile-agentic-ide.handover.v1` payloads containing `.agent_state.json` context, files, code diffs, session history, and model-neutral messages.
- `multiModelBridge.ts` — one fetch interface with OpenAI-compatible chat completions, Anthropic Messages, and Google Gemini `generateContent` request/response adapters.
- `failoverHandler.ts` — rotates through configured providers on HTTP 429, quota/rate-limit, exhaustion, and retryable upstream errors.
- `providerVault.ts` — stores API keys in a separate device-local IndexedDB store and never renders saved values. Browser storage is not hardware-backed secret storage; production deployments should proxy model calls through a trusted backend.

The Agent Ledger exposes the active model state, local provider-key setup, and a One-Tap Handover clipboard action. Authentication, streaming handovers, a full code editor, and production offline synchronization remain future slices.

The execution surfaces under `src/features/` provide:

- `terminal/VirtualTerminal.tsx` — touch-friendly `ls`, `cat`, `mkdir`, `rm`, `node run`, and `git status` commands against IndexedDB. `node run` captures console output in a local virtual runtime; it is not a server-side Node process.
- `preview/LivePreview.tsx` — assembles local `.html`, `.css`, and `.js` files into a sandboxed iframe `srcdoc` and refreshes when the workspace changes.

Task execution is exposed through `src/lib/agent/workspaceTools.ts` and `agentRunner.ts`. The model bridge advertises four bounded tools — `read_file`, `write_file`, `list_files`, and `execute_command` — and runs at most five tool rounds per request. Completed turns are written to the virtual `.agent_state.json` file in IndexedDB, then the workspace is refreshed so the preview sees changes immediately. The floating action bar on Workspace accepts natural-language tasks and routes them through the active configured provider.

The in-browser verification boundary under `src/lib/testing/` provides virtual smoke checks, lightweight TypeScript delimiter/syntax verification, and executable `.test.js` assertion files from IndexedDB. Each AI tool operation triggers a new Test Matrix result in the Terminal tab. `autoCorrector.ts` feeds failed logs back into the agent for up to three corrective iterations, with pass/fail indicators, stack traces, and verification logs visible in the matrix.

The PWA shell uses `src/sw.ts` as the service-worker source and `public/sw.js` as the static production asset. The worker precaches the app shell, manifest, icon, robots file, and discovers the generated Vite bundle URLs from the built HTML. Static same-origin requests are cached for offline reloads, while IndexedDB remains the cloud-free source of truth for workspace state. Workspace also creates/maintains a portable `.agent_state.json` ledger and provides a dependency-free Complete Project ZIP export. One-Tap Handover includes that ledger file, all local files, and the latest Test Matrix logs in the structured payload.

The terminal execution boundary under `src/lib/wasm/` uses a real `WebAssembly.Memory` instance for the sandbox address space and routes POSIX-style `read`, `write`, `stat`, and `readdir` operations to the IndexedDB virtual filesystem. `processManager.ts` owns virtual PIDs, lifecycle state, exit codes, stdin/stdout/stderr buffers, and pipeline stages. Terminal commands now execute through this process layer with `$ENV` expansion, `|` pipelines, and ANSI color parsing. Agent `execute_command` calls use the same Wasm container rather than the former simulated string helper.

The polyglot layer under `src/lib/wasm/polyglotEngine.ts` provides a low-memory JavaScript/Node runtime boundary and an in-memory Python3 subset bridge, both backed by Wasm memory and the IndexedDB VFS. `moduleResolver.ts` resolves relative and local `.js`, `.mjs`, and `.py` modules with an in-memory cache. Agents can use the additional `execute_code` tool for `node` or `python3` source, while the Terminal accepts `node`, `python3`, `-e`, `-c`, and file execution forms. `SandboxBenchmark.tsx` reports live memory allocation, execution latency, VFS throughput, process counts, and isolation violations, plus a repeatable local stress run.

The ecosystem integration boundary under `src/lib/integrations/` contains a browser-local AES-GCM token vault, GitHub REST/GraphQL adapters, and Google Docs/Drive adapters. GitHub can read repository trees, create branches, commit the IndexedDB VFS, and open pull requests. Google can read Docs context and upload a VFS export through Drive multipart upload. Agent tools expose read/status operations directly; external mutations require an explicit `confirm: true` argument and are not executed by this task. Browser storage is still not a hardware-backed secret manager, and OAuth token provisioning remains an explicit user-controlled setup step.

`registry.ts` provides dynamic provider registration for GitHub, GitLab, Google Workspace, Notion, Linear, Slack, Supabase, Vercel, or future MCP-backed services without changing the agent loop. `genericHttpAdapter.ts` supports provider-scoped REST calls and webhooks. The baseline registry registers GitHub, Google Workspace, and Generic HTTP; additional providers can register an id, capabilities, and an `invoke` implementation at runtime. The token vault supports arbitrary provider IDs and named credentials such as `accessToken` or `apiKey`.

The MCP subsystem under `src/lib/mcp/` implements JSON-RPC 2.0 `initialize`, `ping`, `tools/list`, and `tools/call`, converts the complete workspace tool registry to MCP JSON Schema, and provides an SSE/HTTP POST transport with session IDs and CORS headers. The MCP control panel exposes the endpoint and a copyable client configuration. Because a standalone browser tab cannot bind an inbound TCP port, the endpoint is a browser bridge contract that requires the deployed host, service worker host, or reverse proxy to route `/mcp` requests into `McpHttpSseTransport`; the UI reports this limitation instead of claiming public socket listening.

Task 13 adds `src/lib/mcp/mcpRelay.ts` as an explicit opt-in WebSocket client. It creates a short shareable session ID, forwards relay requests into the in-browser `McpServer`, and exposes Claude Desktop and ChatGPT configuration snippets. `relay-worker/` contains a Cloudflare Worker plus Durable Object session implementation: `/ws?session=...` connects the PWA and `/mcp?session=...` accepts public HTTP/SSE MCP traffic. The public session URL is a bearer link; the control panel warns about this and disabling Relay Mode closes the browser socket and invalidates the session.

Task 15 adds the in-memory-style virtual Git layer under `src/lib/vfs/`. `diffEngine.ts` calculates unified line and file-set diffs, `vfsHistory.ts` persists up to 50 branch-scoped snapshots and restores complete files/directories, and `vfsBranching.ts` maintains lightweight `main` and `experimental` branch heads in IndexedDB with the active branch in local storage. Agent `read_file`, `write_file`, and `execute_command` operations checkpoint automatically before execution. `vfs_checkpoint`, `vfs_rollback`, `vfs_diff`, `vfs_switch_branch`, and `vfs_list_branches` are exposed through the same workspace registry and therefore through MCP schemas.

Task 16 adds `src/lib/agent/processScheduler.ts` and `logStorage.ts`. The scheduler queues non-blocking Wasm commands with bounded concurrency, persists queued/running/completed/failed/cancelled process records, supports `kill_process` cancellation signals, and marks interrupted work after a browser refresh. Structured tool, status, stdout, stderr, and error entries are retained in a separate device-local IndexedDB database. `process_schedule`, `process_status`, `process_logs`, and `process_kill` are exposed through the workspace registry and automatically appear in MCP tool schemas.

Task 18 adds production hardening under `src/lib/vfs/storageManager.ts`, `src/lib/wasm/memoryGuard.ts`, and `src/lib/system/healthCheck.ts`. Browser quota estimates are collected when supported; VFS snapshots and execution logs receive LRU pruning; POSIX and polyglot execution are bounded by timeout, abort, and memory guards; the MCP relay reconnects with capped exponential backoff and a 15-second heartbeat; and `system_health` reports secret-free storage, Wasm, process, vault, and MCP diagnostics.

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Storage entry points live under `src/lib/storage/`. `indexedDbFileSystem.ts` owns the version 2 file-and-directory database boundary and exposes `createFile`, `readFile`, `updateFile`, `deleteFile`, `createDirectory`, `deleteDirectory`, and `listTree`; the React workspace, terminal, and preview use the same service without coupling UI state to IndexedDB details.
