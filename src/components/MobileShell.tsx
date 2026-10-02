import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Bell, Eye, Folder, Play, Plus, Settings, Terminal, User } from "lucide-react";
import { FirstRunOnboarding, type OnboardingOption } from "./FirstRunOnboarding";
import { SettingsSheet, type SettingsTab } from "./SettingsSheet";
import { QuickActionSheet } from "./QuickActionSheet";

export type AppTab = "agent" | "files" | "preview" | "terminal";

interface Notice {
  id: string;
  title: string;
  body: string;
}

interface MobileShellProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: (query: string) => void;
  onNewFile: (path: string) => Promise<void>;
  onNewFolder: (path: string) => Promise<void>;
  onImportZip: () => void;
  onImportGithub: (owner: string, repo: string) => Promise<void>;
  onExportZip: () => void;
  notifications: Notice[];
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  engine: ReactNode;
  ledger: ReactNode;
  relays: ReactNode;
  status: ReactNode;
  children: ReactNode;
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: "agent", label: "Agent" },
  { id: "files", label: "Files" },
  { id: "preview", label: "Preview" },
  { id: "terminal", label: "Terminal" },
];

function TabGlyph({ tab }: { tab: AppTab }) {
  if (tab === "agent") return <Play size={20} aria-hidden="true" />;
  if (tab === "files") return <Folder size={20} aria-hidden="true" />;
  if (tab === "preview") return <Eye size={20} aria-hidden="true" />;
  return <Terminal size={20} aria-hidden="true" />;
}

export function MobileShell({
  children,
  activeTab,
  onNavigate,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onNewFile,
  onNewFolder,
  onImportZip,
  onImportGithub,
  onExportZip,
  notifications,
  settingsTab,
  onSettingsTabChange,
  engine,
  ledger,
  relays,
  status,
}: MobileShellProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("mobile-agentic-ide:onboarding-seen") !== "true") setShowOnboarding(true);
  }, []);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("mobile-agentic-ide:onboarding-seen", "true");
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    onSearch(searchQuery.trim());
  };

  return (
    <div className="ios-app-shell app-frame">
      <header className="top-command-bar">
        <button className="top-icon" type="button" aria-label="Device profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
          <User size={18} aria-hidden="true" />
        </button>
        <form className="top-search" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="workspace-search">Search workspace or ask agent</label>
          <span className="command-prompt" aria-hidden="true">{">_"}</span>
          <input
            id="workspace-search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search workspace or ask agent..."
            autoComplete="off"
          />
        </form>
        <button className="top-icon" type="button" aria-label="Open settings" onClick={() => { setNoticesOpen(false); setSettingsOpen(true); }}>
          <Settings size={18} aria-hidden="true" />
        </button>
        <button className="top-icon" type="button" aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ""}`} onClick={() => setNoticesOpen((open) => !open)}>
          <Bell size={18} aria-hidden="true" />
          {notifications.length > 0 && <span className="notice-count">{notifications.length}</span>}
        </button>
        {profileOpen && <p className="command-popover">This profile stays on this device. No account is connected.</p>}
        {noticesOpen && (
          <div className="notice-sheet" role="region" aria-label="Notifications">
            {notifications.length === 0 ? <p>No notifications yet.</p> : notifications.map((notice) => (
              <article key={notice.id}>
                <strong>{notice.title}</strong>
                <p>{notice.body}</p>
              </article>
            ))}
          </div>
        )}
      </header>

      <main className="app-scroll">{children}</main>

      <button className="fab-create" type="button" onClick={() => setActionsOpen(true)} aria-label="Create a file or project">
        <Plus size={24} />
      </button>

      <nav className="ios-tab-bar" aria-label="Primary navigation">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`ios-tab-item${active ? " ios-tab-item-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(tab.id)}
              type="button"
            >
              <span className="ios-tab-icon"><TabGlyph tab={tab.id} /></span>
              <span className="ios-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <QuickActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onImportZip={onImportZip}
        onImportGithub={onImportGithub}
        onExportZip={onExportZip}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTab={settingsTab}
        onTabChange={onSettingsTabChange}
        engine={engine}
        ledger={ledger}
        relays={relays}
        status={status}
      />

      <FirstRunOnboarding
        isOpen={showOnboarding}
        onClose={closeOnboarding}
        onOptionSelect={(option: OnboardingOption) => {
          console.log("Selected onboarding option:", option);
          closeOnboarding();
        }}
      />
    </div>
  );
}
