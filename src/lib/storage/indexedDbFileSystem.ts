export interface VirtualFile {
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileTreeNode[];
}

interface FileRecord extends VirtualFile {}

const DATABASE_NAME = "mobile-agentic-ide";
const DATABASE_VERSION = 1;
const FILES_STORE = "files";

function normalizePath(path: string): string {
  const normalized = path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("File paths must contain at least one valid segment.");
  }
  return normalized;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILES_STORE)) {
        database.createObjectStore(FILES_STORE, { keyPath: "path" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the local file system."));
  });
}

function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(FILES_STORE, mode);
        const request = operation(transaction.objectStore(FILES_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Local file system request failed."));
        transaction.onerror = () => reject(transaction.error ?? new Error("Local file system transaction failed."));
        transaction.oncomplete = () => database.close();
        transaction.onabort = () => database.close();
      }),
  );
}

export async function createFile(path: string, content = ""): Promise<VirtualFile> {
  const now = Date.now();
  const file: FileRecord = { path: normalizePath(path), content, createdAt: now, updatedAt: now };
  await runRequest("readwrite", (store) => store.add(file));
  return file;
}

export async function readFile(path: string): Promise<VirtualFile | null> {
  const file = await runRequest<FileRecord | undefined>("readonly", (store) => store.get(normalizePath(path)));
  return file ?? null;
}

export async function updateFile(path: string, content: string): Promise<VirtualFile> {
  const normalizedPath = normalizePath(path);
  const existing = await readFile(normalizedPath);
  if (!existing) {
    throw new Error(`File not found: ${normalizedPath}`);
  }
  const updated: FileRecord = { ...existing, content, updatedAt: Date.now() };
  await runRequest("readwrite", (store) => store.put(updated));
  return updated;
}

export async function deleteFile(path: string): Promise<void> {
  await runRequest("readwrite", (store) => store.delete(normalizePath(path)));
}

export async function listFiles(): Promise<VirtualFile[]> {
  const files = await runRequest<FileRecord[]>("readonly", (store) => store.getAll());
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function listTree(): Promise<FileTreeNode[]> {
  const tree: FileTreeNode[] = [];
  for (const file of await listFiles()) {
    let level = tree;
    const segments = file.path.split("/");
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join("/");
      const isFile = index === segments.length - 1;
      let node = level.find((candidate) => candidate.path === path);
      if (!node) {
        node = { name: segment, path, kind: isFile ? "file" : "directory", ...(isFile ? {} : { children: [] }) };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    });
  }
  return tree;
}
