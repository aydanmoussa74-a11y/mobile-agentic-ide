import { useState, useEffect, useCallback } from "react";
import type { VirtualFile } from "../lib/storage";
import { listFiles, createFile, deleteFile } from "../lib/storage";

export interface FileNode {
  type: "file" | "directory";
  name: string;
  path: string;
  children?: FileNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
  diffStatus?: "added" | "modified" | "deleted" | "clean";
}

export interface FileExplorerProps {
  files: VirtualFile[];
  selectedPath: string | null;
  onFileSelect: (file: VirtualFile) => void;
  onCreateFile: (path: string) => Promise<void>;
  onDelete: (path: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const FILE_ICONS: Record<string, string> = {
  "index.html": "HTML",
  "app.js": "JS",
  "app.tsx": "TSX",
  "styles.css": "CSS",
  "package.json": "JSON",
  ".env": "ENV",
  ".gitignore": "IGNORE",
  "README.md": "MD",
};

const DEFAULT_FILE_ICON = "FILE";

export function FileExplorer({
  files: externalFiles,
  selectedPath,
  onFileSelect,
  onCreateFile,
  onDelete,
  onRefresh,
}: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [newFilePath, setNewFilePath] = useState("");
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [quickAddPath, setQuickAddPath] = useState("");

  const buildFileTree = useCallback((files: VirtualFile[]): FileNode[] => {
    const root: FileNode[] = [];
    const pathMap = new Map<string, FileNode>();
    const sortedFiles = [...files].sort((a, b) => {
      const aIsDir = a.path.endsWith("/");
      const bIsDir = b.path.endsWith("/");
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    for (const file of sortedFiles) {
      const path = file.path;
      const parts = path.split("/");
      let currentPath = "";
      let currentNode: FileNode | null = null;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const nextPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = i === parts.length - 1;
        if (!part) { currentPath = nextPath; continue; }
        const isDir = !isLast && i < parts.length - 1;
        const node: FileNode = { type: isDir ? "directory" : "file", name: part, path: isDir ? `${nextPath}/` : nextPath, isExpanded: expandedPaths.has(nextPath), isSelected: selectedPath === nextPath };
        if (isDir) {
          const existingNode = pathMap.get(nextPath);
          if (existingNode) { currentNode = existingNode; }
          else {
            const newNode = { ...node, children: [] };
            pathMap.set(nextPath, newNode);
            if (currentNode) { currentNode.children = [...(currentNode.children || []), newNode]; }
            else { root.push(newNode); }
            currentNode = newNode;
          }
        } else {
          const newNode = { ...node };
          pathMap.set(nextPath, newNode);
          if (currentNode) { currentNode.children = [...(currentNode.children || []), newNode]; }
          else { root.push(newNode); }
        }
        currentPath = nextPath;
      }
    }
    return root;
  }, [expandedPaths, selectedPath]);

  useEffect(() => { const tree = buildFileTree(externalFiles); setFileTree(tree); }, [externalFiles, buildFileTree]);

  const handleToggleExpand = useCallback((path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) newExpanded.delete(path); else newExpanded.add(path);
    setExpandedPaths(newExpanded);
  }, [expandedPaths]);

  const handleSelectFile = useCallback((node: FileNode) => {
    if (node.type === "file") {
      const file = externalFiles.find(f => f.path === node.path);
      if (file) onFileSelect(file);
    }
  }, [externalFiles, onFileSelect]);

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    await onCreateFile(newFilePath.trim());
    setNewFilePath("");
    setShowCreateFile(false);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddPath.trim()) return;
    await onCreateFile(quickAddPath.trim());
    setQuickAddPath("");
  };

  const getFileIcon = (node: FileNode): string => {
    if (node.type === "directory") return node.isExpanded ? "-" : "+";
    return FILE_ICONS[node.path] || getIconForPath(node.path);
  };

  const renderTree = (nodes: FileNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = node.isExpanded || false;
      return (
        <div key={node.path} className="tree-node" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          <div className={`tree-node-header ${node.isSelected ? "tree-node-selected" : ""}`} onClick={() => { if (hasChildren) handleToggleExpand(node.path); else handleSelectFile(node); }}>
            <span className="tree-node-icon">{getFileIcon(node)}</span>
            <span className="tree-node-name">{node.name}</span>
            {hasChildren && <button className="tree-node-expand" type="button" onClick={(e) => { e.stopPropagation(); handleToggleExpand(node.path); }}>{isExpanded ? "-" : "+"}</button>}
          </div>
          {hasChildren && isExpanded && <div className="tree-node-children">{renderTree(node.children || [], depth + 1)}</div>}
        </div>
      );
    });
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <h3>Files</h3>
        <div className="explorer-actions">
          <button className="explorer-action-button" type="button" onClick={() => setShowCreateFile(true)} title="Create file">+</button>
          <button className="explorer-action-button" type="button" onClick={() => void onRefresh()} title="Refresh">R</button>
        </div>
      </div>
      <form className="quick-add-form" onSubmit={handleQuickAdd}>
        <input type="text" value={quickAddPath} onChange={(e) => setQuickAddPath(e.target.value)} placeholder="Enter path to create..." />
        <button type="submit" className="primary-button">Create</button>
      </form>
      <div className="file-tree">
        {fileTree.length === 0 ? <p className="empty-state">No files yet. Create one to begin.</p> : <div className="tree-container">{renderTree(fileTree)}</div>}
      </div>
      {showCreateFile && (
        <div className="modal-overlay" onClick={() => setShowCreateFile(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New File</h3>
            <form onSubmit={handleCreateFile}>
              <label htmlFor="new-file-path">File Path</label>
              <input id="new-file-path" value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} placeholder="path/to/file.js" />
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setShowCreateFile(false)}>Cancel</button>
                <button className="primary-button" type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getIconForPath(path: string): string {
  if (path.endsWith(".html")) return "HTML";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "JS";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "TS";
  if (path.endsWith(".css")) return "CSS";
  if (path.endsWith(".json")) return "JSON";
  if (path.endsWith(".md")) return "MD";
  if (path.startsWith(".")) return "HIDDEN";
  return DEFAULT_FILE_ICON;
}
