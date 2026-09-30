import { callModel } from "./multiModelBridge";
import type { ModelMessage, ModelResponse, ModelState, ProviderConfig, ProviderId, ToolDefinition } from "./types";

export interface FailoverResult {
  response: ModelResponse;
  state: ModelState;
  attemptedProviders: ProviderId[];
}

export async function callWithFailover(
  providers: ProviderConfig[],
  messages: ModelMessage[],
  activeProviderId: ProviderId,
  onStateChange?: (state: ModelState) => void,
  tools?: ToolDefinition[],
): Promise<FailoverResult> {
  const ordered = rotateProviders(providers, activeProviderId);
  const attemptedProviders: ProviderId[] = [];
  let lastError: unknown;
  for (let index = 0; index < ordered.length; index += 1) {
    const provider = ordered[index];
    attemptedProviders.push(provider.id);
    onStateChange?.({ providerId: provider.id, model: provider.model, activity: "working", configured: Boolean(provider.apiKey), failoverCount: index });
    try {
      const response = await callModel({ config: provider, messages, tools });
      const state: ModelState = { providerId: provider.id, model: provider.model, activity: "ready", configured: true, failoverCount: index };
      onStateChange?.(state);
      return { response, state, attemptedProviders };
    } catch (error: unknown) {
      lastError = error;
      const retryable = isFailoverError(error);
      onStateChange?.({ providerId: provider.id, model: provider.model, activity: retryable ? "rate-limited" : "failed", configured: Boolean(provider.apiKey), lastError: error instanceof Error ? error.message : "Provider request failed.", failoverCount: index });
      if (!retryable) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All configured model providers failed.");
}

export function isFailoverError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: number; retryable?: boolean; message?: string };
  return candidate.status === 429 || candidate.retryable === true || /rate limit|quota|exhausted|too many requests|resource exhausted/i.test(candidate.message ?? "");
}

function rotateProviders(providers: ProviderConfig[], activeProviderId: ProviderId): ProviderConfig[] {
  const configured = providers.filter((provider) => Boolean(provider.apiKey));
  const activeIndex = configured.findIndex((provider) => provider.id === activeProviderId);
  return activeIndex < 0 ? configured : [...configured.slice(activeIndex), ...configured.slice(0, activeIndex)];
}
