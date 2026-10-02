import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FirstRunOnboarding, type OnboardingOption } from "./FirstRunOnboarding";
import { SettingsSheet, type SettingsTab } from "./SettingsSheet";

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
  onQuickCreate: () => void;
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
  const props = {
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tab === "agent") return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /></svg>;
  if (tab === "files") return <svg {...props}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" /></svg>;
  if (tab === "preview") return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3Z" /></svg>;
  return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3M12 15h5" /></svg>;
}

export function MobileShell({
  children,
  activeTab,
  onNavigate,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onQuickCreate,
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
          <span aria-hidden="true">👤</span>
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
          <span aria-hidden="true">⚙</span>
        </button>
        <button className="top-icon" type="button" aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ""}`} onClick={() => setNoticesOpen((open) => !open)}>
          <span aria-hidden="true">🔔</span>
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

      <button className="fab-create" type="button" onClick={onQuickCreate} aria-label="Create a file or project">
        +
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
