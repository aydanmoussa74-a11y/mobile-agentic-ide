import type { ModelMessage, ModelRequest, ModelResponse, ProviderAttemptError, ProviderConfig } from "./types";
import type { ProviderId } from "./types";

const DEFAULT_ENDPOINTS: Record<ProviderId, string> = {
  "openai-compatible": "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
};

type FetchLike = typeof fetch;

export async function callModel(request: ModelRequest, fetcher: FetchLike = fetch): Promise<ModelResponse> {
  if (!request.config.apiKey) throw createProviderError(request.config.id, "An API key is required.");
  const prepared = buildProviderRequest(request);
  const response = await fetcher(prepared.url, prepared.init);
  const raw = await readResponse(response);
  if (!response.ok) {
    throw createProviderError(request.config.id, extractErrorMessage(raw) ?? `Provider returned HTTP ${response.status}.`, response.status);
  }
  return { providerId: request.config.id, model: request.config.model, text: extractText(request.config.id, raw), raw };
}

export function buildProviderRequest(request: ModelRequest): { url: string; init: RequestInit } {
  const { config, messages, signal } = request;
  if (config.id === "anthropic") {
    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    return {
      url: config.baseUrl ?? DEFAULT_ENDPOINTS.anthropic,
      init: { method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": config.apiKey!, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: config.model, max_tokens: 4096, system, messages: messages.filter((message) => message.role !== "system").map(toAnthropicMessage) }) },
    };
  }
  if (config.id === "gemini") {
    const endpoint = config.baseUrl ?? `${DEFAULT_ENDPOINTS.gemini}/${encodeURIComponent(config.model)}:generateContent`;
    return {
      url: `${endpoint}${endpoint.includes("?") ? "&" : "?"}key=${encodeURIComponent(config.apiKey!)}`,
      init: { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })), systemInstruction: messages.find((message) => message.role === "system") ? { parts: [{ text: messages.find((message) => message.role === "system")!.content }] } : undefined }) },
    };
  }
  return {
    url: config.baseUrl ?? DEFAULT_ENDPOINTS["openai-compatible"],
    init: { method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, messages, stream: false }) },
  };
}

function toAnthropicMessage(message: ModelMessage) {
  return { role: message.role === "assistant" ? "assistant" : "user", content: message.content };
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return text; }
}

function extractText(providerId: ProviderId, raw: unknown): string {
  if (providerId === "anthropic" && isRecord(raw) && Array.isArray(raw.content)) return raw.content.filter(isRecord).map((item) => item.text).filter((text): text is string => typeof text === "string").join("\n");
  if (providerId === "gemini" && isRecord(raw) && Array.isArray(raw.candidates)) return raw.candidates.flatMap((candidate) => isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : []).filter(isRecord).map((part) => part.text).filter((text): text is string => typeof text === "string").join("\n");
  if (isRecord(raw) && Array.isArray(raw.choices)) {
    const message = raw.choices[0];
    if (isRecord(message) && isRecord(message.message) && typeof message.message.content === "string") return message.message.content;
  }
  throw new Error("The provider response did not contain readable text.");
}

function extractErrorMessage(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (isRecord(raw)) {
    if (typeof raw.message === "string") return raw.message;
    if (isRecord(raw.error) && typeof raw.error.message === "string") return raw.error.message;
  }
  return undefined;
}

function createProviderError(providerId: ProviderId, message: string, status?: number): ProviderAttemptError {
  const error = new Error(message) as ProviderAttemptError;
  error.name = "ProviderAttemptError";
  error.providerId = providerId;
  error.status = status;
  error.retryable = status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || /rate limit|quota|exhausted|too many requests/i.test(message);
  return error;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
