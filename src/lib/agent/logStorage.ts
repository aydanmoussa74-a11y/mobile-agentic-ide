export type ProcessStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExecutionLogKind = "tool" | "stdout" | "stderr" | "status" | "error";
export interface StoredProcess { id: string; command: string; status: ProcessStatus; queuedAt: number; startedAt?: number; finishedAt?: number; exitCode?: number | null; error?: string; env?: Record<string, string>; taskType?: "command" | "sub-agent"; prompt?: string; systemInstructions?: string; allowedTools?: string[]; }
export interface ExecutionLog { id: string; processId: string; timestamp: number; kind: ExecutionLogKind; message: string; metadata?: Record<string, unknown>; }

const DATABASE = "mobile-agentic-ide-agent-runtime";
const VERSION = 1;
const PROCESSES = "processes";
const LOGS = "execution-logs";

export class LogStorage {
  async saveProcess(process: StoredProcess): Promise<void> { await this.request(PROCESSES, "readwrite", (store) => store.put(process)); }
  async getProcess(id: string): Promise<StoredProcess | null> { return (await this.request<StoredProcess | undefined>(PROCESSES, "readonly", (store) => store.get(id))) ?? null; }
  async listProcesses(limit = 100): Promise<StoredProcess[]> { const processes = await this.request<StoredProcess[]>(PROCESSES, "readonly", (store) => store.getAll()); return processes.sort((a, b) => b.queuedAt - a.queuedAt).slice(0, limit); }
  async appendLog(processId: string, kind: ExecutionLogKind, message: string, metadata?: Record<string, unknown>): Promise<ExecutionLog> { const log: ExecutionLog = { id: createId("log"), processId, timestamp: Date.now(), kind, message, ...(metadata ? { metadata } : {}) }; await this.request(LOGS, "readwrite", (store) => store.put(log)); void this.prune(100); return log; }
  async listLogs(processId?: string, limit = 200): Promise<ExecutionLog[]> { const logs = await this.request<ExecutionLog[]>(LOGS, "readonly", (store) => store.getAll()); return logs.filter((log) => !processId || log.processId === processId).sort((a, b) => a.timestamp - b.timestamp).slice(-limit); }
  async prune(limit = 100): Promise<number> { const logs = await this.request<ExecutionLog[]>(LOGS, "readonly", (store) => store.getAll()); const stale = logs.sort((a, b) => a.timestamp - b.timestamp).slice(0, Math.max(0, logs.length - limit)); await Promise.all(stale.map((log) => this.request(LOGS, "readwrite", (store) => store.delete(log.id)))); return stale.length; }
  async clearProcess(processId: string): Promise<void> { const logs = await this.listLogs(processId); await Promise.all(logs.map((log) => this.request(LOGS, "readwrite", (store) => store.delete(log.id)))); await this.request(PROCESSES, "readwrite", (store) => store.delete(processId)); }
  private request<T = IDBValidKey>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> { return openDatabase().then((database) => new Promise((resolve, reject) => { const transaction = database.transaction(storeName, mode); const result = operation(transaction.objectStore(storeName)); result.onsuccess = () => resolve(result.result); result.onerror = () => reject(result.error); transaction.oncomplete = () => database.close(); transaction.onerror = () => reject(transaction.error); })); }
}

function openDatabase(): Promise<IDBDatabase> { if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser.")); return new Promise((resolve, reject) => { const request = indexedDB.open(DATABASE, VERSION); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(PROCESSES)) request.result.createObjectStore(PROCESSES, { keyPath: "id" }); if (!request.result.objectStoreNames.contains(LOGS)) request.result.createObjectStore(LOGS, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function createId(prefix: string): string { return `${prefix}-${Date.now()}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`; }
export const logStorage = new LogStorage();
