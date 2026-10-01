import type { ToolDefinition } from "../agent/types";

export interface McpTool { name: string; description: string; inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; [key: string]: unknown }; }

export function toMcpTool(tool: ToolDefinition): McpTool { const parameters = tool.parameters; const properties = isRecord(parameters.properties) ? parameters.properties : {}; const required = Array.isArray(parameters.required) ? parameters.required.filter((value): value is string => typeof value === "string") : undefined; return { name: tool.name, description: tool.description, inputSchema: { type: "object", properties, ...(required?.length ? { required } : {}) } }; }
export function toMcpTools(tools: ToolDefinition[]): McpTool[] { return tools.map(toMcpTool); }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
