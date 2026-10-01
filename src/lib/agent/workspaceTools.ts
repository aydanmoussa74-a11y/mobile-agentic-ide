import { createFile, listDirectories, listFiles, readFile, updateFile } from "../storage";
import { polyglotEngine, wasmContainer } from "../wasm";
import { githubAdapter, googleAdapter, tokenVault } from "../integrations";
import type { ToolCall, ToolDefinition } from "./types";

const confirmation = { type: "boolean", description: "Must be true to authorize an external mutation." };
export const workspaceTools: ToolDefinition[] = [
  { name: "read_file", description: "Read one device-local workspace file by relative path.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Create or replace one device-local workspace file.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "list_files", description: "List device-local files and directories.", parameters: { type: "object", properties: {} } },
  { name: "execute_command", description: "Run one supported command inside the Wasm POSIX sandbox; supports pipes and environment expansion.", parameters: { type: "object", properties: { command: { type: "string" }, env: { type: "object", additionalProperties: { type: "string" } } }, required: ["command"] } },
  { name: "execute_code", description: "Execute JavaScript with node or the supported Python3 bridge inside the Wasm sandbox.", parameters: { type: "object", properties: { language: { type: "string", enum: ["node", "python3"] }, code: { type: "string" }, filename: { type: "string" } }, required: ["language", "code"] } },
  { name: "integration_status", description: "Check whether GitHub or Google OAuth tokens are configured locally without exposing token values.", parameters: { type: "object", properties: {} } },
  { name: "github_clone", description: "Read a GitHub repository tree into a structured result for the local workspace.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, branch: { type: "string" } }, required: ["owner", "repo"] } },
  { name: "github_create_branch", description: "Create a GitHub branch. Requires explicit confirmation.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, branch: { type: "string" }, fromBranch: { type: "string" }, confirm: confirmation }, required: ["owner", "repo", "branch", "confirm"] } },
  { name: "github_commit_vfs", description: "Commit all IndexedDB VFS files to a GitHub branch. Requires explicit confirmation.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, branch: { type: "string" }, message: { type: "string" }, confirm: confirmation }, required: ["owner", "repo", "branch", "message", "confirm"] } },
  { name: "github_open_pr", description: "Open a GitHub pull request. Requires explicit confirmation.", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, head: { type: "string" }, base: { type: "string" }, title: { type: "string" }, body: { type: "string" }, confirm: confirmation }, required: ["owner", "repo", "head", "base", "title", "confirm"] } },
  { name: "google_read_doc", description: "Read text context from a Google Doc using the local Google OAuth token.", parameters: { type: "object", properties: { documentId: { type: "string" } }, required: ["documentId"] } },
  { name: "google_export_vfs", description: "Export the current IndexedDB VFS manifest to Google Drive. Requires explicit confirmation.", parameters: { type: "object", properties: { name: { type: "string" }, confirm: confirmation }, required: ["name", "confirm"] } },
];

export async function executeWorkspaceTool(call: ToolCall): Promise<string> {
  const path = typeof call.arguments.path === "string" ? call.arguments.path : "";
  if (call.name === "read_file") { const file = await readFile(path); if (!file) throw new Error(`File not found: ${path}`); return file.content; }
  if (call.name === "write_file") { const content = typeof call.arguments.content === "string" ? call.arguments.content : ""; const existing = await readFile(path); if (existing) await updateFile(path, content); else await createFile(path, content); return `wrote ${path}`; }
  if (call.name === "list_files") { const [files, directories] = await Promise.all([listFiles(), listDirectories()]); return JSON.stringify({ files: files.map((file) => file.path), directories }); }
  if (call.name === "execute_command") { if (typeof call.arguments.command !== "string") throw new Error("execute_command requires a command string"); const result = await wasmContainer.execute(call.arguments.command, { env: readEnvironment(call.arguments.env) }); if (result.exitCode !== 0) throw new Error(result.stderr || `Command exited with code ${result.exitCode}`); return result.stdout; }
  if (call.name === "execute_code") { const language = call.arguments.language === "python3" ? "python3" : call.arguments.language === "node" ? "node" : null; if (!language || typeof call.arguments.code !== "string") throw new Error("execute_code requires language=node|python3 and code"); const result = await polyglotEngine.run(language, call.arguments.code, { filename: typeof call.arguments.filename === "string" ? call.arguments.filename : language === "node" ? "index.js" : "main.py" }); if (result.exitCode !== 0) throw new Error(result.stderr || `Code exited with code ${result.exitCode}`); return result.stdout; }
  if (call.name === "integration_status") return JSON.stringify({ github: await tokenVault.has("github"), google: await tokenVault.has("google") });
  if (call.name === "github_clone") return JSON.stringify(await githubAdapter.cloneRepository(stringArg(call, "owner"), stringArg(call, "repo"), optionalString(call, "branch") ?? "main"));
  if (call.name === "github_create_branch") { requireConfirmation(call); await githubAdapter.createBranch(stringArg(call, "owner"), stringArg(call, "repo"), stringArg(call, "branch"), optionalString(call, "fromBranch") ?? "main"); return `created GitHub branch ${call.arguments.branch}`; }
  if (call.name === "github_commit_vfs") { requireConfirmation(call); return JSON.stringify(await githubAdapter.commitVfs(stringArg(call, "owner"), stringArg(call, "repo"), stringArg(call, "branch"), stringArg(call, "message"))); }
  if (call.name === "github_open_pr") { requireConfirmation(call); return JSON.stringify(await githubAdapter.openPullRequest(stringArg(call, "owner"), stringArg(call, "repo"), stringArg(call, "head"), stringArg(call, "base"), stringArg(call, "title"), optionalString(call, "body") ?? "")); }
  if (call.name === "google_read_doc") return JSON.stringify(await googleAdapter.readDocument(stringArg(call, "documentId")));
  if (call.name === "google_export_vfs") { requireConfirmation(call); return JSON.stringify(await googleAdapter.exportVfsToDrive(stringArg(call, "name"))); }
  throw new Error(`Unsupported workspace tool: ${call.name}`);
}

function stringArg(call: ToolCall, key: string): string { const value = call.arguments[key]; if (typeof value !== "string" || !value.trim()) throw new Error(`${call.name} requires ${key}`); return value.trim(); }
function optionalString(call: ToolCall, key: string): string | undefined { return typeof call.arguments[key] === "string" ? call.arguments[key] as string : undefined; }
function requireConfirmation(call: ToolCall): void { if (call.arguments.confirm !== true) throw new Error(`${call.name} is an external mutation and requires confirm: true.`); }
function readEnvironment(value: unknown): Record<string, string> | undefined { if (!value || typeof value !== "object") return undefined; return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")); }
