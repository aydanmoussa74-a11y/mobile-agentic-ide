import { useState, useEffect, useCallback } from "react";
import type { VirtualFile } from "../lib/storage";
import { listFiles, createFile, updateFile, deleteFile } from "../lib/storage";
import { vfsHistory } from "../lib/vfs";
import { FileExplorer } from "./FileExplorer";
import { CodeEditor } from "./CodeEditor";

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
  const [isSaved, setIsSaved] = useState(true);
  const [showPatchReview, setShowPatchReview] = useState(false);

  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;

  useEffect(() => {
    if (selectedFile) {
      setIsSaved(true);
    }
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await onWorkspaceChange();
      setIsSaved(true);
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleContentChange = useCallback((content: string) => {
    if (!selectedFile) return;
    setIsSaved(false);
  }, [selectedFile]);

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

  const handleTogglePatchReview = () => {
    setShowPatchReview(!showPatchReview);
  };

  // Detect language from file extension
  const detectLanguage = (file: VirtualFile | null): string => {
    if (!file) return "text";
    const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
    const languageMap: Record<string, string> = {
      js: "javascript",
      javascript: "javascript",
      ts: "typescript",
      typescript: "typescript",
      tsx: "tsx",
      jsx: "jsx",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      markdown: "markdown",
      py: "python",
      python: "python",
      sh: "bash",
      bash: "bash",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      svg: "xml",
      txt: "text",
    };
    return languageMap[ext] || "text";
  };

  const stats = selectedFile ? {
    lines: selectedFile.content.split("\n").length,
    chars: selectedFile.content.length,
    size: new Blob([selectedFile.content]).size,
  } : { lines: 0, chars: 0, size: 0 };

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
          {selectedFile ? (
            <CodeEditor
              file={selectedFile}
              onChange={handleContentChange}
              onSave={handleSave}
              isSaved={isSaved}
              readOnly={false}
              language={detectLanguage(selectedFile)}
            />
          ) : (
            <div className="editor-placeholder">
              <p>Select a file from the explorer or create a new one to start editing.</p>
              <button className="primary-button" type="button" onClick={async () => await handleCreateFile("new-file.txt")}>
                Create New File
              </button>
            </div>
          )}

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
