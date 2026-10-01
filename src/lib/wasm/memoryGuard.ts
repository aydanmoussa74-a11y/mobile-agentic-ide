export interface MemoryGuardOptions { timeoutMs?: number; maxMemoryBytes?: number; label?: string; signal?: AbortSignal; }
export interface MemoryGuardSnapshot { bytes: number; limit: number; label: string; }

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_MEMORY_BYTES = 16 * 1024 * 1024;

export class MemoryGuardError extends Error { readonly code: "TIMEOUT" | "MEMORY_LIMIT" | "ABORTED"; constructor(code: MemoryGuardError["code"], message: string) { super(message); this.name = "MemoryGuardError"; this.code = code; } }

export function memoryBytes(memories: WebAssembly.Memory[]): number { return memories.reduce((total, memory) => total + memory.buffer.byteLength, 0); }
export function guardSnapshot(memories: WebAssembly.Memory[], options: MemoryGuardOptions = {}): MemoryGuardSnapshot { const bytes = memoryBytes(memories); const limit = options.maxMemoryBytes ?? DEFAULT_MAX_MEMORY_BYTES; return { bytes, limit, label: options.label ?? "Wasm execution" }; }

export async function withMemoryGuard<T>(task: () => Promise<T>, memories: WebAssembly.Memory[], options: MemoryGuardOptions = {}): Promise<T> {
  const initial = guardSnapshot(memories, options); if (initial.bytes > initial.limit) throw new MemoryGuardError("MEMORY_LIMIT", `${initial.label} exceeded the ${initial.limit} byte memory limit before execution.`);
  if (options.signal?.aborted) throw new MemoryGuardError("ABORTED", `${initial.label} was aborted.`);
  let timer: ReturnType<typeof setTimeout> | undefined; let abortHandler: (() => void) | undefined;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new MemoryGuardError("TIMEOUT", `${initial.label} exceeded the ${timeoutMs}ms execution timeout.`)), timeoutMs); });
  const aborted = new Promise<never>((_, reject) => { abortHandler = () => reject(new MemoryGuardError("ABORTED", `${initial.label} was aborted.`)); options.signal?.addEventListener("abort", abortHandler, { once: true }); });
  try { const result = await Promise.race([task(), timeout, aborted]); const final = guardSnapshot(memories, options); if (final.bytes > final.limit) throw new MemoryGuardError("MEMORY_LIMIT", `${final.label} exceeded the ${final.limit} byte memory limit.`); return result; } finally { if (timer) clearTimeout(timer); if (abortHandler) options.signal?.removeEventListener("abort", abortHandler); }
}

export const memoryGuardDefaults = { timeoutMs: DEFAULT_TIMEOUT_MS, maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES } as const;
