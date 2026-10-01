import { wasmContainer } from "../wasm";
import { logStorage, type ProcessStatus, type StoredProcess, type ExecutionLog } from "./logStorage";

export interface ScheduledProcess extends StoredProcess { }

export class ProcessScheduler {
  private readonly queue: string[] = [];
  private readonly controllers = new Map<string, AbortController>();
  private readonly cancelled = new Set<string>();
  private active = 0;
  private hydrated = false;
  private readonly hydration = this.rehydrate();
  constructor(private readonly concurrency = 2) {}

  async schedule(command: string, env?: Record<string, string>): Promise<ScheduledProcess> { await this.hydration; if (!command.trim()) throw new Error("process_schedule requires a command."); const process: ScheduledProcess = { id: createId("proc"), command: command.trim(), status: "queued", queuedAt: Date.now(), exitCode: null, ...(env ? { env } : {}) }; await logStorage.saveProcess(process); await logStorage.appendLog(process.id, "tool", "Process scheduled", { command: process.command }); this.queue.push(process.id); void this.pump(); return process; }
  async status(processId?: string): Promise<ScheduledProcess | ScheduledProcess[]> { await this.hydration; if (processId) { const process = await logStorage.getProcess(processId); if (!process) throw new Error(`Unknown process: ${processId}`); return process; } return logStorage.listProcesses(); }
  async logs(processId?: string): Promise<ExecutionLog[]> { await this.hydration; return logStorage.listLogs(processId); }
  async kill(processId: string): Promise<ScheduledProcess> { await this.hydration; const process = await logStorage.getProcess(processId); if (!process) throw new Error(`Unknown process: ${processId}`); if (process.status === "completed" || process.status === "failed" || process.status === "cancelled") return process; this.cancelled.add(processId); this.controllers.get(processId)?.abort(); const cancelled: ScheduledProcess = { ...process, status: "cancelled", finishedAt: Date.now(), exitCode: 130, error: "Killed by user." }; await logStorage.saveProcess(cancelled); await logStorage.appendLog(processId, "status", "Process killed", { signal: "kill_process" }); return cancelled; }

  private async rehydrate(): Promise<void> { const processes = await logStorage.listProcesses(); for (const process of processes) { if (process.status === "queued" || process.status === "running") { const interruption = "Interrupted by browser refresh."; const interrupted: StoredProcess = { ...process, status: "failed", finishedAt: Date.now(), exitCode: 1, error: interruption }; await logStorage.saveProcess(interrupted); await logStorage.appendLog(process.id, "error", interruption); } } this.hydrated = true; }
  private async pump(): Promise<void> { await this.hydration; while (this.active < this.concurrency && this.queue.length) { const processId = this.queue.shift()!; const process = await logStorage.getProcess(processId); if (!process || process.status !== "queued" || this.cancelled.has(processId)) continue; this.active += 1; void this.run(process).finally(() => { this.active -= 1; void this.pump(); }); } }
  private async run(process: StoredProcess): Promise<void> { const controller = new AbortController(); this.controllers.set(process.id, controller); const running: StoredProcess = { ...process, status: "running", startedAt: Date.now() }; await logStorage.saveProcess(running); await logStorage.appendLog(process.id, "status", "Process started", { command: process.command }); try { const result = await wasmContainer.execute(process.command, { env: process.env, signal: controller.signal }); const killed = this.cancelled.has(process.id) || controller.signal.aborted; const status: ProcessStatus = killed ? "cancelled" : result.exitCode === 0 ? "completed" : "failed"; const finished: StoredProcess = { ...running, status, finishedAt: Date.now(), exitCode: killed ? 130 : result.exitCode, ...(result.stderr ? { error: result.stderr } : {}) }; await logStorage.saveProcess(finished); if (result.stdout) await logStorage.appendLog(process.id, "stdout", result.stdout); if (result.stderr) await logStorage.appendLog(process.id, "stderr", result.stderr); await logStorage.appendLog(process.id, status === "failed" ? "error" : "status", killed ? "Process cancelled" : `Process ${status}`, { exitCode: finished.exitCode }); } catch (error: unknown) { const message = error instanceof Error ? error.message : "Process execution failed."; const failed: StoredProcess = { ...running, status: this.cancelled.has(process.id) ? "cancelled" : "failed", finishedAt: Date.now(), exitCode: this.cancelled.has(process.id) ? 130 : 1, error: message }; await logStorage.saveProcess(failed); await logStorage.appendLog(process.id, "error", message); } finally { this.controllers.delete(process.id); } }
}

function createId(prefix: string): string { return `${prefix}-${Date.now()}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`; }
export const processScheduler = new ProcessScheduler();
