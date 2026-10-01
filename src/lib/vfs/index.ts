export { diffFiles, diffText } from "./diffEngine";
export type { UnifiedFileDiff } from "./diffEngine";
export { vfsHistory, VfsHistory } from "./vfsHistory";
export type { VfsRollbackResult, VfsSnapshot } from "./vfsHistory";
export { getBranch, getCurrentBranch, listBranches, switchBranch, updateBranchHead } from "./vfsBranching";
export type { VfsBranch, VfsBranchName } from "./vfsBranching";
export { storageManager, StorageManager, SNAPSHOT_LIMIT, LOG_LIMIT } from "./storageManager";
export type { StorageEstimate, PruneResult } from "./storageManager";
