import { logStorage } from "../agent/logStorage";
import { vfsHistory, type VfsSnapshot } from "./vfsHistory";

export interface StorageEstimate { usageBytes: number | null; quotaBytes: number | null; usageRatio: number | null; available: boolean; }
export interface PruneResult { snapshotsRemoved: number; logsRemoved: number; snapshotCount: number; logCount: number; estimate: StorageEstimate; }

const SNAPSHOT_LIMIT = 50;
const LOG_LIMIT = 100;

export class StorageManager {
  async estimate(): Promise<StorageEstimate> { if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { usageBytes: null, quotaBytes: null, usageRatio: null, available: false }; const estimate = await navigator.storage.estimate(); const usageBytes = typeof estimate.usage === "number" ? estimate.usage : null; const quotaBytes = typeof estimate.quota === "number" ? estimate.quota : null; return { usageBytes, quotaBytes, usageRatio: usageBytes !== null && quotaBytes ? usageBytes / quotaBytes : null, available: true }; }
  async prune(): Promise<PruneResult> { const estimate = await this.estimate(); const snapshotsBefore = await vfsHistory.listSnapshots(); const snapshotRemoved = await vfsHistory.prune(SNAPSHOT_LIMIT); const logsRemoved = await logStorage.prune(LOG_LIMIT); const snapshotsAfter = await vfsHistory.listSnapshots(); const logsAfter = await logStorage.listLogs(undefined, LOG_LIMIT); return { snapshotsRemoved: snapshotRemoved || Math.max(0, snapshotsBefore.length - snapshotsAfter.length), logsRemoved, snapshotCount: snapshotsAfter.length, logCount: logsAfter.length, estimate }; }
  async maintain(): Promise<PruneResult> { return this.prune(); }
}

export const storageManager = new StorageManager();
export { SNAPSHOT_LIMIT, LOG_LIMIT };
export type { VfsSnapshot };
