import { createFile, readFile, updateFile } from "../storage";
import { vfsHistory, type VfsSnapshot } from "./vfsHistory";
import { runVirtualTests, type TestRunResult } from "../testing";

export interface FileChange { path: string; content: string; }
export interface WorkspaceTransactionResult { committed: boolean; snapshot: VfsSnapshot; testResult: TestRunResult; changedPaths: string[]; }

export class WorkspaceTransaction {
  async apply(changes: FileChange[], options: { label?: string; runTests?: boolean } = {}): Promise<WorkspaceTransactionResult> {
    if (!changes.length) throw new Error("Workspace transaction requires at least one file change.");
    const unique = new Map<string, FileChange>();
    for (const change of changes) { if (!change.path.trim()) throw new Error("Workspace transaction paths cannot be empty."); unique.set(change.path, change); }
    const snapshot = await vfsHistory.checkpoint(options.label ?? "before workspace transaction");
    try {
      for (const change of unique.values()) { const existing = await readFile(change.path); if (existing) await updateFile(change.path, change.content); else await createFile(change.path, change.content); }
      const testResult = options.runTests === false ? await passedWithoutTests() : await runVirtualTests();
      if (!testResult.passed) { await vfsHistory.rollback(snapshot.id); return { committed: false, snapshot, testResult, changedPaths: [...unique.keys()] }; }
      return { committed: true, snapshot, testResult, changedPaths: [...unique.keys()] };
    } catch (error) {
      await vfsHistory.rollback(snapshot.id);
      throw error;
    }
  }
}

async function passedWithoutTests(): Promise<TestRunResult> { const now = new Date().toISOString(); return { startedAt: now, completedAt: now, passed: true, tests: [], logs: ["Tests skipped by transaction options."] }; }
export const workspaceTransaction = new WorkspaceTransaction();
