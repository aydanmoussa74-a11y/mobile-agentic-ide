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

interface DirectoryRecord { path: string; createdAt: number }
interface FileRecord extends VirtualFile {}

const DATABASE_NAME = "mobile-agentic-ide";
const DATABASE_VERSION = 2;
const FILES_STORE = "files";
const DIRECTORIES_STORE = "directories";
type StoreName = typeof FILES_STORE | typeof DIRECTORIES_STORE;

function normalizePath(path: string): string {
  const normalized = path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) throw new Error("Paths must contain at least one valid segment.");
  return normalized;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILES_STORE)) database.createObjectStore(FILES_STORE, { keyPath: "path" });
      if (!database.objectStoreNames.contains(DIRECTORIES_STORE)) database.createObjectStore(DIRECTORIES_STORE, { keyPath: "path" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the local file system."));
  });
}

function runRequest<T>(storeName: StoreName, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local file system request failed."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Local file system transaction failed."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  }));
}

export async function createFile(path: string, content = ""): Promise<VirtualFile> {
  const now = Date.now();
  const file: FileRecord = { path: normalizePath(path), content, createdAt: now, updatedAt: now };
  await runRequest(FILES_STORE, "readwrite", (store) => store.add(file));
  return file;
}

export async function readFile(path: string): Promise<VirtualFile | null> {
  const file = await runRequest<FileRecord | undefined>(FILES_STORE, "readonly", (store) => store.get(normalizePath(path)));
  return file ?? null;
}

export async function updateFile(path: string, content: string): Promise<VirtualFile> {
  const normalizedPath = normalizePath(path);
  const existing = await readFile(normalizedPath);
  if (!existing) throw new Error(`File not found: ${normalizedPath}`);
  const updated: FileRecord = { ...existing, content, updatedAt: Date.now() };
  await runRequest(FILES_STORE, "readwrite", (store) => store.put(updated));
  return updated;
}

export async function deleteFile(path: string): Promise<void> {
  await runRequest(FILES_STORE, "readwrite", (store) => store.delete(normalizePath(path)));
}

export async function listFiles(): Promise<VirtualFile[]> {
  const files = await runRequest<FileRecord[]>(FILES_STORE, "readonly", (store) => store.getAll());
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function createDirectory(path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  if (await readFile(normalizedPath)) throw new Error(`A file already exists at ${normalizedPath}`);
  await runRequest(DIRECTORIES_STORE, "readwrite", (store) => store.add({ path: normalizedPath, createdAt: Date.now() } satisfies DirectoryRecord));
}

export async function listDirectories(): Promise<string[]> {
  const directories = await runRequest<DirectoryRecord[]>(DIRECTORIES_STORE, "readonly", (store) => store.getAll());
  return directories.map((directory) => directory.path).sort((a, b) => a.localeCompare(b));
}

export async function deleteDirectory(path: string): Promise<void> {
  const normalizedPath = normalizePath(path);
  const prefix = `${normalizedPath}/`;
  const [files, directories] = await Promise.all([listFiles(), listDirectories()]);
  const matchingFiles = files.filter((file) => file.path === normalizedPath || file.path.startsWith(prefix));
  const matchingDirectories = directories.filter((directory) => directory === normalizedPath || directory.startsWith(prefix));
  await Promise.all(matchingFiles.map((file) => deleteFile(file.path)));
  await Promise.all(matchingDirectories.map((directory) => runRequest(DIRECTORIES_STORE, "readwrite", (store) => store.delete(directory))));
}

export async function listTree(): Promise<FileTreeNode[]> {
  const [files, directories] = await Promise.all([listFiles(), listDirectories()]);
  const tree: FileTreeNode[] = [];
  for (const path of [...directories, ...files.map((file) => file.path)].sort((a, b) => a.localeCompare(b))) {
    let level = tree;
    const segments = path.split("/");
    segments.forEach((segment, index) => {
      const nodePath = segments.slice(0, index + 1).join("/");
      const isFile = path === nodePath && files.some((file) => file.path === path);
      let node = level.find((candidate) => candidate.path === nodePath);
      if (!node) {
        node = { name: segment, path: nodePath, kind: isFile ? "file" : "directory", ...(isFile ? {} : { children: [] }) };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    });
  }
  return tree;
}
