export type IntegrationId = string;

interface VaultRecord { id: string; providerId: string; key: string; iv: number[]; ciphertext: number[]; updatedAt: number; }

const DATABASE = "mobile-agentic-ide-integrations";
const VERSION = 1;
const STORE = "oauth-tokens";
const KEY_STORE = "vault-meta";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class TokenVault {
  private keyPromise?: Promise<CryptoKey>;

  async save(id: IntegrationId, token: string, credentialKey = "accessToken"): Promise<void> {
    if (!token.trim()) throw new Error("Token cannot be empty.");
    const cryptoKey = await this.key();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoder.encode(token.trim())));
    await this.put({ id: `${id}:${credentialKey}`, providerId: id, key: credentialKey, iv: [...iv], ciphertext: [...ciphertext], updatedAt: Date.now() });
  }

  async read(id: IntegrationId, key = "accessToken"): Promise<string | null> {
    const record = await this.get(`${id}:${key}`) ?? (key === "accessToken" ? await this.get(id) : undefined);
    if (!record) return null;
    try { const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv) }, await this.key(), new Uint8Array(record.ciphertext)); return decoder.decode(plaintext); } catch { throw new Error("Stored integration token could not be decrypted."); }
  }

  async remove(id: IntegrationId, key = "accessToken"): Promise<void> { await this.request("readwrite", (store) => store.delete(`${id}:${key}`)); }
  async has(id: IntegrationId, key = "accessToken"): Promise<boolean> { return Boolean(await this.get(`${id}:${key}`)); }

  private async key(): Promise<CryptoKey> {
    this.keyPromise ??= this.loadOrCreateKey();
    return this.keyPromise;
  }
  private async loadOrCreateKey(): Promise<CryptoKey> { const stored = await this.request<CryptoKey | undefined>("readonly", (store) => store.get("encryption-key"), KEY_STORE); if (stored) return stored; const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); await this.request("readwrite", (store) => store.put(key, "encryption-key"), KEY_STORE); return key; }
  private async get(id: IntegrationId): Promise<VaultRecord | undefined> { return this.request<VaultRecord | undefined>("readonly", (store) => store.get(id)); }
  private async put(record: VaultRecord): Promise<void> { await this.request("readwrite", (store) => store.put(record)); }
  private request<T = IDBValidKey>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T> { if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable.")); return new Promise((resolve, reject) => { const open = indexedDB.open(DATABASE, VERSION); open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: "id" }); if (!open.result.objectStoreNames.contains(KEY_STORE)) open.result.createObjectStore(KEY_STORE); }; open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const transaction = db.transaction(storeName, mode); const request = operation(transaction.objectStore(storeName)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); transaction.oncomplete = () => db.close(); transaction.onerror = () => reject(transaction.error); }; }); }
}

export const tokenVault = new TokenVault();
