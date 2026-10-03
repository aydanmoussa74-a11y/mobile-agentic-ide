import { useMemo, useState } from "react";
import { ChevronRight, File, Folder, Play, X } from "lucide-react";
import type { VirtualFile } from "../lib/storage";
import { CodeEditor } from "./CodeEditor";

interface FilesTabProps {
  files: VirtualFile[];
  selectedPath: string | null;
  draft: string;
  isSaved: boolean;
  projectName: string;
  onSelect: (file: VirtualFile) => void;
  onChange: (content: string) => void;
  onSave: () => Promise<void>;
  onRun: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  children: TreeNode[];
}

function buildTree(files: VirtualFile[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const dirs = new Map<string, TreeNode>();
  const ensureDir = (path: string, name: string, parent: TreeNode[] | TreeNode) => {
    const existing = dirs.get(path);
    if (existing) return existing;
    const node: TreeNode = { name, path, type: "directory", size: 0, children: [] };
    dirs.set(path, node);
    if (Array.isArray(parent)) parent.push(node);
    else parent.children.push(node);
    return node;
  };
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/").filter(Boolean);
    let parent: TreeNode[] | TreeNode = roots;
    let current = "";
    parts.forEach((part, index) => {
      current = current ? `${current}/${part}` : part;
      if (index === parts.length - 1) {
        const node: TreeNode = { name: part, path: file.path, type: "file", size: new Blob([file.content]).size, children: [] };
        if (Array.isArray(parent)) parent.push(node);
        else parent.children.push(node);
      } else {
        parent = ensureDir(current, part, parent);
      }
    });
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

export function FilesTab({ files, selectedPath, draft, isSaved, projectName, onSelect, onChange, onSave, onRun }: FilesTabProps) {
  const [filter, setFilter] = useState("");
  const [openPaths, setOpenPaths] = useState<string[]>(selectedPath ? [selectedPath] : []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(!selectedPath);
  const tree = useMemo(() => buildTree(files), [files]);
  const query = filter.trim().toLowerCase();
  const openFiles = openPaths.map((path) => files.find((file) => file.path === path)).filter((file): file is VirtualFile => Boolean(file));
  const active = files.find((file) => file.path === selectedPath) ?? openFiles[0] ?? null;

  const openFile = (file: VirtualFile) => {
    setOpenPaths((current) => current.includes(file.path) ? current : [...current, file.path]);
    onSelect(file);
    setDrawerOpen(false);
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    if (query && node.type === "file" && !node.path.toLowerCase().includes(query)) return null;
    if (query && node.type === "directory" && !node.children.some((child) => child.path.toLowerCase().includes(query))) return null;
    if (node.type === "directory") {
      const isOpen = expanded.has(node.path) || Boolean(query);
      return (
        <div key={node.path}>
          <button className="tree-row" type="button" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setExpanded((current) => {
            const next = new Set(current);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            return next;
          })}>
            <ChevronRight size={16} className={isOpen ? "tree-chevron open" : "tree-chevron"} />
            <Folder size={16} />
            <span>{node.name}</span>
          </button>
          {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }
    const file = files.find((item) => item.path === node.path);
    return (
      <button key={node.path} className={`tree-row${selectedPath === node.path ? " tree-row-active" : ""}`} type="button" style={{ paddingLeft: 28 + depth * 14 }} onClick={() => file && openFile(file)}>
        <File size={16} />
        <span>{node.name}</span>
      </button>
    );
  };

  return (
    <section className="files-ide" aria-label="Workspace files">
      <header className="ide-tabbar">
        <button className="top-icon" type="button" aria-label="Toggle files" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((open) => !open)}>
          <Folder size={18} />
        </button>
        <div className="editor-tabs" role="tablist" aria-label="Open files">
          {openFiles.length === 0 && <span className="editor-tab-empty">No file open</span>}
          {openFiles.map((file) => (
            <div key={file.path} className={`editor-tab${file.path === active?.path ? " editor-tab-active" : ""}`}>
              <button type="button" onClick={() => onSelect(file)}>{file.path.split("/").pop()}</button>
              <button type="button" aria-label={`Close ${file.path}`} onClick={() => {
                const next = openPaths.filter((path) => path !== file.path);
                setOpenPaths(next);
                const fallback = files.find((item) => item.path === next[next.length - 1]);
                if (fallback) onSelect(fallback);
                else setDrawerOpen(true);
              }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <button className="top-icon" type="button" aria-label="Run preview" onClick={onRun}>
          <Play size={18} />
        </button>
      </header>
      {active ? (
        <CodeEditor file={{ ...active, content: draft }} onChange={onChange} onSave={onSave} isSaved={isSaved} language={active.path.split(".").pop()} />
      ) : (
        <div className="editor-empty">Open a file from the folder icon.</div>
      )}
      {drawerOpen && <button className="drawer-backdrop" type="button" aria-label="Close files" onClick={() => setDrawerOpen(false)} />}
      <aside className={`file-drawer${drawerOpen ? " file-drawer-open" : ""}`} aria-hidden={!drawerOpen}>
        <header className="files-header">
          <h2>{projectName}</h2>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter files" aria-label="Filter files" />
        </header>
        <div className="file-tree" role="tree">
          {files.length === 0 ? <p className="empty-state">No files yet. Use the plus button to create one.</p> : tree.map((node) => renderNode(node))}
        </div>
      </aside>
    </section>
  );
}
