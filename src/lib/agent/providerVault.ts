import type { ProviderId } from "./types";

const DATABASE_NAME = "mobile-agentic-ide-secrets";
const DATABASE_VERSION = 1;
const STORE_NAME = "provider-keys";

function openVault(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Browser storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the local key vault."));
  });
}

export async function saveProviderKey(providerId: ProviderId, apiKey: string): Promise<void> {
  const database = await openVault();
  await run(database, "readwrite", (store) => store.put(apiKey.trim(), providerId));
}

export async function readProviderKey(providerId: ProviderId): Promise<string | null> {
  const database = await openVault();
  return (await run<string | undefined>(database, "readonly", (store) => store.get(providerId))) ?? null;
}

export async function deleteProviderKey(providerId: ProviderId): Promise<void> {
  const database = await openVault();
  await run(database, "readwrite", (store) => store.delete(providerId));
}

function run<T = undefined>(database: IDBDatabase, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local key vault request failed."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Local key vault transaction failed."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}
