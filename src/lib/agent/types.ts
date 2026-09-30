import type { VirtualFile } from "../storage";

export type ProviderId = "openai-compatible" | "anthropic" | "gemini";
export type ModelActivity = "idle" | "ready" | "working" | "failed" | "rate-limited";

export interface AgentStateDocument {
  project_name?: string;
  version?: string;
  current_phase?: string;
  current_active_task?: string;
  completed_tasks?: string[];
  next_steps?: string[];
  [key: string]: unknown;
}

export interface CodeDiff {
  path: string;
  diff: string;
  summary?: string;
}

export interface SessionHistoryEntry {
  id: string;
  role: "user" | "assistant" | "system" | "handover";
  content: string;
  createdAt: number;
}

export interface HandoverContext {
  agentState: AgentStateDocument;
  files: VirtualFile[];
  diffs: CodeDiff[];
  sessionHistory: SessionHistoryEntry[];
}

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface HandoverPromptPayload {
  format: "mobile-agentic-ide.handover.v1";
  createdAt: string;
  context: HandoverContext;
  messages: ModelMessage[];
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ModelState {
  providerId: ProviderId;
  model: string;
  activity: ModelActivity;
  configured: boolean;
  lastError?: string;
  failoverCount: number;
}

export interface ModelRequest {
  config: ProviderConfig;
  messages: ModelMessage[];
  signal?: AbortSignal;
}

export interface ModelResponse {
  providerId: ProviderId;
  model: string;
  text: string;
  raw: unknown;
}

export interface ProviderAttemptError extends Error {
  status?: number;
  providerId: ProviderId;
  retryable: boolean;
}
