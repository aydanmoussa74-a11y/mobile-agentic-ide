import { useEffect, useMemo, useState } from "react";
import { MobileShell, type AppTab } from "../components/MobileShell";
import { LivePreview } from "../features/preview/LivePreview";
import { VirtualTerminal } from "../features/terminal/VirtualTerminal";
import { createContext, createHandoverPayload, exportHandoverJson, readProviderKey, saveProviderKey, type AgentStateDocument, type ModelState, type ProviderConfig, type ProviderId } from "../lib/agent";
import { createFile, deleteFile, listFiles, updateFile, type VirtualFile } from "../lib/storage";

const projectState: AgentStateDocument = { project_name: "mobile-agentic-ide", version: "0.1.0-alpha", current_phase: "Phase 1: Project Setup & Architecture Blueprint", current_active_task: "Review execution, preview, and handover integrations", completed_tasks: ["Mobile PWA baseline", "IndexedDB local file system", "Agent orchestration and handover engine"], next_steps: ["Add focused subsystem tests", "Add streaming agent feedback"] };
const providerDefaults: Record<ProviderId, Omit<ProviderConfig, "apiKey">> = { "openai-compatible": { id: "openai-compatible", label: "OpenAI-compatible", model: "gpt-4o-mini" }, anthropic: { id: "anthropic", label: "Claude", model: "claude-3-5-sonnet-latest" }, gemini: { id: "gemini", label: "Gemini", model: "gemini-2.0-flash" } };

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("workspace");
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newPath, setNewPath] = useState("");
  const [message, setMessage] = useState("Loading local workspace…");
  const [providers, setProviders] = useState<ProviderConfig[]>(() => Object.values(providerDefaults).map((provider) => ({ ...provider })));
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>("openai-compatible");
  const [modelState, setModelState] = useState<ModelState>({ providerId: "openai-compatible", model: providerDefaults["openai-compatible"].model, activity: "idle", configured: false, failoverCount: 0 });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;
  const activeProvider = providers.find((provider) => provider.id === activeProviderId)!;
  const handoverJson = useMemo(() => exportHandoverJson(createHandoverPayload(createContext(projectState, files))), [files]);

  async function refreshFiles(selectPath?: string) {
    const nextFiles = await listFiles();
    setFiles(nextFiles);
    const nextPath = selectPath ?? selectedPath ?? nextFiles[0]?.path ?? null;
    setSelectedPath(nextPath);
    setDraft(nextFiles.find((file) => file.path === nextPath)?.content ?? "");
  }

  useEffect(() => {
    refreshFiles().then(() => setMessage("Saved locally on this device."), (error: unknown) => setMessage(error instanceof Error ? error.message : "Local storage is unavailable."));
    Promise.all(Object.keys(providerDefaults).map((id) => readProviderKey(id as ProviderId))).then((keys) => setProviders(Object.values(providerDefaults).map((provider, index) => ({ ...provider, apiKey: keys[index] ?? undefined })))).catch(() => setMessage("Workspace loaded; local key vault is unavailable."));
  }, []);

  useEffect(() => {
    const provider = providers.find((item) => item.id === activeProviderId)!;
    setModelState((current) => ({ ...current, providerId: provider.id, model: provider.model, configured: Boolean(provider.apiKey) }));
    setApiKeyDraft("");
  }, [activeProviderId, providers]);

  function selectFile(file: VirtualFile) { setSelectedPath(file.path); setDraft(file.content); setMessage(`Opened ${file.path}`); }
  async function handleCreate(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!newPath.trim()) return; try { const file = await createFile(newPath, ""); setNewPath(""); await refreshFiles(file.path); setMessage(`Created ${file.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to create file."); } }
  async function handleSave() { if (!selectedFile) return; try { await updateFile(selectedFile.path, draft); await refreshFiles(selectedFile.path); setMessage(`Saved ${selectedFile.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to save file."); } }
  async function handleDelete() { if (!selectedFile) return; try { await deleteFile(selectedFile.path); await refreshFiles(); setMessage(`Deleted ${selectedFile.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to delete file."); } }
  async function handleSaveKey(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!apiKeyDraft.trim()) return; try { await saveProviderKey(activeProviderId, apiKeyDraft); setProviders((current) => current.map((provider) => provider.id === activeProviderId ? { ...provider, apiKey: apiKeyDraft.trim() } : provider)); setApiKeyDraft(""); setMessage(`${activeProvider.label} key saved to the local vault.`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to save the local key."); } }
  async function handleHandover() { try { await navigator.clipboard.writeText(handoverJson); setMessage("Complete handover ledger copied to the clipboard."); } catch { setMessage("Clipboard access was unavailable. Use a secure browser context to copy the ledger."); } }

  return <MobileShell activeTab={activeTab} onNavigate={setActiveTab}>
    {activeTab === "workspace" && <section id="workspace" className="workspace-card" aria-labelledby="workspace-title"><div className="status-row"><span className="status-dot" aria-hidden="true" /><span>{message}</span></div><h2 id="workspace-title">Your files, ready for handover.</h2><p className="workspace-intro">A lightweight local workspace that stays available across reloads, even before a model is connected.</p><form className="create-file-form" onSubmit={handleCreate}><label htmlFor="new-file-path">New file path</label><div className="input-row"><input id="new-file-path" value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder="index.html" autoComplete="off" /><button className="primary-button" type="submit">Create</button></div></form><div className="file-workspace"><div className="file-list" aria-label="Local files"><div className="section-heading"><h3>Workspace</h3><span>{files.length} files</span></div>{files.length === 0 ? <p className="empty-state">No files yet. Create one above to begin.</p> : files.map((file) => <button className={`file-row${file.path === selectedPath ? " file-row-active" : ""}`} key={file.path} type="button" onClick={() => selectFile(file)}><span aria-hidden="true">{file.path.includes("/") ? "⌁" : "•"}</span><span>{file.path}</span></button>)}</div><div className="editor-panel"><label htmlFor="file-editor">{selectedFile?.path ?? "Select a file"}</label><textarea id="file-editor" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedFile} placeholder="File contents" spellCheck={false} /><div className="editor-actions"><button className="primary-button" type="button" onClick={handleSave} disabled={!selectedFile}>Save changes</button><button className="danger-button" type="button" onClick={handleDelete} disabled={!selectedFile}>Delete</button></div></div></div><p className="scope-note">IndexedDB storage · device-local · handover ready.</p></section>}
    {activeTab === "terminal" && <VirtualTerminal onWorkspaceChange={refreshFiles} />}
    {activeTab === "preview" && <LivePreview files={files} />}
    {activeTab === "handoff" && <section id="handoff" className="workspace-card ledger-card" aria-labelledby="handoff-title"><div className="status-row"><span className="status-dot" aria-hidden="true" /><span>Agent Ledger · local-first orchestration</span></div><h2 id="handoff-title">Switch agents in one tap.</h2><p className="workspace-intro">The ledger combines project state, files, diffs, and session history into one model-agnostic payload.</p><div className="ledger-state"><div><span className="ledger-label">Active model</span><strong>{modelState.model}</strong></div><div><span className="ledger-label">Provider</span><strong>{activeProvider.label}</strong></div><div><span className="ledger-label">State</span><strong>{modelState.activity}{modelState.failoverCount ? ` · ${modelState.failoverCount} failover` : ""}</strong></div></div><label className="ledger-label" htmlFor="provider-select">Active provider</label><select id="provider-select" value={activeProviderId} onChange={(event) => setActiveProviderId(event.target.value as ProviderId)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label} · {provider.model}</option>)}</select><form className="key-form" onSubmit={handleSaveKey}><label className="ledger-label" htmlFor="provider-key">Local API key <span>(never displayed)</span></label><div className="input-row"><input id="provider-key" type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} placeholder={activeProvider.apiKey ? "Key saved locally" : "Paste a provider key"} autoComplete="off" /><button className="primary-button" type="submit">Save key</button></div></form><button className="handover-button" type="button" onClick={handleHandover}>One-Tap Handover <span aria-hidden="true">↗</span></button><p className="scope-note">Keys use a device-local IndexedDB vault. Browser storage is not a substitute for a hardware-backed secret manager.</p></section>}
  </MobileShell>;
}
