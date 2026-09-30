# Mobile Agentic IDE

A **mobile-first agentic development environment** built as a lightweight PWA foundation. This repository is structurally inspired by [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus), while adapting its workspace and agent-handover direction for touch-first interaction, constrained memory, and fast future session transitions.

## Baseline scope

This first scaffold intentionally contains only the runnable application shell: a mobile-safe viewport, semantic workspace surface, install metadata, a small runtime capability boundary, and reserved feature boundaries for future agent handovers. It does **not** include model providers, authentication, a code editor, IndexedDB persistence, streaming, or a production service worker.

## Development

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

The shell uses React, TypeScript, and Vite. The next implementation step is to define the session and handover state model before adding persistence or model integrations.
