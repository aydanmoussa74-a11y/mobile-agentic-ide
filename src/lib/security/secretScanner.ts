import type { VirtualFile } from "../storage";

export type SecretKind = "openai" | "anthropic" | "gemini" | "github" | "env-file" | "private-key" | "generic-api-key";
export type FindingSeverity = "high" | "medium";
export interface ScanFinding { kind: SecretKind; severity: FindingSeverity; path: string; line: number; preview: string; message: string; }

const patterns: Array<{ kind: SecretKind; severity: FindingSeverity; expression: RegExp; message: string }> = [
  { kind: "openai", severity: "high", expression: /\bsk-[A-Za-z0-9_-]{20,}\b/g, message: "OpenAI-style API key" },
  { kind: "anthropic", severity: "high", expression: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, message: "Anthropic-style API key" },
  { kind: "gemini", severity: "high", expression: /\bAIza[0-9A-Za-z_-]{30,}\b/g, message: "Google/Gemini-style API key" },
  { kind: "github", severity: "high", expression: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, message: "GitHub token" },
  { kind: "private-key", severity: "high", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, message: "Private key material" },
  { kind: "generic-api-key", severity: "medium", expression: /\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}["']?/gi, message: "Credential-like assignment" },
];

export function scanText(text: string, path = "inline"): ScanFinding[] {
  const findings: ScanFinding[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const pattern of patterns) {
      pattern.expression.lastIndex = 0;
      if (pattern.expression.test(line)) findings.push({ kind: pattern.kind, severity: pattern.severity, path, line: text.slice(0, text.indexOf(line) < 0 ? 0 : text.indexOf(line)).split(/\r?\n/).length, preview: redactLine(line), message: pattern.message });
    }
  }
  if (/^\.env(?:\.|$)/i.test(path) || /(?:^|\/)\.env(?:\.|$)/i.test(path)) findings.push({ kind: "env-file", severity: "high", path, line: 1, preview: "[REDACTED ENV FILE]", message: "Environment files are excluded from model and export payloads." });
  return dedupeFindings(findings);
}

export function scanFiles(files: Pick<VirtualFile, "path" | "content">[]): ScanFinding[] { return files.flatMap((file) => scanText(file.content, file.path)); }
export function containsSecrets(value: string, path = "inline"): boolean { return scanText(value, path).length > 0; }
export function redactSecrets(value: string, path = "inline"): string { if (/^\.env(?:\.|$)/i.test(path) || /(?:^|\/)\.env(?:\.|$)/i.test(path)) return "[REDACTED ENV FILE]"; let result = value; for (const pattern of patterns) result = result.replace(pattern.expression, "[REDACTED SECRET]"); return result; }
export function redactFile(file: Pick<VirtualFile, "path" | "content">): { path: string; content: string } { return { path: file.path, content: redactSecrets(file.content, file.path) }; }
export function redactFiles<T extends Pick<VirtualFile, "path" | "content">>(files: T[]): Array<Omit<T, "content"> & { content: string }> { return files.map((file) => ({ ...file, content: redactSecrets(file.content, file.path) })); }

function redactLine(line: string): string { return redactSecrets(line); }
function dedupeFindings(findings: ScanFinding[]): ScanFinding[] { return findings.filter((finding, index) => findings.findIndex((candidate) => candidate.path === finding.path && candidate.kind === finding.kind && candidate.line === finding.line) === index); }
