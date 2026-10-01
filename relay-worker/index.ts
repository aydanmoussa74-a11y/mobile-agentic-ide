export interface Env { MCP_RELAY_SESSIONS: DurableObjectNamespace; }

type WireRequest = { type: "request"; requestId: string; request: unknown };
type WireResponse = { type: "response"; requestId?: string; response: unknown };

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

export default { async fetch(request: Request, env: Env): Promise<Response> { const url = new URL(request.url); if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS }); if (url.pathname === "/health") return json({ ok: true, service: "mobile-agentic-ide-mcp-relay" }); if (!["/mcp", "/ws"].includes(url.pathname)) return json({ error: "Use /mcp?session=... or /ws?session=..." }, 404); const session = url.searchParams.get("session"); if (!session || !/^[a-zA-Z0-9_-]{12,64}$/.test(session)) return json({ error: "A valid relay session is required." }, 400); const id = env.MCP_RELAY_SESSIONS.idFromName(session); return env.MCP_RELAY_SESSIONS.get(id).fetch(new Request(`https://relay.internal${url.pathname}${url.search}`, request)); } } satisfies ExportedHandler<Env>;

export class McpRelaySession {
  private readonly state: DurableObjectState;
  private browser: WebSocket | null = null;
  private readonly pending = new Map<string, (response: unknown) => void>();
  private readonly sse = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  constructor(state: DurableObjectState) { this.state = state; }

  async fetch(request: Request): Promise<Response> { const url = new URL(request.url); if (url.pathname === "/ws") return this.acceptBrowserWebSocket(request); if (url.pathname === "/mcp" && request.method === "GET") return this.openSse(url.searchParams.get("session") ?? ""); if (url.pathname === "/mcp" && request.method === "POST") return this.forwardRequest(request); return json({ error: "Method not allowed" }, 405); }

  private acceptBrowserWebSocket(request: Request): Response { if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "WebSocket upgrade required" }, 426); const pair = new WebSocketPair(); const [client, server] = Object.values(pair) as [WebSocket, WebSocket]; server.accept(); this.browser?.close(1012, "Replaced by a newer browser session"); this.browser = server; server.addEventListener("message", (event) => this.onBrowserMessage(String(event.data))); server.addEventListener("close", () => { if (this.browser === server) this.browser = null; }); return new Response(null, { status: 101, webSocket: client }); }

  private async forwardRequest(request: Request): Promise<Response> { if (!this.browser) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Browser relay session is offline." } }, 503); let rpc: unknown; try { rpc = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); } const requestId = crypto.randomUUID(); const response = await new Promise<unknown>((resolve) => { this.pending.set(requestId, resolve); this.browser?.send(JSON.stringify({ type: "request", requestId, request: rpc } satisfies WireRequest)); setTimeout(() => { if (this.pending.delete(requestId)) resolve({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Browser relay timed out." } }); }, 30000); }); this.publishSse(response); return json(response); }

  private openSse(session: string): Response { const encoder = new TextEncoder(); let writer: WritableStreamDefaultWriter<Uint8Array>; const stream = new TransformStream<Uint8Array, Uint8Array>(); writer = stream.writable.getWriter(); this.sse.add(writer); writer.write(encoder.encode(`event: endpoint\ndata: /mcp?session=${encodeURIComponent(session)}\n\n`)); return new Response(stream.readable, { status: 200, headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } }); }
  private onBrowserMessage(raw: string): void { let message: WireResponse; try { message = JSON.parse(raw) as WireResponse; } catch { return; } if (message.type !== "response") return; const resolve = message.requestId ? this.pending.get(message.requestId) : undefined; if (resolve) { this.pending.delete(message.requestId); resolve(message.response); } this.publishSse(message.response); }
  private publishSse(response: unknown): void { const payload = new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(response)}\n\n`); for (const writer of this.sse) void writer.write(payload).catch(() => this.sse.delete(writer)); }
}

function json(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }
