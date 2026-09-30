export type AgentStatus = "idle" | "ready" | "working" | "handoff";

export interface AgentSession {
  id: string;
  title: string;
  status: AgentStatus;
  updatedAt: number;
}

export interface RuntimeCapabilities {
  isStandalone: boolean;
  supportsServiceWorker: boolean;
  prefersReducedMotion: boolean;
}
