# ENGINEERING.md — Architecture Blueprint

## System Shape

The application is a Vite + React + TypeScript PWA optimized for touch screens, constrained memory, and offline-first operation. It keeps the primary workspace in one mobile surface and exposes deeper capabilities through tabs and progressive-disclosure panels.

```text
React mobile shell
  ├─ Workspace / Terminal / Preview / Ledger / MCP surfaces
  ├─ Agent action bar and model-neutral handover
  └─ service worker and manifest
        │
        ├─ IndexedDB VFS (`src/lib/storage`)
        │     └─ VFS history and branches (`src/lib/vfs`)
        ├─ Wasm POSIX boundary (`src/lib/wasm`)
        │     ├─ ProcessManager streams and PIDs
        │     └─ PolyglotEngine + ModuleResolver
        ├─ Agent tools (`src/lib/agent`)
        │     ├─ model bridge and failover
        │     ├─ process scheduler and log vault
        │     └─ bounded child-task envelopes
        ├─ integrations and Web Crypto vault
        └─ MCP JSON-RPC + optional WebSocket relay
```

## IndexedDB VFS

`src/lib/storage/indexedDbFileSystem.ts` owns normalized relative paths, file contents, timestamps, directories, and tree listing. It is the source of truth for local workspace state. `src/lib/vfs/vfsHistory.ts` snapshots files and directories before selected agent operations and restores them on rollback. `vfsBranching.ts` keeps lightweight `main` and `experimental` branch heads.

## Wasm POSIX Sandbox

`src/lib/wasm/wasmContainer.ts` exposes `read`, `write`, `stat`, and `readdir` over WebAssembly memory and the IndexedDB VFS. `ProcessManager` owns virtual PIDs, stream buffers, exit codes, pipeline sequencing, and isolation metrics. `PolyglotEngine` provides bounded JavaScript and Python3 bridges; it is not a native unrestricted runtime.

## Agent Runtime

`multiModelBridge.ts` normalizes OpenAI-compatible, Anthropic, and Gemini request/response shapes. `failoverHandler.ts` handles retryable provider exhaustion. `agentRunner.ts` runs a bounded tool loop and records completed turns. `processScheduler.ts` queues Wasm commands and model-neutral child-task envelopes without blocking the UI. `logStorage.ts` persists process records plus tool/status/stdout/stderr/error events so execution state survives refreshes.

## Web Crypto Vault

Provider credentials and ecosystem tokens use device-local AES-GCM wrapping with a persisted non-extractable key. This is a browser storage boundary, not hardware-backed security. Tokens must never enter logs, VFS snapshots, handover payloads, or documentation.

## Integrations

`src/lib/integrations/registry.ts` dispatches GitHub, Google Workspace, generic HTTP, and future providers. External mutations require explicit confirmation. Adapters must remain optional and must fail clearly when credentials are not configured.

## MCP and WebSocket Tunnel

`mcpServer.ts` implements JSON-RPC methods; `mcpSchema.ts` converts the workspace registry into MCP JSON Schema; `mcpTransport.ts` provides browser HTTP/SSE handling. `mcpRelay.ts` optionally connects a PWA session to the Cloudflare Worker/Durable Object relay under `relay-worker/`. Public relay URLs are bearer-style links and must remain opt-in.

## Performance and Reliability

Prefer lazy work, bounded queues, small payloads, and one IndexedDB transaction per operation. Avoid desktop multi-pane assumptions. Keep long work asynchronous, expose status, persist logs, honor cancellation, and recover interrupted processes after browser refresh. Validate every change with type-checking, production build, and focused runtime smoke tests.

## Production Hardening

`src/lib/vfs/storageManager.ts` reads `navigator.storage.estimate()` when available and prunes VFS history to 50 snapshots per branch plus the oldest execution logs beyond 100 records. VFS checkpoints already invoke branch pruning; log writes invoke asynchronous LRU cleanup. `src/lib/wasm/memoryGuard.ts` bounds POSIX and polyglot executions with a default 10-second timeout and 16 MiB combined Wasm-memory limit, while preserving abort signals and returning guarded failures instead of destabilizing the tab.

The MCP relay reconnects with exponential delays of 1, 2, 4 seconds up to 30 seconds and sends a heartbeat every 15 seconds while live. `src/lib/system/healthCheck.ts` provides a secret-free snapshot of quota metrics, Wasm memory and process metrics, scheduler counts, provider vault presence, and MCP server/relay status through `system_health`.

## Task 19 Project Loop and Safety Engine

`src/lib/vfs/projectManager.ts` owns the versioned `project.manifest.json` schema, bounded ZIP import/export, unsafe-path rejection, and secret-gated project portability. `workspaceTransaction.ts` checkpoints before multi-file writes, stages changes into the IndexedDB VFS, runs the Test Matrix, and rolls back when verification fails. `mockGateway.ts` turns `.mocks/routes.json` plus VFS JSON fixtures into a controlled fetch interceptor injected into the isolated Preview iframe.

`src/lib/security/secretScanner.ts` provides secret detection and redaction for provider-key patterns, GitHub tokens, private keys, credential assignments, and `.env` files. Handover payloads, model dispatch text, and persisted execution logs use redacted values. This is a defense-in-depth scanner, not a guarantee that arbitrary secrets can be identified.
