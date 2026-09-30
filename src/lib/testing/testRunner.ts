import { listFiles } from "../storage";
import type { VirtualFile } from "../storage";

export type TestStatus = "passed" | "failed" | "skipped";
export interface TestCaseResult { id: string; label: string; status: TestStatus; durationMs: number; details: string; stack?: string; }
export interface TestRunResult { startedAt: string; completedAt: string; passed: boolean; tests: TestCaseResult[]; logs: string[]; }

export async function runVirtualTests(snapshot?: VirtualFile[]): Promise<TestRunResult> {
  const started = new Date();
  const files = snapshot ?? await listFiles();
  const logs = [`Loaded ${files.length} file${files.length === 1 ? "" : "s"} from IndexedDB.`];
  const tests: TestCaseResult[] = [];
  tests.push(runCase("filesystem-readable", "IndexedDB filesystem is readable", () => { if (!Array.isArray(files)) throw new Error("Filesystem snapshot was not an array."); return `${files.length} files available`; }));
  tests.push(runCase("workspace-files-nonempty", "Workspace files have valid paths and content", () => { const invalid = files.find((file) => !file.path || typeof file.content !== "string"); if (invalid) throw new Error(`Invalid file record: ${invalid.path}`); return files.length ? "All file records are valid" : "Empty workspace is valid"; }));
  tests.push(...files.filter((file) => /\.(ts|tsx)$/.test(file.path)).map((file) => runCase(`typescript:${file.path}`, `TypeScript syntax · ${file.path}`, () => verifyTypeScriptSyntax(file))));
  const htmlFile = files.find((file) => file.path === "index.html");
  tests.push(runCase("preview-entry", "Preview entrypoint is structurally valid", () => { if (!htmlFile) return "No index.html yet; preview check skipped"; if (!/<[a-z][\s\S]*>/i.test(htmlFile.content)) throw new Error("index.html contains no HTML element."); return "index.html contains HTML markup"; }, !htmlFile));
  for (const file of files.filter((candidate) => /\.test\.(js|mjs)$/.test(candidate.path))) tests.push(runCase(`unit:${file.path}`, `Unit assertions · ${file.path}`, () => executeUnitFile(file)));
  logs.push(...tests.map((test) => `${test.status.toUpperCase()} ${test.label} — ${test.details}`));
  const failed = tests.filter((test) => test.status === "failed");
  logs.push(failed.length ? `${failed.length} verification failure${failed.length === 1 ? "" : "s"} detected.` : "All executable verification checks passed.");
  return { startedAt: started.toISOString(), completedAt: new Date().toISOString(), passed: failed.length === 0, tests, logs };
}

function runCase(id: string, label: string, check: () => string, skip = false): TestCaseResult {
  const started = performance.now();
  if (skip) return { id, label, status: "skipped", durationMs: Math.round(performance.now() - started), details: "No matching workspace file." };
  try { return { id, label, status: "passed", durationMs: Math.round(performance.now() - started), details: check() }; } catch (error: unknown) { const message = error instanceof Error ? error.message : "Assertion failed"; return { id, label, status: "failed", durationMs: Math.round(performance.now() - started), details: message, stack: error instanceof Error ? error.stack : undefined }; }
}

function verifyTypeScriptSyntax(file: VirtualFile): string {
  const source = file.content;
  const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
  const stack: string[] = [];
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === quote) quote = ""; continue; }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (pairs[char]) stack.push(pairs[char]); else if (Object.values(pairs).includes(char) && stack.pop() !== char) throw new Error(`Unbalanced delimiter near character ${index}.`);
  }
  if (quote || blockComment || stack.length) throw new Error("Unclosed string, comment, or delimiter.");
  return "Balanced strings, comments, and delimiters";
}

function executeUnitFile(file: VirtualFile): string {
  const assertions: { equal(actual: unknown, expected: unknown, message?: string): void; ok(value: unknown, message?: string): void } = {
    equal(actual, expected, message) { if (actual !== expected) throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}`); },
    ok(value, message) { if (!value) throw new Error(message ?? "Expected a truthy value"); },
  };
  const logs: string[] = [];
  new Function("assert", "console", file.content)(assertions, { log: (...values: unknown[]) => logs.push(values.map(String).join(" ")) });
  return logs.length ? logs.join("\n") : "Assertions completed";
}
