import type { PropsWithChildren } from "react";

export function MobileShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Mobile-first workspace</p>
          <h1>Agentic IDE</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Open workspace menu">
          <span aria-hidden="true">•••</span>
        </button>
      </header>
      <main className="main-surface">{children}</main>
      <nav className="bottom-nav" aria-label="Primary navigation">
        <a className="nav-item nav-item-active" href="#workspace" aria-current="page">
          <span aria-hidden="true">⌘</span>
          <span>Workspace</span>
        </a>
        <a className="nav-item" href="#handoff">
          <span aria-hidden="true">↗</span>
          <span>Handoff</span>
        </a>
      </nav>
    </div>
  );
}
