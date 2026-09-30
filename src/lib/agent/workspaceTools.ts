import { createFile, listDirectories, listFiles, readFile, updateFile } from "../storage";
import { runVirtualCommand } from "../../features/terminal/virtualCommands";
import type { ToolCall, ToolDefinition } from "./types";

export const workspaceTools: ToolDefinition[] = [
  { name: "read_file", description: "Read one device-local workspace file by relative path.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Create or replace one device-local workspace file.", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "list_files", description: "List device-local files and directories.", parameters: { type: "object", properties: {} } },
  { name: "execute_command", description: "Run one supported virtual terminal command against the workspace.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
];

export async function executeWorkspaceTool(call: ToolCall): Promise<string> {
  const path = typeof call.arguments.path === "string" ? call.arguments.path : "";
  if (call.name === "read_file") { const file = await readFile(path); if (!file) throw new Error(`File not found: ${path}`); return file.content; }
  if (call.name === "write_file") { const content = typeof call.arguments.content === "string" ? call.arguments.content : ""; const existing = await readFile(path); if (existing) await updateFile(path, content); else await createFile(path, content); return `wrote ${path}`; }
  if (call.name === "list_files") { const [files, directories] = await Promise.all([listFiles(), listDirectories()]); return JSON.stringify({ files: files.map((file) => file.path), directories }); }
  if (call.name === "execute_command") { if (typeof call.arguments.command !== "string") throw new Error("execute_command requires a command string"); return runVirtualCommand(call.arguments.command); }
  throw new Error(`Unsupported workspace tool: ${call.name}`);
}
