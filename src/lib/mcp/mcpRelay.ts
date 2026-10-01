import { mcpServer, type JsonRpcRequest, type JsonRpcResponse } from "./mcpServer";

export type RelayStatus = "disconnected" | "connecting" | "live" | "error";
export interface RelaySnapshot { status: RelayStatus; sessionId: string | null; publicUrl: string | null; error?: string; }
export interface RelayConfiguration { claude: Record<string, unknown>; chatgpt: Record<string, unknown>; }

const DEFAULT_RELAY_URL = "https://mcp-relay.workers.dev";

export class McpRelayClient {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private status: RelayStatus = "disconnected";
  private error?: string;
  private readonly listeners = new Set<(snapshot: RelaySnapshot) => void>();
  constructor(private readonly relayUrl = readRelayUrl()) {}

  getSnapshot(): RelaySnapshot { return { status: this.status, sessionId: this.sessionId, publicUrl: this.sessionId ? `${this.relayUrl}/mcp?session=${encodeURIComponent(this.sessionId)}` : null, ...(this.error ? { error: this.error } : {}) }; }
  subscribe(listener: (snapshot: RelaySnapshot) => void): () => void { this.listeners.add(listener); listener(this.getSnapshot()); return () => this.listeners.delete(listener); }
  getConfiguration(): RelayConfiguration | null { const snapshot = this.getSnapshot(); if (!snapshot.publicUrl) return null; return { claude: { mcpServers: { "mobile-agentic-ide": { url: snapshot.publicUrl, transport: "sse" } } }, chatgpt: { openapi: "3.1.0", info: { title: "Mobile Agentic IDE MCP Relay", version: "1.0.0" }, servers: [{ url: snapshot.publicUrl.replace("/mcp?session=", "") }], paths: { "/mcp": { post: { operationId: "mcpJsonRpc", summary: "Send MCP JSON-RPC through the relay", parameters: [{ name: "session", in: "query", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } }, responses: { "200": { description: "MCP JSON-RPC response" } } } } } } }; }

  enable(): void { if (this.status === "connecting" || this.status === "live") return; this.error = undefined; this.sessionId = crypto.randomUUID().replaceAll("-", "").slice(0, 24); this.setStatus("connecting"); if (typeof WebSocket === "undefined") { this.fail("WebSocket is unavailable in this browser."); return; } const url = `${this.relayUrl.replace(/^http/, "ws")}/ws?session=${encodeURIComponent(this.sessionId)}`; try { this.socket = new WebSocket(url); this.socket.onopen = () => { this.socket?.send(JSON.stringify({ type: "register", sessionId: this.sessionId })); this.setStatus("live"); }; this.socket.onmessage = (event) => { void this.handleMessage(event.data); }; this.socket.onerror = () => this.fail("Unable to connect to the configured relay."); this.socket.onclose = () => { this.socket = null; if (this.status !== "error") this.setStatus("disconnected"); }; } catch (error: unknown) { this.fail(error instanceof Error ? error.message : "Unable to create relay WebSocket."); } }
  disable(): void { this.socket?.close(1000, "Relay disabled by user"); this.socket = null; this.sessionId = null; this.error = undefined; this.setStatus("disconnected"); }
  private async handleMessage(raw: unknown): Promise<void> { let message: { type?: string; requestId?: string; request?: JsonRpcRequest }; try { message = JSON.parse(String(raw)) as typeof message; } catch { return; } if (message.type !== "request" || !message.request) return; const response = await mcpServer.handle(message.request, this.sessionId ?? undefined); if (response && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "response", requestId: message.requestId, response })); }
  private fail(message: string): void { this.error = message; this.socket?.close(); this.socket = null; this.setStatus("error"); }
  private setStatus(status: RelayStatus): void { this.status = status; const snapshot = this.getSnapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}

function readRelayUrl(): string { const configured = import.meta.env.VITE_MCP_RELAY_URL; return (configured || DEFAULT_RELAY_URL).replace(/\/$/, ""); }
export const mcpRelay = new McpRelayClient();
