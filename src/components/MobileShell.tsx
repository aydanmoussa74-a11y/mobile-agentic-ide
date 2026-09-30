import type { PropsWithChildren } from "react";

export type AppTab = "workspace" | "terminal" | "preview" | "handoff";

interface MobileShellProps extends PropsWithChildren {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
}

export function MobileShell({ children, activeTab, onNavigate }: MobileShellProps) {
  return (
    <div className="app-shell">
      <header className="top-bar"><div><p className="eyebrow">Mobile-first workspace</p><h1>Agentic IDE</h1></div><button className="icon-button" type="button" aria-label="Open workspace menu"><span aria-hidden="true">•••</span></button></header>
      <main className="main-surface">{children}</main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <a className={`nav-item${activeTab === "workspace" ? " nav-item-active" : ""}`} href="#workspace" aria-current={activeTab === "workspace" ? "page" : undefined} onClick={() => onNavigate("workspace")}><span aria-hidden="true">⌘</span><span>Workspace</span></a>
        <a className={`nav-item${activeTab === "terminal" ? " nav-item-active" : ""}`} href="#terminal" aria-current={activeTab === "terminal" ? "page" : undefined} onClick={() => onNavigate("terminal")}><span aria-hidden="true">›_</span><span>Terminal</span></a>
        <a className={`nav-item${activeTab === "preview" ? " nav-item-active" : ""}`} href="#preview" aria-current={activeTab === "preview" ? "page" : undefined} onClick={() => onNavigate("preview")}><span aria-hidden="true">▣</span><span>Preview</span></a>
        <a className={`nav-item${activeTab === "handoff" ? " nav-item-active" : ""}`} href="#handoff" aria-current={activeTab === "handoff" ? "page" : undefined} onClick={() => onNavigate("handoff")}><span aria-hidden="true">↗</span><span>Ledger</span></a>
      </nav>
    </div>
  );
}
