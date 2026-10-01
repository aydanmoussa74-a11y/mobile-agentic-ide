import { mcpServer, type JsonRpcRequest, type JsonRpcResponse } from "./mcpServer";

export type RelayStatus = "disconnected" | "connecting" | "live" | "error";
export interface RelaySnapshot { status: RelayStatus; sessionId: string | null; publicUrl: string | null; error?: string; reconnectAttempt: number; nextRetryMs: number | null; lastHeartbeatAt: number | null; }
export interface RelayConfiguration { claude: Record<string, unknown>; chatgpt: Record<string, unknown>; }

const DEFAULT_RELAY_URL = "https://mcp-relay.workers.dev";
const HEARTBEAT_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

export class McpRelayClient {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private status: RelayStatus = "disconnected";
  private error?: string;
  private enabled = false;
  private reconnectAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private nextRetryMs: number | null = null;
  private lastHeartbeatAt: number | null = null;
  private readonly listeners = new Set<(snapshot: RelaySnapshot) => void>();
  constructor(private readonly relayUrl = readRelayUrl()) {}

  getSnapshot(): RelaySnapshot { return { status: this.status, sessionId: this.sessionId, publicUrl: this.sessionId ? `${this.relayUrl}/mcp?session=${encodeURIComponent(this.sessionId)}` : null, reconnectAttempt: this.reconnectAttempt, nextRetryMs: this.nextRetryMs, lastHeartbeatAt: this.lastHeartbeatAt, ...(this.error ? { error: this.error } : {}) }; }
  subscribe(listener: (snapshot: RelaySnapshot) => void): () => void { this.listeners.add(listener); listener(this.getSnapshot()); return () => this.listeners.delete(listener); }
  getConfiguration(): RelayConfiguration | null { const snapshot = this.getSnapshot(); if (!snapshot.publicUrl) return null; return { claude: { mcpServers: { "mobile-agentic-ide": { url: snapshot.publicUrl, transport: "sse" } } }, chatgpt: { openapi: "3.1.0", info: { title: "Mobile Agentic IDE MCP Relay", version: "1.0.0" }, servers: [{ url: snapshot.publicUrl.replace("/mcp?session=", "") }], paths: { "/mcp": { post: { operationId: "mcpJsonRpc", summary: "Send MCP JSON-RPC through the relay", parameters: [{ name: "session", in: "query", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } }, responses: { "200": { description: "MCP JSON-RPC response" } } } } } } }; }

  enable(): void { if (this.enabled && (this.status === "connecting" || this.status === "live")) return; this.enabled = true; this.error = undefined; this.sessionId ??= crypto.randomUUID().replaceAll("-", "").slice(0, 24); this.reconnectAttempt = 0; this.connect(); }
  disable(): void { this.enabled = false; if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = undefined; this.nextRetryMs = null; this.stopHeartbeat(); this.socket?.close(1000, "Relay disabled by user"); this.socket = null; this.sessionId = null; this.error = undefined; this.reconnectAttempt = 0; this.setStatus("disconnected"); }

  private connect(): void { if (!this.enabled) return; if (typeof WebSocket === "undefined") { this.fail("WebSocket is unavailable in this browser."); return; } this.error = undefined; this.nextRetryMs = null; this.setStatus("connecting"); const url = `${this.relayUrl.replace(/^http/, "ws")}/ws?session=${encodeURIComponent(this.sessionId ?? "")}`; try { const socket = new WebSocket(url); this.socket = socket; socket.onopen = () => { if (socket !== this.socket) return; socket.send(JSON.stringify({ type: "register", sessionId: this.sessionId })); this.reconnectAttempt = 0; this.setStatus("live"); this.startHeartbeat(); }; socket.onmessage = (event) => { void this.handleMessage(event.data); }; socket.onerror = () => { this.error = "Unable to connect to the configured relay."; }; socket.onclose = () => { if (socket !== this.socket) return; this.socket = null; this.stopHeartbeat(); if (this.enabled) this.scheduleReconnect(); else this.setStatus("disconnected"); }; } catch (error: unknown) { this.error = error instanceof Error ? error.message : "Unable to create relay WebSocket."; this.scheduleReconnect(); } }
  private scheduleReconnect(): void { if (!this.enabled || this.retryTimer) return; const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, MAX_BACKOFF_MS); this.reconnectAttempt += 1; this.nextRetryMs = delay; this.setStatus("error"); this.retryTimer = setTimeout(() => { this.retryTimer = undefined; this.nextRetryMs = null; this.connect(); }, delay); }
  private startHeartbeat(): void { this.stopHeartbeat(); this.heartbeatTimer = setInterval(() => { if (this.socket?.readyState !== WebSocket.OPEN) return; this.lastHeartbeatAt = Date.now(); this.socket.send(JSON.stringify({ type: "ping", sessionId: this.sessionId, timestamp: this.lastHeartbeatAt })); this.emit(); }, HEARTBEAT_MS); }
  private stopHeartbeat(): void { if (this.heartbeatTimer) clearInterval(this.heartbeatTimer); this.heartbeatTimer = undefined; }
  private async handleMessage(raw: unknown): Promise<void> { let message: { type?: string; requestId?: string; request?: JsonRpcRequest }; try { message = JSON.parse(String(raw)) as typeof message; } catch { return; } if (message.type === "pong") { this.lastHeartbeatAt = Date.now(); this.emit(); return; } if (message.type !== "request" || !message.request) return; const response = await mcpServer.handle(message.request, this.sessionId ?? undefined); if (response && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "response", requestId: message.requestId, response })); }
  private fail(message: string): void { this.error = message; this.socket?.close(); this.socket = null; this.stopHeartbeat(); this.setStatus("error"); }
  private setStatus(status: RelayStatus): void { this.status = status; this.emit(); }
  private emit(): void { const snapshot = this.getSnapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}

function readRelayUrl(): string { const configured = (import.meta as { env?: { VITE_MCP_RELAY_URL?: string } }).env?.VITE_MCP_RELAY_URL; return (configured || DEFAULT_RELAY_URL).replace(/\/$/, ""); }
export const mcpRelay = new McpRelayClient();
