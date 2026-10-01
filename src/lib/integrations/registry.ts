export interface IntegrationProvider { id: string; label: string; capabilities: string[]; invoke(operation: string, input: Record<string, unknown>): Promise<unknown>; }

const providers = new Map<string, IntegrationProvider>();

export function registerIntegration(provider: IntegrationProvider): void { if (!/^[a-z0-9][a-z0-9-._]*$/.test(provider.id)) throw new Error(`Invalid integration provider id: ${provider.id}`); providers.set(provider.id, provider); }
export function unregisterIntegration(id: string): boolean { return providers.delete(id); }
export function getIntegration(id: string): IntegrationProvider { const provider = providers.get(id); if (!provider) throw new Error(`Integration provider is not registered: ${id}`); return provider; }
export function listIntegrations(): Array<Pick<IntegrationProvider, "id" | "label" | "capabilities">> { return [...providers.values()].map(({ id, label, capabilities }) => ({ id, label, capabilities: [...capabilities] })); }
export async function invokeIntegration(providerId: string, operation: string, input: Record<string, unknown> = {}): Promise<unknown> { return getIntegration(providerId).invoke(operation, input); }
