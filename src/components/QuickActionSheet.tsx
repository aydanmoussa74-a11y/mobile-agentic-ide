import { useState } from "react";
import { Download, FilePlus, FolderGit2, FolderPlus, Upload, X } from "lucide-react";

interface QuickActionSheetProps {
  open: boolean;
  onClose: () => void;
  onNewFile: (path: string) => Promise<void>;
  onNewFolder: (path: string) => Promise<void>;
  onImportZip: () => void;
  onImportGithub: (owner: string, repo: string) => Promise<void>;
  onExportZip: () => void;
}

export function QuickActionSheet({ open, onClose, onNewFile, onNewFolder, onImportZip, onImportGithub, onExportZip }: QuickActionSheetProps) {
  const [mode, setMode] = useState<"menu" | "file" | "folder" | "github">("menu");
  const [path, setPath] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setMode("menu");
    setPath("");
    setRepo("");
    setError("");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submitPath = async (kind: "file" | "folder") => {
    const next = path.trim();
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "file") await onNewFile(next);
      else await onNewFolder(next);
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create that path.");
      setBusy(false);
    }
  };

  const submitGithub = async () => {
    const [owner, name] = repo.split("/").map((part) => part.trim());
    if (!owner || !name) {
      setError("Use owner/repo, for example octocat/hello-world.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onImportGithub(owner, name);
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "GitHub import failed.");
      setBusy(false);
    }
  };

  return (
    <div className="settings-backdrop" onClick={close}>
      <section className="quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-actions-title" onClick={(event) => event.stopPropagation()}>
        <div className="settings-handle" aria-hidden="true" />
        <header className="settings-sheet-header">
          <h2 id="quick-actions-title">New</h2>
          <button className="top-icon" type="button" onClick={close} aria-label="Close actions">
            <X size={18} />
          </button>
        </header>
        {mode === "menu" && (
          <div className="quick-actions">
            <button type="button" onClick={() => setMode("file")}><FilePlus size={18} /> New File</button>
            <button type="button" onClick={() => setMode("folder")}><FolderPlus size={18} /> New Folder</button>
            <button type="button" onClick={() => { onImportZip(); close(); }}><Upload size={18} /> Import Project (.zip)</button>
            <button type="button" onClick={() => setMode("github")}><FolderGit2 size={18} /> Import from GitHub</button>
            <button type="button" onClick={() => { onExportZip(); close(); }}><Download size={18} /> Export Project (.zip)</button>
          </div>
        )}
        {(mode === "file" || mode === "folder") && (
          <form className="quick-form" onSubmit={(event) => { event.preventDefault(); void submitPath(mode); }}>
            <label htmlFor="quick-path">{mode === "file" ? "File path" : "Folder path"}</label>
            <input id="quick-path" value={path} onChange={(event) => setPath(event.target.value)} placeholder={mode === "file" ? "src/app.ts" : "src"} autoComplete="off" />
            <button className="primary-button" type="submit" disabled={busy || !path.trim()}>{busy ? "Creating…" : "Create"}</button>
          </form>
        )}
        {mode === "github" && (
          <form className="quick-form" onSubmit={(event) => { event.preventDefault(); void submitGithub(); }}>
            <label htmlFor="quick-repo">Repository</label>
            <input id="quick-repo" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/repo" autoComplete="off" />
            <button className="primary-button" type="submit" disabled={busy}>Import</button>
          </form>
        )}
        {error && <p className="scope-note" role="alert">{error}</p>}
      </section>
    </div>
  );
}
