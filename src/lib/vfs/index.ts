export { diffFiles, diffText } from "./diffEngine";
export type { UnifiedFileDiff } from "./diffEngine";
export { vfsHistory, VfsHistory } from "./vfsHistory";
export type { VfsRollbackResult, VfsSnapshot } from "./vfsHistory";
export { getBranch, getCurrentBranch, listBranches, switchBranch, updateBranchHead } from "./vfsBranching";
export type { VfsBranch, VfsBranchName } from "./vfsBranching";
