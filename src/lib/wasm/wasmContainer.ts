import { createDirectory, createFile, deleteDirectory, deleteFile, listDirectories, listFiles, readFile, updateFile } from "../storage";
import { ProcessManager, type ProcessResult, type ProcessSpec } from "./processManager";

export interface PosixStat { path: string; kind: "file" | "directory"; size: number; mode: number; }
export interface WasmCommandOptions { env?: Record<string, string>; stdin?: string; signal?: AbortSignal; }

export class WasmContainer {
  readonly memory = new WebAssembly.Memory({ initial: 2, maximum: 16 });
  readonly processes = new ProcessManager();
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  async read(path: string, pointer = 0, length?: number): Promise<number> {
    const file = await readFile(path);
    if (!file) throw new Error(`read: ${path}: no such file`);
    const bytes = this.encoder.encode(file.content);
    const slice = bytes.slice(0, length ?? bytes.length);
    new Uint8Array(this.memory.buffer).set(slice, pointer);
    return slice.length;
  }

  async write(path: string, pointer: number, length: number, append = false): Promise<number> {
    const bytes = new Uint8Array(this.memory.buffer).slice(pointer, pointer + length);
    const content = this.decoder.decode(bytes);
    const existing = await readFile(path);
    if (existing) await updateFile(path, append ? existing.content + content : content);
    else await createFile(path, content);
    return length;
  }

  async stat(path: string): Promise<PosixStat> {
    const normalized = path.replace(/^\.\//, "").replace(/\/$/, "");
    const file = await readFile(normalized);
    if (file) return { path: normalized, kind: "file", size: this.encoder.encode(file.content).length, mode: 0o644 };
    const directories = await listDirectories();
    if (directories.includes(normalized) || normalized === ".") return { path: normalized, kind: "directory", size: 0, mode: 0o755 };
    throw new Error(`stat: ${path}: no such file or directory`);
  }

  async readdir(path = "."): Promise<string[]> {
    const prefix = path === "." || !path ? "" : `${path.replace(/\/$/, "")}/`;
    const [files, directories] = await Promise.all([listFiles(), listDirectories()]);
    const entries = [...directories.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.slice(prefix.length).split("/")[0]), ...files.filter((file) => file.path.startsWith(prefix)).map((file) => file.path.slice(prefix.length).split("/")[0])];
    return [...new Set(entries)].filter(Boolean).sort();
  }

  async mkdir(path: string): Promise<void> { await createDirectory(path); }
  async remove(path: string, recursive = false): Promise<void> { const file = await readFile(path); if (file) return deleteFile(path); if (recursive) return deleteDirectory(path); throw new Error(`rm: ${path}: is a directory or does not exist (use -r)`); }

  async execute(command: string, options: WasmCommandOptions = {}): Promise<ProcessResult> {
    const specs = splitPipeline(command).map((segment) => this.createSpec(segment, options));
    return this.processes.executePipeline(specs, options.stdin ?? "", options.signal);
  }

  private createSpec(command: string, options: WasmCommandOptions): ProcessSpec {
    const expanded = expandEnvironment(command, { ...defaultEnvironment(), ...options.env });
    const [name, ...args] = tokenize(expanded);
    return { name, args, env: { ...defaultEnvironment(), ...options.env }, run: async (process) => this.runCommand(name, args, process) };
  }

  private async runCommand(name: string, args: string[], process: Parameters<NonNullable<ProcessSpec["run"]>>[0]): Promise<void> {
    const write = (text: string) => process.stdout.write(text);
    const fail = (text: string, code = 1) => { process.stderr.write(`\x1b[31m${text}\x1b[0m\n`); process.exit(code); };
    try {
      if (name === "") return;
      if (name === "echo") return write(`${args.join(" ")}\n`);
      if (name === "pwd") return write("/workspace\n");
      if (name === "help") return write("ls cat mkdir rm pwd echo env node git\n");
      if (name === "env") return write(`${Object.entries(process.env).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
      if (name === "ls") return write(`${(await this.readdir(args[0] ?? ".")).join("  ") || "(empty)"}\n`);
      if (name === "cat") { if (!args[0]) return fail("cat: missing file path"); const file = await readFile(args[0]); if (!file) return fail(`cat: ${args[0]}: file not found`); return write(`${file.content}\n`); }
      if (name === "mkdir") { if (!args[0]) return fail("mkdir: missing directory path"); await this.mkdir(args[0]); return write(`created directory ${args[0]}\n`); }
      if (name === "rm") { const path = args.find((arg) => !arg.startsWith("-")); if (!path) return fail("rm: missing path"); await this.remove(path, args.includes("-r") || args.includes("-rf")); return write(`removed ${path}\n`); }
      if (name === "node" && args[0] === "run") { const file = await readFile(args[1] ?? ""); if (!file) return fail(`node: ${args[1] ?? ""}: file not found`); return write(`${executeJavaScript(file.content)}\n`); }
      if (name === "git" && args[0] === "status") { const files = await listFiles(); return write(`On mobile-local workspace\n${files.length} tracked file${files.length === 1 ? "" : "s"} in IndexedDB\nNo remote repository is attached.\n`); }
      fail(`${name}: command not found`);
    } catch (error: unknown) { fail(error instanceof Error ? error.message : "command failed"); }
  }
}

function defaultEnvironment(): Record<string, string> { return { HOME: "/workspace", PWD: "/workspace", PATH: "/bin:/usr/bin", SHELL: "/bin/sh", TERM: "xterm-256color" }; }
function expandEnvironment(command: string, env: Record<string, string>): string { return command.replace(/\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g, (_, braced, plain) => env[braced ?? plain] ?? ""); }
function tokenize(command: string): string[] { return command.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g)?.map((token) => token.replace(/^['"]|['"]$/g, "")) ?? []; }
function splitPipeline(command: string): string[] { return command.split(/\s*\|\s*/).map((segment) => segment.trim()).filter(Boolean); }
function executeJavaScript(source: string): string { const output: string[] = []; const safeConsole = { log: (...values: unknown[]) => output.push(values.map(String).join(" ")), warn: (...values: unknown[]) => output.push(`warn: ${values.map(String).join(" ")}`), error: (...values: unknown[]) => output.push(`error: ${values.map(String).join(" ")}`) }; try { new Function("console", source)(safeConsole); return output.join("\n") || "(node run completed with no console output)"; } catch (error: unknown) { throw new Error(`node run: ${error instanceof Error ? error.message : "script failed"}`); } }

export const wasmContainer = new WasmContainer();
