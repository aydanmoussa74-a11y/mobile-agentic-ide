import { createFile, listDirectories, listFiles, readFile, updateFile } from "../storage";
import { polyglotEngine, wasmContainer } from "../wasm";
import type { ToolCall, ToolDefinition } from "./types";

export const workspaceTools: ToolDefinition[] = [
  { name: "read_file", description: "Read one device-local workspace file by relative path.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Create or replace one device-local workspace file.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "list_files", description: "List device-local files and directories.", parameters: { type: "object", properties: {} } },
  { name: "execute_command", description: "Run one supported command inside the Wasm POSIX sandbox; supports pipes and environment expansion.", parameters: { type: "object", properties: { command: { type: "string" }, env: { type: "object", additionalProperties: { type: "string" } } }, required: ["command"] } },
  { name: "execute_code", description: "Execute JavaScript with node or the supported Python3 bridge inside the Wasm sandbox.", parameters: { type: "object", properties: { language: { type: "string", enum: ["node", "python3"] }, code: { type: "string" }, filename: { type: "string" } }, required: ["language", "code"] } },
];

export async function executeWorkspaceTool(call: ToolCall): Promise<string> {
  const path = typeof call.arguments.path === "string" ? call.arguments.path : "";
  if (call.name === "read_file") { const file = await readFile(path); if (!file) throw new Error(`File not found: ${path}`); return file.content; }
  if (call.name === "write_file") { const content = typeof call.arguments.content === "string" ? call.arguments.content : ""; const existing = await readFile(path); if (existing) await updateFile(path, content); else await createFile(path, content); return `wrote ${path}`; }
  if (call.name === "list_files") { const [files, directories] = await Promise.all([listFiles(), listDirectories()]); return JSON.stringify({ files: files.map((file) => file.path), directories }); }
  if (call.name === "execute_command") { if (typeof call.arguments.command !== "string") throw new Error("execute_command requires a command string"); const result = await wasmContainer.execute(call.arguments.command, { env: readEnvironment(call.arguments.env) }); if (result.exitCode !== 0) throw new Error(result.stderr || `Command exited with code ${result.exitCode}`); return result.stdout; }
  if (call.name === "execute_code") { const language = call.arguments.language === "python3" ? "python3" : call.arguments.language === "node" ? "node" : null; if (!language || typeof call.arguments.code !== "string") throw new Error("execute_code requires language=node|python3 and code"); const result = await polyglotEngine.run(language, call.arguments.code, { filename: typeof call.arguments.filename === "string" ? call.arguments.filename : language === "node" ? "index.js" : "main.py" }); if (result.exitCode !== 0) throw new Error(result.stderr || `Code exited with code ${result.exitCode}`); return result.stdout; }
  throw new Error(`Unsupported workspace tool: ${call.name}`);
}

function readEnvironment(value: unknown): Record<string, string> | undefined { if (!value || typeof value !== "object") return undefined; return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")); }
