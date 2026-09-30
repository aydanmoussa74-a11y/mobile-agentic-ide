# Mobile Agentic IDE

A **mobile-first agentic development environment** built as a lightweight PWA foundation. This repository is structurally inspired by [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus), while adapting its workspace and agent-handover direction for touch-first interaction, constrained memory, and fast future session transitions.

## Current scope

The app includes a mobile-safe workspace shell, a device-local virtual file system backed by IndexedDB, and an Agent Ledger tab. Files can be created, opened, edited, saved, deleted, and listed without a server; they remain available after a browser reload in the same origin.

The orchestration boundary under `src/lib/agent/` provides:

- `handoverEngine.ts` — exports and imports `mobile-agentic-ide.handover.v1` payloads containing `.agent_state.json` context, files, code diffs, session history, and model-neutral messages.
- `multiModelBridge.ts` — one fetch interface with OpenAI-compatible chat completions, Anthropic Messages, and Google Gemini `generateContent` request/response adapters.
- `failoverHandler.ts` — rotates through configured providers on HTTP 429, quota/rate-limit, exhaustion, and retryable upstream errors.
- `providerVault.ts` — stores API keys in a separate device-local IndexedDB store and never renders saved values. Browser storage is not hardware-backed secret storage; production deployments should proxy model calls through a trusted backend.

The Agent Ledger exposes the active model state, local provider-key setup, and a One-Tap Handover clipboard action. Authentication, streaming handovers, a full code editor, and production offline synchronization remain future slices.

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Storage entry points live under `src/lib/storage/`. `indexedDbFileSystem.ts` owns the file database boundary and exposes `createFile`, `readFile`, `updateFile`, `deleteFile`, and `listTree`; the React workspace uses the same service without coupling UI state to IndexedDB details.
