# Mobile Agentic IDE

A **mobile-first agentic development environment** built as a lightweight PWA foundation. This repository is structurally inspired by [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus), while adapting its workspace and agent-handover direction for touch-first interaction, constrained memory, and fast future session transitions.

## Current scope

The app includes a mobile-safe workspace shell and a device-local virtual file system backed by IndexedDB. Files can be created, opened, edited, saved, deleted, and listed without a server; they remain available after a browser reload in the same origin. Model providers, authentication, streaming handovers, a full code editor, and production offline synchronization remain future slices.

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Storage entry points live under `src/lib/storage/`. `indexedDbFileSystem.ts` owns the database boundary and exposes `createFile`, `readFile`, `updateFile`, `deleteFile`, and `listTree`; the React workspace uses the same service without coupling UI state to IndexedDB details.
