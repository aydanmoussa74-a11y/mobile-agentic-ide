import { mcpServer, type JsonRpcRequest, type JsonRpcResponse, type McpServer } from "./mcpServer";

export interface McpTransportOptions { endpoint?: string; server?: McpServer; }

export class McpHttpSseTransport {
  readonly endpoint: string;
  private readonly server: McpServer;
  private readonly streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  private readonly encoder = new TextEncoder();

  constructor(options: McpTransportOptions = {}) { this.endpoint = options.endpoint ?? "/mcp"; this.server = options.server ?? mcpServer; }

  async handle(request: Request): Promise<Response> {
    const originHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: originHeaders });
    if (request.method === "GET") return this.openSse(originHeaders);
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: originHeaders });
    const sessionId = request.headers.get("Mcp-Session-Id") ?? new URL(request.url).searchParams.get("sessionId") ?? crypto.randomUUID();
    this.server.connect(sessionId);
    let body: JsonRpcRequest | string;
    try { body = await request.json() as JsonRpcRequest; } catch { body = ""; }
    const response = await this.server.handle(body, sessionId);
    if (response) this.publish(sessionId, response);
    return new Response(response ? JSON.stringify(response) : null, { status: 200, headers: { ...originHeaders, "Content-Type": "application/json", "Mcp-Session-Id": sessionId } });
  }

  close(sessionId: string): void { const controller = this.streams.get(sessionId); controller?.close(); this.streams.delete(sessionId); this.server.disconnect(sessionId); }
  private openSse(headers: Record<string, string>): Response { const sessionId = crypto.randomUUID(); this.server.connect(sessionId); const stream = new ReadableStream<Uint8Array>({ start: (controller) => { this.streams.set(sessionId, controller); controller.enqueue(this.encoder.encode(`event: endpoint\ndata: ${this.endpoint}?sessionId=${encodeURIComponent(sessionId)}\n\n`)); }, cancel: () => this.close(sessionId) }); return new Response(stream, { status: 200, headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Mcp-Session-Id": sessionId } }); }
  private publish(sessionId: string, message: JsonRpcResponse): void { const controller = this.streams.get(sessionId); if (controller) controller.enqueue(this.encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`)); }
}

export const mcpTransport = new McpHttpSseTransport();
