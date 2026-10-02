import { useEffect, useState, type PropsWithChildren } from "react";
import { storageManager, type StorageEstimate } from "../lib/vfs/storageManager";
import { readProjectManifest } from "../lib/vfs/projectManager";
import { listBranches, getCurrentBranch, type VfsBranch } from "../lib/vfs/vfsBranching";
import { FirstRunOnboarding, type OnboardingOption } from "./FirstRunOnboarding";

export type AppTab = "workspace" | "terminal" | "preview" | "handoff" | "mcp";

interface MobileShellProps extends PropsWithChildren {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
}

interface OverflowMenuProps {
  onImportZip: () => void;
  onExportZip: () => void;
  onHandover: () => void;
  onRestoreCheckpoint: () => void;
  onOpenVault: () => void;
}

function OverflowMenu({
  onImportZip,
  onExportZip,
  onHandover,
  onRestoreCheckpoint,
  onOpenVault,
}: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const run = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="ios-overflow-menu">
      <button
        className="ios-overflow-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open global actions"
        aria-expanded={isOpen}
      >
        <span className="ios-overflow-icon" aria-hidden="true">...</span>
      </button>
      {isOpen && (
        <div className="ios-overflow-dropdown" role="menu">
          <button className="ios-overflow-item" type="button" onClick={() => run(onImportZip)}>
            <span className="ios-overflow-icon">IMP</span> Import ZIP
          </button>
          <button className="ios-overflow-item" type="button" onClick={() => run(onExportZip)}>
            <span className="ios-overflow-icon">EXP</span> Export ZIP
          </button>
          <button className="ios-overflow-item" type="button" onClick={() => run(onHandover)}>
            <span className="ios-overflow-icon">HO</span> One-Tap Handover
          </button>
          <button className="ios-overflow-item" type="button" onClick={() => run(onRestoreCheckpoint)}>
            <span className="ios-overflow-icon">REST</span> Restore Checkpoint
          </button>
          <button className="ios-overflow-item" type="button" onClick={() => run(onOpenVault)}>
            <span className="ios-overflow-icon">VAULT</span> Secret Vault
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderStatus() {
  const [storageInfo, setStorageInfo] = useState<{ usage: string; ratio: number }>({ usage: "0 B", ratio: 0 });
  const [offlineStatus, setOfflineStatus] = useState<"online" | "offline">("online");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [branchName, setBranchName] = useState("main");

  useEffect(() => {
    async function updateStorageInfo() {
      try {
        const estimate: StorageEstimate = await storageManager.estimate();
        const usage = estimate.usageBytes || 0;
        const quota = estimate.quotaBytes || 1;
        setStorageInfo({
          usage: formatBytes(usage),
          ratio: Math.round((usage / quota) * 100),
        });
      } catch {
        setStorageInfo({ usage: "N/A", ratio: 0 });
      }
    }

    async function updateProjectInfo() {
      try {
        const manifest = await readProjectManifest();
        setCapabilities(manifest.runtime?.capabilities || []);
      } catch {
        setCapabilities([]);
      }
    }

    async function updateBranchInfo() {
      try {
        const currentBranch = await getCurrentBranch();
        const branches: VfsBranch[] = await listBranches();
        const current = branches.find((branch) => branch.name === currentBranch);
        setBranchName(current?.name || currentBranch || "main");
      } catch {
        setBranchName("main");
      }
    }

    void updateStorageInfo();
    void updateProjectInfo();
    void updateBranchInfo();

    const interval = setInterval(() => {
      void updateStorageInfo();
    }, 5000);

    const offlineHandler = () => setOfflineStatus("offline");
    const onlineHandler = () => setOfflineStatus("online");
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("online", onlineHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("online", onlineHandler);
    };
  }, []);

  const webActive = capabilities.includes("browser-native");
  const wasmActive = capabilities.includes("wasm-curated");

  return (
    <div className="ios-header-status" aria-label="Runtime status">
      <div className={`ios-status-pill ${offlineStatus}`}>
        <span className="ios-status-pill-icon">{offlineStatus === "online" ? "ONLINE" : "OFFLINE"}</span>
      </div>
      <div className="ios-status-pill">
        <span className="ios-status-pill-icon">DISK</span>
        <span className="ios-status-pill-text">{storageInfo.usage}</span>
        <div className="ios-status-pill-bar" aria-hidden="true">
          <div className="ios-status-pill-bar-fill" style={{ width: `${Math.min(storageInfo.ratio, 100)}%` }} />
        </div>
      </div>
      <div className={`ios-status-pill${webActive ? " project-pill" : ""}`}>
        <span className="ios-status-pill-icon">WEB</span>
      </div>
      <div className={`ios-status-pill${wasmActive ? " project-pill" : ""}`}>
        <span className="ios-status-pill-icon">WASM</span>
      </div>
      <div className="ios-status-pill">
        <span className="ios-status-pill-icon">{branchName}</span>
      </div>
    </div>
  );
}

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
  if (tab === "workspace") {
    return <svg {...props}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" /></svg>;
  }
  if (tab === "terminal") {
    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3M12 15h5" /></svg>;
  }
  if (tab === "preview") {
    return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3Z" /></svg>;
  }
  if (tab === "handoff") {
    return <svg {...props}><path d="M8 6h11v12H8z" /><path d="M5 9h3v9H5zM8 10h7M8 14h5" /></svg>;
  }
  return <svg {...props}><path d="M8 8h8v8H8z" /><path d="M10 8V5h4v3M14 16v3h-4v-3M8 10H5v4h3M16 10h3v4h-3" /></svg>;
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: "workspace", label: "Workspace" },
  { id: "terminal", label: "Terminal" },
  { id: "preview", label: "Preview" },
  { id: "handoff", label: "Ledger" },
  { id: "mcp", label: "MCP" },
];

export function MobileShell({ children, activeTab, onNavigate }: MobileShellProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("mobile-agentic-ide:onboarding-seen");
    if (seen !== "true") setShowOnboarding(true);
  }, []);

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    localStorage.setItem("mobile-agentic-ide:onboarding-seen", "true");
  };

  const handleOnboardingSelect = (option: OnboardingOption) => {
    console.log("Selected onboarding option:", option);
    handleOnboardingClose();
  };

  const handleImportZip = () => {
    onNavigate("workspace");
    window.dispatchEvent(new CustomEvent("import-zip"));
  };
  const handleExportZip = () => {
    onNavigate("workspace");
    window.dispatchEvent(new CustomEvent("export-zip"));
  };
  const handleRestoreCheckpoint = () => {
    onNavigate("workspace");
    window.dispatchEvent(new CustomEvent("restore-checkpoint"));
  };

  return (
    <div className="ios-app-shell">
      <header className="ios-nav-bar">
        <div className="ios-nav-top">
          <h1 className="ios-nav-title">Mobile IDE</h1>
          <OverflowMenu
            onImportZip={handleImportZip}
            onExportZip={handleExportZip}
            onHandover={() => onNavigate("handoff")}
            onRestoreCheckpoint={handleRestoreCheckpoint}
            onOpenVault={() => onNavigate("handoff")}
          />
        </div>
        <div className="ios-nav-status-row">
          <HeaderStatus />
        </div>
      </header>

      <main className="ios-main-surface">{children}</main>

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

      <FirstRunOnboarding
        isOpen={showOnboarding}
        onClose={handleOnboardingClose}
        onOptionSelect={handleOnboardingSelect}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
