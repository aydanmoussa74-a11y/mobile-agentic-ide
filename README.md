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

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Storage entry points live under `src/lib/storage/`. `indexedDbFileSystem.ts` owns the version 2 file-and-directory database boundary and exposes `createFile`, `readFile`, `updateFile`, `deleteFile`, `createDirectory`, `deleteDirectory`, and `listTree`; the React workspace, terminal, and preview use the same service without coupling UI state to IndexedDB details.
