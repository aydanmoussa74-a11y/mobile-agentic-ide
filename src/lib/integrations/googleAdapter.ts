import { listFiles } from "../storage";
import { tokenVault } from "./tokenVault";

const DOCS = "https://docs.googleapis.com/v1";
const DRIVE = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
export interface GoogleDocumentContext { documentId: string; title: string; text: string; }
export interface GoogleDriveExport { fileId: string; name: string; mimeType: string; webViewLink?: string; }

export class GoogleAdapter {
  async readDocument(documentId: string): Promise<GoogleDocumentContext> { const document = await this.request<{ documentId: string; title: string; body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> } }>(`${DOCS}/documents/${encodeURIComponent(documentId)}`); const text = (document.body?.content ?? []).flatMap((block) => block.paragraph?.elements ?? []).map((element) => element.textRun?.content ?? "").join(""); return { documentId: document.documentId, title: document.title, text }; }
  async writeDocument(documentId: string, text: string): Promise<{ documentId: string; revisionId?: string }> { const document = await this.request<{ body?: { content?: Array<{ endIndex?: number }> } }>(`${DOCS}/documents/${encodeURIComponent(documentId)}`); const endIndex = Math.max(1, (document.body?.content?.at(-1)?.endIndex ?? 2) - 1); return this.request(`${DOCS}/documents/${encodeURIComponent(documentId)}:batchUpdate`, "POST", { requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex } } }, { insertText: { location: { index: 1 }, text } }] }); }
  async exportVfsToDrive(name: string, mimeType = "application/json"): Promise<GoogleDriveExport> { const files = await listFiles(); if (!files.length) throw new Error("Cannot export an empty VFS."); const metadata = { name, mimeType, description: `Exported by mobile-agentic-ide (${files.length} VFS files)`, appProperties: { source: "mobile-agentic-ide" } }; const content = JSON.stringify({ exportedAt: new Date().toISOString(), files: files.map((file) => ({ path: file.path, content: file.content })) }, null, 2); return this.uploadMultipart(metadata, content, mimeType); }
  private async uploadMultipart(metadata: Record<string, unknown>, content: string, mimeType: string): Promise<GoogleDriveExport> { const token = await this.token(); const boundary = `mobile-agentic-ide-${crypto.randomUUID()}`; const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`; const response = await fetch(DRIVE, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }); if (!response.ok) throw new Error(`Google Drive ${response.status}: ${await response.text()}`); return response.json() as Promise<GoogleDriveExport>; }
  private async token(): Promise<string> { const token = await tokenVault.read("google"); if (!token) throw new Error("Google token is not configured in the local Integration Vault."); return token; }
  private async request<T>(url: string, method = "GET", body?: unknown): Promise<T> { const token = await this.token(); const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); if (!response.ok) throw new Error(`Google ${response.status}: ${await response.text()}`); return response.json() as Promise<T>; }
}

export const googleAdapter = new GoogleAdapter();
