import { useState, useEffect, useCallback } from "react";
import type { VirtualFile } from "../lib/storage";
import { listFiles, createFile, updateFile, deleteFile } from "../lib/storage";
import { vfsHistory } from "../lib/vfs";
import { FileExplorer } from "./FileExplorer";

export interface WorkspaceProps {
  files: VirtualFile[];
  selectedPath: string | null;
  onFileSelect: (file: VirtualFile) => void;
  onWorkspaceChange: () => Promise<void>;
  activeProvider: string;
  activeModel: string;
}

export function Workspace({
  files,
  selectedPath,
  onFileSelect,
  onWorkspaceChange,
  activeProvider,
  activeModel,
}: WorkspaceProps) {
  const [draft, setDraft] = useState("");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isSaved, setIsSaved] = useState(true);
  const [showPatchReview, setShowPatchReview] = useState(false);

  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;

  useEffect(() => {
    if (selectedFile) {
      setDraft(selectedFile.content);
      setIsSaved(true);
    } else {
      setDraft("");
    }
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await updateFile(selectedFile.path, draft);
      await onWorkspaceChange();
      setIsSaved(true);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleCreateFile = async (path: string) => {
    await createFile(path, "");
    await onWorkspaceChange();
  };

  const handleDelete = async (path: string) => {
    await deleteFile(path);
    await onWorkspaceChange();
  };

  const handleRefresh = async () => {
    await onWorkspaceChange();
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setIsSaved(false);
  };

  const handleToggleLineNumbers = () => {
    setShowLineNumbers(!showLineNumbers);
  };

  const handleTogglePatchReview = () => {
    setShowPatchReview(!showPatchReview);
  };

  const handleEditorBlur = async () => {
    if (!isSaved && selectedFile) {
      await handleSave();
    }
  };

  const getLineCount = () => draft.split("\n").length;
  const getFileStats = () => {
    const lines = draft.split("\n").length;
    const chars = draft.length;
    const size = new Blob([draft]).size;
    return { lines, chars, size };
  };
  const stats = getFileStats();

  return (
    <section id="workspace" className="workspace-card" aria-labelledby="workspace-title">
      <div className="workspace-header">
        <div className="workspace-title-section">
          <div className="status-row">
            <span className="status-dot" aria-hidden="true" />
            <span>{selectedFile ? selectedFile.path : "No file selected"}{!isSaved && <span className="unsaved-indicator"> (unsaved)</span>}</span>
          </div>
          <h2 id="workspace-title">{selectedFile ? selectedFile.path.split("/").pop() : "Workspace"}</h2>
        </div>
        <div className="workspace-header-actions">
          <button className="workspace-header-button" type="button" onClick={handleToggleLineNumbers} title="Toggle line numbers">#</button>
          <button className="workspace-header-button" type="button" onClick={handleTogglePatchReview} title="Toggle Agent Patch Review">AI</button>
        </div>
      </div>

      <p className="workspace-intro">
        {selectedFile ? `Editing ${selectedFile.path} - ${stats.lines} lines, ${stats.chars} characters` : "Select a file to begin editing or create a new one."}
      </p>

      <div className="workspace-layout">
        <div className="workspace-sidebar">
          <FileExplorer files={files} selectedPath={selectedPath} onFileSelect={onFileSelect} onCreateFile={handleCreateFile} onDelete={handleDelete} onRefresh={handleRefresh} />
        </div>

        <div className="workspace-main">
          <div className="editor-container">
            <div className="editor-header">
              <label htmlFor="file-editor">{selectedFile?.path ?? "Select a file"}</label>
              <div className="editor-stats">
                <span className="editor-stat">{stats.lines} lines</span>
                <span className="editor-stat">{stats.chars} chars</span>
                <span className="editor-stat">{(stats.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            
            <div className="editor-wrapper">
              {showLineNumbers && (
                <div className="editor-line-numbers">
                  {Array.from({ length: getLineCount() }, (_, i) => <span key={i} className="line-number">{i + 1}</span>)}
                </div>
              )}
              
              <textarea id="file-editor" value={draft} onChange={(event) => handleDraftChange(event.target.value)} onBlur={handleEditorBlur} disabled={!selectedFile} placeholder="File contents" spellCheck={false} className="editor-textarea" />
            </div>

            <div className="editor-actions">
              <button className="primary-button" type="button" onClick={handleSave} disabled={!selectedFile || isSaved}>{isSaved ? "Saved" : "Save changes"}</button>
              <button className="secondary-button" type="button" onClick={async () => { if (selectedFile) { await deleteFile(selectedFile.path); await onWorkspaceChange(); } }} disabled={!selectedFile}>Delete</button>
              <button className="secondary-button" type="button" onClick={async () => { await vfsHistory.checkpoint(`Before editing ${selectedFile?.path}`); }} disabled={!selectedFile}>Checkpoint</button>
            </div>
          </div>

          {showPatchReview && selectedFile && (
            <div className="patch-review-panel">
              <div className="patch-review-header">
                <h3>Agent Patch Review</h3>
                <span className="patch-review-status">Ready for review</span>
              </div>
              <div className="patch-review-content">
                <p>Review agent-suggested changes before accepting. All changes are scanned for secrets before dispatch.</p>
                <div className="patch-review-actions">
                  <button className="primary-button" type="button">Accept Patch</button>
                  <button className="secondary-button" type="button">Request Changes</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="scope-note">IndexedDB storage device-local handover ready.</p>
    </section>
  );
}
