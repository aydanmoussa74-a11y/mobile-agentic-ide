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

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Storage entry points live under `src/lib/storage/`. `indexedDbFileSystem.ts` owns the version 2 file-and-directory database boundary and exposes `createFile`, `readFile`, `updateFile`, `deleteFile`, `createDirectory`, `deleteDirectory`, and `listTree`; the React workspace, terminal, and preview use the same service without coupling UI state to IndexedDB details.
