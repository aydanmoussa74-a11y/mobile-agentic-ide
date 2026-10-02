import { useState, useEffect, type PropsWithChildren } from "react";
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

  return (
    <div className="overflow-menu">
      <button 
        className="overflow-menu-button icon-button" 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open global actions"
      >
        <span aria-hidden="true">...</span>
      </button>
      {isOpen && (
        <div className="overflow-menu-dropdown">
          <button className="overflow-menu-item" type="button" onClick={onImportZip}>
            Import ZIP
          </button>
          <button className="overflow-menu-item" type="button" onClick={onExportZip}>
            Export ZIP
          </button>
          <button className="overflow-menu-item" type="button" onClick={onHandover}>
            One-Tap Handover
          </button>
          <button className="overflow-menu-item" type="button" onClick={onRestoreCheckpoint}>
            Checkpoint Restore
          </button>
          <button className="overflow-menu-item" type="button" onClick={onOpenVault}>
            Secret Vault
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderStatus() {
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string; available: boolean }>(
    { usage: "0", quota: "0", available: false }
  );
  const [offlineStatus, setOfflineStatus] = useState<"online" | "offline">("online");
  const [projectInfo, setProjectInfo] = useState<{ name: string; capabilities: string[] }>(
    { name: "No project", capabilities: [] }
  );
  const [branchInfo, setBranchInfo] = useState<{ name: string; snapshotCount: number }>(
    { name: "main", snapshotCount: 0 }
  );

  useEffect(() => {
    async function updateStorageInfo() {
      try {
        const estimate: StorageEstimate = await storageManager.estimate();
        setStorageInfo({
          usage: formatBytes(estimate.usageBytes || 0),
          quota: formatBytes(estimate.quotaBytes || 0),
          available: estimate.available,
        });
      } catch {
        setStorageInfo({ usage: "N/A", quota: "N/A", available: false });
      }
    }

    async function updateProjectInfo() {
      try {
        const manifest = await readProjectManifest();
        setProjectInfo({
          name: manifest.name || "Untitled",
          capabilities: manifest.runtime?.capabilities || [],
        });
      } catch {
        setProjectInfo({ name: "No project", capabilities: [] });
      }
    }

    async function updateBranchInfo() {
      try {
        const currentBranch = await getCurrentBranch();
        const branches: VfsBranch[] = await listBranches();
        const current = branches.find(b => b.name === currentBranch);
        setBranchInfo({
          name: currentBranch,
          snapshotCount: current?.headSnapshotId ? 1 : 0,
        });
      } catch {
        setBranchInfo({ name: "main", snapshotCount: 0 });
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

  return (
    <div className="header-status">
      <div className="status-badge">
        <span className="status-badge-icon">DISK</span>
        <span className="status-badge-text">
          {storageInfo.usage} / {storageInfo.quota}
        </span>
      </div>

      <div className="status-badge">
        <span className="status-badge-icon">
          {offlineStatus === "online" ? "ONLINE" : "OFFLINE"}
        </span>
        <span className="status-badge-text">
          {offlineStatus === "online" ? "Online" : "Offline"}
        </span>
      </div>

      {projectInfo.name !== "No project" && (
        <div className="status-badge project-badge">
          <span className="status-badge-text">{projectInfo.name}</span>
          {projectInfo.capabilities.length > 0 && (
            <div className="capability-badges-mini">
              {projectInfo.capabilities.map(cap => (
                <span key={cap} className={`capability-badge ${cap}`}>
                  {cap}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="status-badge">
        <span className="status-badge-icon">{branchInfo.name}</span>
        <span className="status-badge-text">{branchInfo.snapshotCount} snapshots</span>
      </div>
    </div>
  );
}

export function MobileShell({ children, activeTab, onNavigate }: MobileShellProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("mobile-agentic-ide:onboarding-seen");
    setHasSeenOnboarding(seen === "true");

    if (seen !== "true") {
      setShowOnboarding(true);
    }
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
    const event = new CustomEvent("import-zip");
    window.dispatchEvent(event);
  };

  const handleExportZip = () => {
    onNavigate("workspace");
    const event = new CustomEvent("export-zip");
    window.dispatchEvent(event);
  };

  const handleHandover = () => {
    onNavigate("handoff");
  };

  const handleRestoreCheckpoint = () => {
    onNavigate("workspace");
    const event = new CustomEvent("restore-checkpoint");
    window.dispatchEvent(event);
  };

  const handleOpenVault = () => {
    onNavigate("handoff");
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <p className="eyebrow">Mobile-first workspace</p>
          <h1>Agentic IDE</h1>
        </div>

        <div className="top-bar-center">
          <HeaderStatus />
        </div>

        <div className="top-bar-right">
          <OverflowMenu
            onImportZip={handleImportZip}
            onExportZip={handleExportZip}
            onHandover={handleHandover}
            onRestoreCheckpoint={handleRestoreCheckpoint}
            onOpenVault={handleOpenVault}
          />
        </div>
      </header>

      <main className="main-surface">{children}</main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <a 
          className={`nav-item${activeTab === "workspace" ? " nav-item-active" : ""}`} 
          href="#workspace" 
          aria-current={activeTab === "workspace" ? "page" : undefined} 
          onClick={() => onNavigate("workspace")}
        >
          <span aria-hidden="true">W</span>
          <span>Workspace</span>
        </a>
        <a 
          className={`nav-item${activeTab === "terminal" ? " nav-item-active" : ""}`} 
          href="#terminal" 
          aria-current={activeTab === "terminal" ? "page" : undefined} 
          onClick={() => onNavigate("terminal")}
        >
          <span aria-hidden="true">T</span>
          <span>Terminal</span>
        </a>
        <a 
          className={`nav-item${activeTab === "preview" ? " nav-item-active" : ""}`} 
          href="#preview" 
          aria-current={activeTab === "preview" ? "page" : undefined} 
          onClick={() => onNavigate("preview")}
        >
          <span aria-hidden="true">P</span>
          <span>Preview</span>
        </a>
        <a 
          className={`nav-item${activeTab === "handoff" ? " nav-item-active" : ""}`} 
          href="#handoff" 
          aria-current={activeTab === "handoff" ? "page" : undefined} 
          onClick={() => onNavigate("handoff")}
        >
          <span aria-hidden="true">L</span>
          <span>Ledger</span>
        </a>
        <a 
          className={`nav-item${activeTab === "mcp" ? " nav-item-active" : ""}`} 
          href="#mcp" 
          aria-current={activeTab === "mcp" ? "page" : undefined} 
          onClick={() => onNavigate("mcp")}
        >
          <span aria-hidden="true">M</span>
          <span>MCP</span>
        </a>
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
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
