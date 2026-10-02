import { useEffect, useMemo, useRef, useState } from "react";
import { MobileShell, type AppTab } from "../components/MobileShell";
import { LandingDashboard, type StarterTemplate } from "../components/LandingDashboard";
import { type SettingsTab } from "../components/SettingsSheet";
import { LivePreview } from "../features/preview/LivePreview";
import { VirtualTerminal } from "../features/terminal/VirtualTerminal";
import { McpControlPanel } from "../features/mcp/McpControlPanel";
import { createContext, createHandoverPayload, exportHandoverJson, readProviderKey, saveProviderKey, type AgentStateDocument, type ModelState, type ProviderConfig, type ProviderId } from "../lib/agent";
import { runWithAutoCorrection, runVirtualTests, type TestRunResult } from "../lib/testing";
import { exportProjectZip, importProjectZip } from "../lib/vfs/projectManager";
import type { PwaStatus } from "../lib/pwa";
import { createFile, deleteFile, listFiles, updateFile, type VirtualFile } from "../lib/storage";
import { storageManager } from "../lib/vfs/storageManager";

const projectState: AgentStateDocument = { project_name: "mobile-agentic-ide", version: "0.1.0-alpha", current_phase: "Phase 1: Project Setup & Architecture Blueprint", current_active_task: "Review execution, preview, and handover integrations", completed_tasks: ["Mobile PWA baseline", "IndexedDB local file system", "Agent orchestration and handover engine"], next_steps: ["Add focused subsystem tests", "Add streaming agent feedback"] };
const providerDefaults: Record<ProviderId, Omit<ProviderConfig, "apiKey">> = { "openai-compatible": { id: "openai-compatible", label: "OpenAI-compatible", model: "gpt-4o-mini" }, anthropic: { id: "anthropic", label: "Claude", model: "claude-3-5-sonnet-latest" }, gemini: { id: "gemini", label: "Gemini", model: "gemini-2.0-flash" } };

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("agent");
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newPath, setNewPath] = useState("");
  const [message, setMessage] = useState("Loading local workspace…");
  const [providers, setProviders] = useState<ProviderConfig[]>(() => Object.values(providerDefaults).map((provider) => ({ ...provider })));
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>("openai-compatible");
  const [modelState, setModelState] = useState<ModelState>({ providerId: "openai-compatible", model: providerDefaults["openai-compatible"].model, activity: "idle", configured: false, failoverCount: 0 });
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [agentTask, setAgentTask] = useState("");
  const [agentOutput, setAgentOutput] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>("registering");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("engine");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [storageLabel, setStorageLabel] = useState("Checking storage…");
  const importInputRef = useRef<HTMLInputElement>(null);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;
  const activeProvider = providers.find((provider) => provider.id === activeProviderId)!;
  const handoverJson = useMemo(() => { const stateFile = files.find((file) => file.path === ".agent_state.json"); let persistedState: AgentStateDocument = {}; try { if (stateFile) persistedState = JSON.parse(stateFile.content) as AgentStateDocument; } catch { persistedState = {}; } return exportHandoverJson(createHandoverPayload(createContext({ ...projectState, ...persistedState }, files, [], [], testResult?.logs.slice(-50) ?? []))); }, [files, testResult]);

  async function refreshFiles(selectPath?: string) {
    const nextFiles = await listFiles();
    setFiles(nextFiles);
    const nextPath = selectPath ?? selectedPath ?? nextFiles[0]?.path ?? null;
    setSelectedPath(nextPath);
    setDraft(nextFiles.find((file) => file.path === nextPath)?.content ?? "");
  }

  useEffect(() => {
    Promise.resolve().then(async () => { const currentFiles = await listFiles(); if (!currentFiles.some((file) => file.path === ".agent_state.json")) await createFile(".agent_state.json", JSON.stringify(projectState, null, 2)); await refreshFiles(); setMessage("Saved locally on this device."); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Local storage is unavailable."));
    Promise.all(Object.keys(providerDefaults).map((id) => readProviderKey(id as ProviderId))).then((keys) => setProviders(Object.values(providerDefaults).map((provider, index) => ({ ...provider, apiKey: keys[index] ?? undefined })))).catch(() => setMessage("Workspace loaded; local key vault is unavailable."));
  }, []);

  useEffect(() => {
    const provider = providers.find((item) => item.id === activeProviderId)!;
    setModelState((current) => ({ ...current, providerId: provider.id, model: provider.model, configured: Boolean(provider.apiKey) }));
    setApiKeyDraft("");
  }, [activeProviderId, providers]);

  useEffect(() => { const handlePwaStatus = (event: Event) => setPwaStatus((event as CustomEvent<PwaStatus>).detail); window.addEventListener("mobile-agentic-ide:pwa-status", handlePwaStatus); return () => window.removeEventListener("mobile-agentic-ide:pwa-status", handlePwaStatus); }, []);

  function selectFile(file: VirtualFile) { setSelectedPath(file.path); setDraft(file.content); setMessage(`Opened ${file.path}`); }
  async function handleCreate(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!newPath.trim()) return; try { const file = await createFile(newPath, ""); setNewPath(""); await refreshFiles(file.path); setMessage(`Created ${file.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to create file."); } }
  async function handleSave() { if (!selectedFile) return; try { await updateFile(selectedFile.path, draft); await refreshFiles(selectedFile.path); setMessage(`Saved ${selectedFile.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to save file."); } }
  async function handleDelete() { if (!selectedFile) return; try { await deleteFile(selectedFile.path); await refreshFiles(); setMessage(`Deleted ${selectedFile.path}`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to delete file."); } }
  async function handleSaveKey(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!apiKeyDraft.trim()) return; try { await saveProviderKey(activeProviderId, apiKeyDraft); setProviders((current) => current.map((provider) => provider.id === activeProviderId ? { ...provider, apiKey: apiKeyDraft.trim() } : provider)); setApiKeyDraft(""); setMessage(`${activeProvider.label} key saved to the local vault.`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to save the local key."); } }
  async function handleHandover() { try { await navigator.clipboard.writeText(handoverJson); setMessage("Handover copied: .agent_state.json, files, and recent test logs included."); } catch { setMessage("Clipboard access was unavailable. Use a secure browser context to copy the ledger."); } }
  async function handleExportProject() { try { const latestFiles = await listFiles(); const blob = await exportProjectZip(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "mobile-agentic-ide-project.zip"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage(`Exported ${latestFiles.length} IndexedDB file${latestFiles.length === 1 ? "" : "s"} as a complete project ZIP.`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to export the project ZIP."); } }
  async function handleImportProject(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { const result = await importProjectZip(file); await refreshFiles(); setMessage(`Imported ${result.files.length} files from ${file.name}; secret scan passed.`); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Unable to import the project ZIP."); } }
  async function handleRunTests() { setTestsRunning(true); try { setTestResult(await runVirtualTests(files)); } finally { setTestsRunning(false); } }
  async function handleAgentTask(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const task = agentTask.trim(); if (!task || agentRunning) return; const configuredProviders = providers.filter((provider) => provider.apiKey); if (!configuredProviders.length) { setMessage("Add a provider key in Agent Ledger before running an agent task."); setActiveTab("agent"); return; } setAgentRunning(true); setAgentOutput(""); setModelState((current) => ({ ...current, activity: "working" })); try { const result = await runWithAutoCorrection(task, providers, activeProviderId, projectState, { onStateChange: setModelState, onTestResult: setTestResult }); setAgentOutput(result.agent.text); setAgentTask(""); await refreshFiles(".agent_state.json"); setMessage(`Agent completed ${result.agent.toolCalls} tool call${result.agent.toolCalls === 1 ? "" : "s"}; ${result.tests.passed ? "verification passed" : "verification needs review"}.`); } catch (error: unknown) { const text = error instanceof Error ? error.message : "Agent task failed."; setAgentOutput(text); setMessage(text); setModelState((current) => ({ ...current, activity: "failed", lastError: text })); } finally { setAgentRunning(false); } }


  async function writeTemplateFile(path: string, content: string) {
    try { await createFile(path, content); }
    catch { await updateFile(path, content); }
  }

  async function handleCreateTemplate(template: StarterTemplate) {
    setCreatingTemplate(true);
    try {
      if (template === "react") {
        await writeTemplateFile("index.html", "<!doctype html>\n<html><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"./src/styles.css\"></head><body><div id=\"root\"></div><script type=\"module\" src=\"./src/App.jsx\"></script></body></html>\n");
        await writeTemplateFile("src/App.jsx", "export function App() {\n  return <main><h1>React starter</h1><p>Edit this local file.</p></main>;\n}\n");
        await writeTemplateFile("src/styles.css", "body { font-family: sans-serif; margin: 24px; }\n");
      } else if (template === "html") {
        await writeTemplateFile("index.html", "<!doctype html>\n<html><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"./styles.css\"></head><body><main><h1>HTML sandbox</h1><p>Preview this page locally.</p></main></body></html>\n");
        await writeTemplateFile("styles.css", "body { font-family: sans-serif; margin: 24px; background: #10131a; color: white; }\n");
      } else {
        await writeTemplateFile("main.py", "print(\"Hello from the local sandbox\")\n");
      }
      await refreshFiles(template === "python" ? "main.py" : "index.html");
      setActiveTab("files");
      setMessage(template === "react" ? "React starter saved locally." : template === "html" ? "HTML sandbox saved locally." : "Python script saved locally.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to create the starter.");
    } finally {
      setCreatingTemplate(false);
    }
  }

  function handleSearch(query: string) {
    if (!query) return;
    const match = files.find((file) => file.path.toLowerCase().includes(query.toLowerCase()));
    if (match) {
      selectFile(match);
      setActiveTab("files");
      setMessage(`Opened ${match.path}`);
      return;
    }
    setAgentTask(query);
    setActiveTab("agent");
    setMessage("Ask is ready. Run it from the agent bar after a provider key is saved in Settings.");
  }

  useEffect(() => {
    void storageManager.estimate().then((estimate) => {
      const usage = estimate.usageBytes ?? 0;
      const quota = estimate.quotaBytes ?? 0;
      setStorageLabel(quota ? `${Math.round(usage / 1024)} KB of ${Math.round(quota / 1024 / 1024)} MB` : `${Math.round(usage / 1024)} KB used`);
    }).catch(() => setStorageLabel("Storage estimate unavailable"));
  }, [files.length]);

  const visibleFiles = searchQuery.trim() ? files.filter((file) => file.path.toLowerCase().includes(searchQuery.trim().toLowerCase())) : files;
  const notices = [
    { id: "cache", title: "Offline cache", body: pwaStatus },
    { id: "model", title: "Agent", body: `${activeProvider.label} · ${modelState.activity}` },
  ];

  return <MobileShell activeTab={activeTab} onNavigate={setActiveTab} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onSearch={handleSearch} onQuickCreate={() => { setActiveTab("files"); setNewPath(newPath || "untitled.txt"); }} notifications={notices} settingsTab={settingsTab} onSettingsTabChange={setSettingsTab} engine={<section className="settings-block"><h3>API keys and model engine</h3><p className="workspace-intro">Keys stay in the device-local vault and are never shown again after save.</p><label className="ledger-label" htmlFor="provider-select">Provider</label><select id="provider-select" value={activeProviderId} onChange={(event) => setActiveProviderId(event.target.value as ProviderId)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label} · {provider.model}</option>)}</select><form className="key-form" onSubmit={handleSaveKey}><label className="ledger-label" htmlFor="provider-key">Local API key <span>(never displayed)</span></label><div className="input-row"><input id="provider-key" type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} placeholder={activeProvider.apiKey ? "Key saved locally" : "Paste a provider key"} autoComplete="off" /><button className="primary-button" type="submit">Save key</button></div></form></section>} ledger={<section className="settings-block" aria-labelledby="handoff-title"><div className="ledger-state"><div className="meta-row"><span className="ledger-label">Active model</span><strong>{modelState.model}</strong></div><div className="meta-row"><span className="ledger-label">Provider</span><strong>{activeProvider.label}</strong></div><div className="meta-row"><span className="ledger-label">State</span><strong>{modelState.activity}{modelState.failoverCount ? ` · ${modelState.failoverCount} failover` : ""}</strong></div></div><button className="handover-button" type="button" onClick={handleHandover}>One-Tap Handover · state + test logs</button><p className="scope-note">Keys use a device-local IndexedDB vault. Browser storage is not a substitute for a hardware-backed secret manager.</p></section>} relays={<McpControlPanel />} status={<section className="settings-block"><h3>System status</h3><div className="ledger-state"><div className="meta-row"><span className="ledger-label">IndexedDB</span><strong>{storageLabel}</strong></div><div className="meta-row"><span className="ledger-label">WASM</span><strong>{typeof WebAssembly === "undefined" ? "Unavailable" : "Available"}</strong></div><div className="meta-row"><span className="ledger-label">Offline cache</span><strong>{pwaStatus}</strong></div><div className="meta-row"><span className="ledger-label">Network</span><strong>{navigator.onLine ? "Online" : "Offline"}</strong></div></div></section>}>
    {activeTab === "agent" && <><LandingDashboard files={visibleFiles} message={message} creating={creatingTemplate} onOpenFile={(file) => { selectFile(file); setActiveTab("files"); }} onCreateTemplate={(template) => { void handleCreateTemplate(template); }} /><div className="agent-action-bar agent-flow"><form onSubmit={handleAgentTask}><label htmlFor="agent-task">Ask your active agent</label><div className="input-row"><input id="agent-task" value={agentTask} onChange={(event) => setAgentTask(event.target.value)} placeholder="Add a dark mode button to index.html" disabled={agentRunning} /><button className="primary-button" type="submit" disabled={agentRunning}>{agentRunning ? "Working…" : "Run"}</button></div></form>{agentOutput && <p className="agent-output" aria-live="polite">{agentOutput}</p>}</div></>}
    {activeTab === "files" && <section id="workspace" className="workspace-card" aria-labelledby="workspace-title"><div className="status-row"><span className="status-dot" aria-hidden="true" /><span>{message}</span></div><h2 id="workspace-title">Files</h2><form className="create-file-form" onSubmit={handleCreate}><label htmlFor="new-file-path">New file path</label><div className="input-row"><input id="new-file-path" value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder="index.html" autoComplete="off" /><button className="primary-button" type="submit">Create</button></div></form><div className="workspace-actions"><button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>Import Project (.zip)</button><input ref={importInputRef} type="file" accept=".zip,application/zip" onChange={(event) => { void handleImportProject(event); }} hidden /><button className="secondary-button" type="button" onClick={() => { void handleExportProject(); }} disabled={!files.length}>Export Complete Project (.zip)</button></div><div className="file-workspace"><div className="file-list" aria-label="Local files"><div className="section-heading"><h3>IndexedDB</h3><span>{visibleFiles.length} files</span></div>{visibleFiles.length === 0 ? <p className="empty-state">No matching files.</p> : visibleFiles.map((file) => <button className={`file-row${file.path === selectedPath ? " file-row-active" : ""}`} key={file.path} type="button" onClick={() => selectFile(file)}><span>{file.path}</span></button>)}</div><div className="editor-panel"><label htmlFor="file-editor">{selectedFile?.path ?? "Select a file"}</label><textarea id="file-editor" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedFile} placeholder="File contents" spellCheck={false} /><div className="editor-actions"><button className="primary-button" type="button" onClick={handleSave} disabled={!selectedFile}>Save changes</button><button className="danger-button" type="button" onClick={handleDelete} disabled={!selectedFile}>Delete</button></div></div></div></section>}
    {activeTab === "terminal" && <VirtualTerminal onWorkspaceChange={refreshFiles} testResult={testResult} testsRunning={testsRunning} onRunTests={() => { void handleRunTests(); }} />}
    {activeTab === "preview" && <LivePreview files={files} />}
  </MobileShell>;
}
