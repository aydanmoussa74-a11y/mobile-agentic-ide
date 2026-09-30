import { useEffect, useState } from "react";
import { MobileShell } from "../components/MobileShell";
import {
  createFile,
  deleteFile,
  listFiles,
  updateFile,
  type VirtualFile,
} from "../lib/storage";

export function App() {
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newPath, setNewPath] = useState("");
  const [message, setMessage] = useState("Loading local workspace…");
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;

  async function refreshFiles(selectPath?: string) {
    const nextFiles = await listFiles();
    setFiles(nextFiles);
    const nextPath = selectPath ?? selectedPath ?? nextFiles[0]?.path ?? null;
    setSelectedPath(nextPath);
    setDraft(nextFiles.find((file) => file.path === nextPath)?.content ?? "");
  }

  useEffect(() => {
    refreshFiles().then(
      () => setMessage("Saved locally on this device."),
      (error: unknown) => setMessage(error instanceof Error ? error.message : "Local storage is unavailable."),
    );
  }, []);

  function selectFile(file: VirtualFile) {
    setSelectedPath(file.path);
    setDraft(file.content);
    setMessage(`Opened ${file.path}`);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPath.trim()) return;
    try {
      const file = await createFile(newPath, "");
      setNewPath("");
      await refreshFiles(file.path);
      setMessage(`Created ${file.path}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to create file.");
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    try {
      await updateFile(selectedFile.path, draft);
      await refreshFiles(selectedFile.path);
      setMessage(`Saved ${selectedFile.path}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to save file.");
    }
  }

  async function handleDelete() {
    if (!selectedFile) return;
    try {
      await deleteFile(selectedFile.path);
      await refreshFiles();
      setMessage(`Deleted ${selectedFile.path}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to delete file.");
    }
  }

  return (
    <MobileShell>
      <section id="workspace" className="workspace-card" aria-labelledby="workspace-title">
        <div className="status-row"><span className="status-dot" aria-hidden="true" /><span>{message}</span></div>
        <h2 id="workspace-title">Your files, ready for handover.</h2>
        <p className="workspace-intro">A lightweight local workspace that stays available across reloads, even before a model is connected.</p>

        <form className="create-file-form" onSubmit={handleCreate}>
          <label htmlFor="new-file-path">New file path</label>
          <div className="input-row">
            <input id="new-file-path" value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder="src/app.ts" autoComplete="off" />
            <button className="primary-button" type="submit">Create</button>
          </div>
        </form>

        <div className="file-workspace">
          <div className="file-list" aria-label="Local files">
            <div className="section-heading"><h3>Workspace</h3><span>{files.length} files</span></div>
            {files.length === 0 ? <p className="empty-state">No files yet. Create one above to begin.</p> : files.map((file) => (
              <button className={`file-row${file.path === selectedPath ? " file-row-active" : ""}`} key={file.path} type="button" onClick={() => selectFile(file)}>
                <span aria-hidden="true">{file.path.includes("/") ? "⌁" : "•"}</span><span>{file.path}</span>
              </button>
            ))}
          </div>

          <div className="editor-panel">
            <label htmlFor="file-editor">{selectedFile?.path ?? "Select a file"}</label>
            <textarea id="file-editor" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedFile} placeholder="File contents" spellCheck={false} />
            <div className="editor-actions">
              <button className="primary-button" type="button" onClick={handleSave} disabled={!selectedFile}>Save changes</button>
              <button className="danger-button" type="button" onClick={handleDelete} disabled={!selectedFile}>Delete</button>
            </div>
          </div>
        </div>
        <p className="scope-note">IndexedDB storage · device-local · no model connection yet.</p>
      </section>
    </MobileShell>
  );
}
