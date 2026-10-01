# DOCS.md — API Reference

## Tool Registry

The canonical tool list is `src/lib/agent/workspaceTools.ts`. MCP clients receive the same list through `src/lib/mcp/mcpSchema.ts`; `mcpServer.ts` dispatches calls to `executeWorkspaceTool`.

### Workspace and Runtime Tools

| Tool | Required input | Purpose |
|---|---|---|
| `read_file` | `path` | Read one VFS file; creates a pre-operation checkpoint. |
| `write_file` | `path`, `content` | Create or replace a VFS file; creates a pre-operation checkpoint. |
| `list_files` | — | Return VFS file and directory paths. |
| `execute_command` | `command` | Run supported POSIX-style commands in the Wasm sandbox; supports `env`; creates a pre-operation checkpoint. |
| `execute_code` | `language`, `code` | Run bounded `node` or `python3` code; optional `filename`. |
| `run_tests` | — | Run the in-browser Test Matrix against current files. |

### VFS History and Branches

| Tool | Input | Purpose |
|---|---|---|
| `vfs_checkpoint` | optional `label` | Snapshot files and directories into IndexedDB. |
| `vfs_rollback` | optional `snapshotId` | Restore a selected or latest active-branch checkpoint. |
| `vfs_diff` | optional `snapshotId` | Return unified file diffs against a checkpoint. |
| `vfs_switch_branch` | `branch`: `main` or `experimental` | Select the active lightweight virtual branch. |
| `vfs_list_branches` | — | Return branch heads and the active branch. |

Snapshots are local and branch-scoped. The history layer keeps up to 50 snapshots per branch. It is not a remote Git repository and does not create Git commits.

### Background Processes and Child Tasks

| Tool | Input | Purpose |
|---|---|---|
| `process_schedule` | `command`, optional `env` | Queue a non-blocking Wasm command. |
| `process_status` | optional `processId` | Read one process or recent process records. |
| `process_logs` | optional `processId` | Read persisted tool, status, stdout, stderr, and error logs. |
| `process_kill` | `processId` | Cancel a queued or running process. |
| `spawn_sub_agent` | `prompt`, optional `systemInstructions`, optional `allowedTools[]` | Queue a bounded model-neutral child-task envelope and return its process ID. |

Child tasks are asynchronous scheduler records with explicit prompt, system instruction, and tool bounds. The current client produces a `mobile-agentic-ide.child-task.v1` dispatch envelope; a trusted provider runner may consume that envelope later. Use `process_status` and `process_logs` to track it. The scheduler limits allowed tool names to 24 entries.

### Integrations

| Tool | Input | Confirmation |
|---|---|---|
| `integration_status` | — | Reports provider availability without exposing credentials. |
| `github_clone` | `owner`, `repo`, optional `branch` | Read a repository tree. |
| `github_create_branch` | `owner`, `repo`, `branch`, optional `fromBranch` | `confirm: true` required. |
| `github_commit_vfs` | `owner`, `repo`, `branch`, `message` | `confirm: true` required. |
| `github_open_pr` | `owner`, `repo`, `head`, `base`, `title`, optional `body` | `confirm: true` required. |
| `github_list_issues` | `owner`, `repo`, optional `state` | Read issues. |
| `github_create_issue` | `owner`, `repo`, `title`, optional `body` | `confirm: true` required. |
| `google_read_doc` | `documentId` | Read Google Docs context. |
| `google_write_doc` | `documentId`, `text` | `confirm: true` required. |
| `google_export_vfs` | `name` | `confirm: true` required. |
| `integration_request` | `providerId`, `operation`, `input` | `confirm: true` required because provider operations may be external. |

## Module APIs

### `src/lib/storage`

`createFile`, `readFile`, `updateFile`, `deleteFile`, `listFiles`, `createDirectory`, `deleteDirectory`, `listDirectories`, and `listTree` provide normalized IndexedDB VFS operations.

### `src/lib/vfs`

- `diffText(path, before, after)` returns one unified file diff.
- `diffFiles(before, after)` compares file arrays.
- `vfsHistory.checkpoint(label)`, `.listSnapshots()`, `.rollback(snapshotId)`, `.diffAgainst(snapshotId)`, and `.branches()` manage local history.
- `switchBranch("main" | "experimental")` changes the active branch.

### `src/lib/agent`

- `processScheduler.schedule(command, env)` queues a Wasm command.
- `processScheduler.scheduleSubAgent(spec)` queues a bounded child envelope.
- `processScheduler.status(id?)`, `.logs(id?)`, and `.kill(id)` inspect or cancel work.
- `logStorage.saveProcess`, `.getProcess`, `.listProcesses`, `.appendLog`, `.listLogs`, and `.clearProcess` persist runtime records.

### `src/lib/mcp`

- `mcpServer.handle(request)` supports JSON-RPC `initialize`, `ping`, `tools/list`, and `tools/call`.
- `toMcpTool` and `toMcpTools` convert typed workspace definitions into MCP input schemas.
- `mcpTransport.ts` provides browser HTTP/SSE handling.
- `mcpRelay.ts` provides opt-in WebSocket relay mode; `relay-worker/` contains the Cloudflare Worker source.

### `src/lib/integrations`

`registry.ts` supports dynamic providers; `githubAdapter.ts` handles repository, branch, commit, issue, and PR operations; `googleAdapter.ts` handles Docs and Drive; `genericHttpAdapter.ts` handles custom REST/webhook requests; `tokenVault.ts` stores encrypted device-local credentials.

## Persistence and Security Notes

All workspace and runtime data is same-origin and device-local. API credentials use Web Crypto AES-GCM wrapping but are not hardware-backed. Public relay URLs behave like bearer links. Never include secrets in tool arguments that are persisted to logs, snapshots, handover payloads, or documentation.
