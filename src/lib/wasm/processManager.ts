export interface StreamBuffer { readonly chunks: string[]; write(value: string): void; read(): string; clear(): void; }
export interface VirtualProcess { pid: number; command: string; state: "running" | "exited"; exitCode: number | null; stdin: StreamBuffer; stdout: StreamBuffer; stderr: StreamBuffer; env: Record<string, string>; exit(code?: number): void; }
export interface ProcessSpec { name: string; args: string[]; env: Record<string, string>; run?: (process: VirtualProcess) => Promise<void>; }
export interface ProcessResult { pid: number; command: string; exitCode: number; stdout: string; stderr: string; processes: VirtualProcess[]; }

class MemoryStream implements StreamBuffer { readonly chunks: string[] = []; write(value: string): void { this.chunks.push(value); } read(): string { return this.chunks.join(""); } clear(): void { this.chunks.length = 0; } }

export class ProcessManager {
  private nextPid = 1000;
  private readonly active = new Map<number, VirtualProcess>();

  create(spec: ProcessSpec): VirtualProcess { const process: VirtualProcess = { pid: this.nextPid++, command: [spec.name, ...spec.args].join(" "), state: "running", exitCode: null, stdin: new MemoryStream(), stdout: new MemoryStream(), stderr: new MemoryStream(), env: { ...spec.env }, exit(code = 0) { process.state = "exited"; process.exitCode = code; } }; this.active.set(process.pid, process); return process; }
  get(pid: number): VirtualProcess | undefined { return this.active.get(pid); }
  list(): VirtualProcess[] { return [...this.active.values()]; }
  async execute(spec: ProcessSpec, stdin = "", signal?: AbortSignal): Promise<ProcessResult> { const process = this.create(spec); process.stdin.write(stdin); if (signal?.aborted) { process.exit(130); } else { try { await spec.run?.(process); if (process.state === "running") process.exit(0); } catch (error: unknown) { process.stderr.write(error instanceof Error ? error.message : "process failed"); process.exit(1); } } return this.result(process, [process]); }
  async executePipeline(specs: ProcessSpec[], stdin = "", signal?: AbortSignal): Promise<ProcessResult> { let input = stdin; const processes: VirtualProcess[] = []; for (const spec of specs) { const result = await this.execute(spec, input, signal); const process = result.processes[0]; processes.push(process); input = result.stdout; if (result.exitCode !== 0) return { ...result, processes }; } const last = processes[processes.length - 1]; return { pid: last.pid, command: last.command, exitCode: last.exitCode ?? 0, stdout: last.stdout.read(), stderr: processes.map((process) => process.stderr.read()).filter(Boolean).join("\n"), processes }; }
  private result(process: VirtualProcess, processes: VirtualProcess[]): ProcessResult { return { pid: process.pid, command: process.command, exitCode: process.exitCode ?? 0, stdout: process.stdout.read(), stderr: process.stderr.read(), processes }; }
}
