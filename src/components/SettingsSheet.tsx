import { useEffect, useId, useRef, type ReactNode } from "react";

export type SettingsTab = "engine" | "ledger" | "relays" | "status";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  engine: ReactNode;
  ledger: ReactNode;
  relays: ReactNode;
  status: ReactNode;
}

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "engine", label: "API Keys" },
  { id: "ledger", label: "Ledger" },
  { id: "relays", label: "MCP" },
  { id: "status", label: "Status" },
];

export function SettingsSheet({ open, onClose, activeTab, onTabChange, engine, ledger, relays, status }: SettingsSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = activeTab === "engine" ? engine : activeTab === "ledger" ? ledger : activeTab === "relays" ? relays : status;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <section
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-handle" aria-hidden="true" />
        <header className="settings-sheet-header">
          <h2 id={titleId}>Settings</h2>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </header>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab${activeTab === tab.id ? " settings-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-panel" role="tabpanel">
          {panel}
        </div>
      </section>
    </div>
  );
}
