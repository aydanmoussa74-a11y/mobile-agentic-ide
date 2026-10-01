import { createDirectory, createFile, deleteDirectory, deleteFile, listDirectories, listFiles, type VirtualFile } from "../storage";
import { diffFiles, type UnifiedFileDiff } from "./diffEngine";
import { getBranch, getCurrentBranch, listBranches, updateBranchHead, type VfsBranch, type VfsBranchName } from "./vfsBranching";

export interface VfsSnapshot { id: string; label: string; branch: VfsBranchName; createdAt: number; files: VirtualFile[]; directories: string[]; }
export interface VfsRollbackResult { snapshot: VfsSnapshot; restoredFiles: number; restoredDirectories: number; }

const DATABASE = "mobile-agentic-ide-vfs-history";
const VERSION = 1;
const STORE = "snapshots";

export class VfsHistory {
  async checkpoint(label = "agent operation"): Promise<VfsSnapshot> { const [files, directories, branch] = await Promise.all([listFiles(), listDirectories(), getCurrentBranch()]); const snapshot: VfsSnapshot = { id: createId(), label, branch, createdAt: Date.now(), files, directories }; await this.put(snapshot); await updateBranchHead(branch, snapshot.id); await this.prune(branch, 50); return snapshot; }
  async listSnapshots(branch?: VfsBranchName): Promise<VfsSnapshot[]> { const snapshots = await this.request<VfsSnapshot[]>("readonly", (store) => store.getAll()); return snapshots.filter((snapshot) => !branch || snapshot.branch === branch).sort((a, b) => b.createdAt - a.createdAt); }
  async getSnapshot(id: string): Promise<VfsSnapshot | null> { return (await this.request<VfsSnapshot | undefined>("readonly", (store) => store.get(id))) ?? null; }
  async latest(branch?: VfsBranchName): Promise<VfsSnapshot | null> { return (await this.listSnapshots(branch))[0] ?? null; }
  async rollback(snapshotId?: string): Promise<VfsRollbackResult> { const branch = await getCurrentBranch(); const snapshot = snapshotId ? await this.getSnapshot(snapshotId) : await this.latest(branch); if (!snapshot) throw new Error("No VFS checkpoint is available for rollback."); const currentFiles = await listFiles(); const currentDirectories = await listDirectories(); await Promise.all(currentFiles.map((file) => deleteFile(file.path))); await Promise.all([...currentDirectories].sort((a, b) => b.length - a.length).map((directory) => deleteDirectory(directory))); for (const directory of [...snapshot.directories].sort((a, b) => a.length - b.length)) { try { await createDirectory(directory); } catch { /* parent or directory may already exist */ } } for (const file of snapshot.files) { try { await createFile(file.path, file.content); } catch { /* restore remains idempotent for a normalized path */ } } await updateBranchHead(branch, snapshot.id); return { snapshot, restoredFiles: snapshot.files.length, restoredDirectories: snapshot.directories.length }; }
  async diffAgainst(snapshotId?: string): Promise<UnifiedFileDiff[]> { const snapshot = snapshotId ? await this.getSnapshot(snapshotId) : await this.latest(); if (!snapshot) return []; return diffFiles(snapshot.files, await listFiles()); }
  async branches(): Promise<{ current: VfsBranchName; branches: VfsBranch[] }> { return { current: await getCurrentBranch(), branches: await listBranches() }; }
  private async prune(branch: VfsBranchName, limit: number): Promise<void> { const snapshots = await this.listSnapshots(branch); for (const snapshot of snapshots.slice(limit)) await this.request("readwrite", (store) => store.delete(snapshot.id)); }
  private async put(snapshot: VfsSnapshot): Promise<void> { await this.request("readwrite", (store) => store.put(snapshot)); }
  private request<T = IDBValidKey>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> { return openDatabase().then((database) => new Promise((resolve, reject) => { const transaction = database.transaction(STORE, mode); const result = operation(transaction.objectStore(STORE)); result.onsuccess = () => resolve(result.result); result.onerror = () => reject(result.error); transaction.oncomplete = () => database.close(); transaction.onerror = () => reject(transaction.error); })); }
}

function openDatabase(): Promise<IDBDatabase> { if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser.")); return new Promise((resolve, reject) => { const request = indexedDB.open(DATABASE, VERSION); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); if (!request.result.objectStoreNames.contains("branches")) request.result.createObjectStore("branches", { keyPath: "name" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function createId(): string { return `vfs-${Date.now()}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`; }
export const vfsHistory = new VfsHistory();
