import { readFile } from "../storage";
import { moduleResolver } from "./moduleResolver";

export type PolyglotLanguage = "python3" | "python" | "node" | "javascript";
export interface PolyglotResult { language: PolyglotLanguage; stdout: string; stderr: string; exitCode: number; durationMs: number; modules: string[]; }
export interface PolyglotOptions { filename?: string; env?: Record<string, string>; signal?: AbortSignal; }

export class PolyglotEngine {
  readonly memory = new WebAssembly.Memory({ initial: 1, maximum: 8 });

  async runFile(language: PolyglotLanguage, path: string, options: PolyglotOptions = {}): Promise<PolyglotResult> {
    const file = await readFile(path);
    if (!file) return { language, stdout: "", stderr: `${path}: file not found`, exitCode: 1, durationMs: 0, modules: [] };
    return this.run(language, file.content, { ...options, filename: path });
  }

  async run(language: PolyglotLanguage, source: string, options: PolyglotOptions = {}): Promise<PolyglotResult> {
    const started = performance.now();
    const normalized = language === "python" ? "python3" : language === "javascript" ? "node" : language;
    const bytes = new TextEncoder().encode(source);
    new Uint8Array(this.memory.buffer).set(bytes.slice(0, this.memory.buffer.byteLength), 0);
    if (options.signal?.aborted) return { language, stdout: "", stderr: "execution aborted", exitCode: 130, durationMs: elapsed(started), modules: [] };
    try {
      const result = normalized === "python3" ? await this.runPython(source, options) : await this.runJavaScript(source, options);
      return { language, ...result, durationMs: elapsed(started) };
    } catch (error: unknown) {
      return { language, stdout: "", stderr: error instanceof Error ? error.message : "runtime error", exitCode: 1, durationMs: elapsed(started), modules: [] };
    }
  }

  private async runJavaScript(source: string, options: PolyglotOptions): Promise<Omit<PolyglotResult, "language" | "durationMs">> {
    const stdout: string[] = [];
    const modules: string[] = [];
    const moduleCache: Record<string, unknown> = {};
    const importSpecifiers = [...source.matchAll(/(?:require\(["']([^"']+)["']\)|from\s+["']([^"']+)["'])/g)].map((match) => match[1] ?? match[2]);
    for (const specifier of importSpecifiers) { const resolved = await moduleResolver.resolve(specifier, options.filename ?? "index.js"); modules.push(resolved.path); moduleCache[specifier] = resolved.content; }
    const consoleBridge = { log: (...values: unknown[]) => stdout.push(values.map(String).join(" ")), info: (...values: unknown[]) => stdout.push(values.map(String).join(" ")), warn: (...values: unknown[]) => stdout.push(`\x1b[33m${values.map(String).join(" ")}\x1b[0m`), error: (...values: unknown[]) => stdout.push(`\x1b[31m${values.map(String).join(" ")}\x1b[0m`) };
    const module = { exports: {} as Record<string, unknown> };
    const require = (specifier: string) => { if (!(specifier in moduleCache)) throw new Error(`module not preloaded: ${specifier}`); return moduleCache[specifier]; };
    // This is the lightweight QuickJS/Wasm-compatible boundary. A bundled QuickJS adapter can replace this function without changing callers.
    new Function("console", "module", "exports", "require", "process", source)(consoleBridge, module, module.exports, require, { env: options.env ?? {} });
    return { stdout: stdout.join("\n"), stderr: "", exitCode: 0, modules };
  }

  private async runPython(source: string, options: PolyglotOptions): Promise<Omit<PolyglotResult, "language" | "durationMs">> {
    const stdout: string[] = [];
    const variables: Record<string, string | number | boolean> = { ...(options.env ?? {}) };
    const modules: string[] = [];
    const lines = source.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const importMatch = line.match(/^import\s+([A-Za-z_][\w.]*)/);
      if (importMatch) { const resolved = await moduleResolver.resolve(importMatch[1].replaceAll(".", "/"), options.filename ?? "main.py"); modules.push(resolved.path); continue; }
      const assignment = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (assignment) { variables[assignment[1]] = evaluatePythonValue(assignment[2], variables); continue; }
      const printMatch = line.match(/^(?:print|sys\.stdout\.write)\((.*)\)$/);
      if (printMatch) { const value = evaluatePythonValue(printMatch[1], variables); stdout.push(String(value)); continue; }
      if (/^raise\s+/.test(line)) throw new Error(`PythonError: ${line.slice(6)}`);
      throw new Error(`Python subset bridge cannot execute: ${line}`);
    }
    return { stdout: stdout.join("\n"), stderr: "", exitCode: 0, modules };
  }
}

function evaluatePythonValue(expression: string, variables: Record<string, string | number | boolean>): string | number | boolean {
  const trimmed = expression.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1).replace(/\\n/g, "\n");
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed in variables) return variables[trimmed];
  const plus = trimmed.split("+").map((part) => evaluatePythonValue(part, variables));
  if (plus.length > 1 && plus.every((part) => typeof part === "number")) return (plus as number[]).reduce((sum, value) => sum + value, 0);
  return trimmed;
}
function elapsed(started: number): number { return Math.round((performance.now() - started) * 100) / 100; }
export const polyglotEngine = new PolyglotEngine();
