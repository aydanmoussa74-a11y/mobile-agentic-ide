import { executeWorkspaceTool, workspaceTools } from "../agent/workspaceTools";
import { toMcpTools } from "./mcpSchema";

export interface JsonRpcRequest { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown>; }
export interface JsonRpcResponse { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown }; }
export interface McpServerStatus { status: "ready" | "initialized"; connectedClients: number; handledRequests: number; endpoint: string; }

const PROTOCOL_VERSION = "2024-11-05";
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export class McpServer {
  private initialized = false;
  private clients = new Set<string>();
  private handledRequests = 0;
  constructor(public readonly name = "mobile-agentic-ide", public readonly version = "0.1.0-alpha") {}

  connect(clientId: string): void { this.clients.add(clientId); }
  disconnect(clientId: string): void { this.clients.delete(clientId); }
  getStatus(endpoint = "/mcp"): McpServerStatus { return { status: this.initialized ? "initialized" : "ready", connectedClients: this.clients.size, handledRequests: this.handledRequests, endpoint }; }

  async handle(input: JsonRpcRequest | string, clientId?: string): Promise<JsonRpcResponse | null> {
    this.handledRequests += 1;
    if (clientId) this.connect(clientId);
    let request: JsonRpcRequest;
    try { request = typeof input === "string" ? JSON.parse(input) as JsonRpcRequest : input; } catch { return this.error(null, PARSE_ERROR, "Parse error"); }
    if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") return this.error(request?.id ?? null, INVALID_REQUEST, "Invalid Request");
    const isNotification = request.id === undefined;
    try {
      const result = await this.dispatch(request.method, request.params ?? {}, clientId);
      return isNotification ? null : { jsonrpc: "2.0", id: request.id ?? null, result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal error";
      return isNotification ? null : this.error(request.id ?? null, this.codeFor(message), message);
    }
  }

  private async dispatch(method: string, params: Record<string, unknown>, clientId?: string): Promise<unknown> {
    if (method === "initialize") { this.initialized = true; if (clientId) this.connect(clientId); return { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: this.name, version: this.version }, instructions: "Use tools/list to discover the local VFS, Wasm, testing, and ecosystem tools. External mutations require their explicit confirmation arguments." }; }
    if (method === "ping") return {};
    if (method === "tools/list") return { tools: toMcpTools(workspaceTools) };
    if (method === "tools/call") { const name = params.name; if (typeof name !== "string") throw new Error("tools/call requires a tool name"); const tool = workspaceTools.find((candidate) => candidate.name === name); if (!tool) throw new Error(`Unknown tool: ${name}`); const result = await executeWorkspaceTool({ id: `mcp-${Date.now()}`, name: tool.name, arguments: isRecord(params.arguments) ? params.arguments : {} }); return { content: [{ type: "text", text: result }], isError: false }; }
    throw new Error(`Method not found: ${method}`);
  }

  private error(id: string | number | null, code: number, message: string): JsonRpcResponse { return { jsonrpc: "2.0", id, error: { code, message } }; }
  private codeFor(message: string): number { if (message.startsWith("Method not found")) return METHOD_NOT_FOUND; if (message.includes("requires") || message.startsWith("Unknown tool")) return INVALID_PARAMS; return INTERNAL_ERROR; }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export const mcpServer = new McpServer();
