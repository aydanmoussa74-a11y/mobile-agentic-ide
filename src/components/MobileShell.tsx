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
    <div className="ios-overflow-menu">
      <button 
        className="ios-overflow-button" 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open global actions"
      >
        <span className="ios-overflow-icon" aria-hidden="true">...</span>
      </button>
      {isOpen && (
        <div className="ios-overflow-dropdown">
          <button className="ios-overflow-item" type="button" onClick={onImportZip}>
            <span className="ios-overflow-icon">IMP</span> Import ZIP
          </button>
          <button className="ios-overflow-item" type="button" onClick={onExportZip}>
            <span className="ios-overflow-icon">EXP</span> Export ZIP
          </button>
          <button className="ios-overflow-item" type="button" onClick={onHandover}>
            <span className="ios-overflow-icon">HO</span> One-Tap Handover
          </button>
          <button className="ios-overflow-item" type="button" onClick={onRestoreCheckpoint}>
            <span className="ios-overflow-icon">REST</span> Restore Checkpoint
          </button>
          <button className="ios-overflow-item" type="button" onClick={onOpenVault}>
            <span className="ios-overflow-icon">VAULT</span> Secret Vault
          </button>
        </div>
      )}
    </div>
  );
}

function HeaderStatus() {
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string; ratio: number }>(
    { usage: "0", quota: "0", ratio: 0 }
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
        const usage = estimate.usageBytes || 0;
        const quota = estimate.quotaBytes || 1;
        const ratio = (usage / quota) * 100;
        setStorageInfo({
          usage: formatBytes(usage),
          quota: formatBytes(quota),
          ratio: Math.round(ratio),
        });
      } catch {
        setStorageInfo({ usage: "N/A", quota: "N/A", ratio: 0 });
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
    <div className="ios-header-status">
      <div className={`ios-status-pill ${offlineStatus}`}>
        <span className="ios-status-pill-icon">
          {offlineStatus === "online" ? "ONLINE" : "OFFLINE"}
        </span>
        <span className="ios-status-pill-text">
          {offlineStatus === "online" ? "Online" : "Offline"}
        </span>
      </div>

      <div className="ios-status-pill">
        <span className="ios-status-pill-icon">DISK</span>
        <span className="ios-status-pill-text">{storageInfo.usage}</span>
        <div className="ios-status-pill-bar">
          <div 
            className="ios-status-pill-bar-fill" 
            style={{ width: `${Math.min(storageInfo.ratio, 100)}%` }}
          />
        </div>
      </div>

      {projectInfo.name !== "No project" && (
        <div className="ios-status-pill project-pill">
          <span className="ios-status-pill-text">{projectInfo.name}</span>
          {projectInfo.capabilities.length > 0 && (
            <div className="ios-capability-badges">
              {projectInfo.capabilities.slice(0, 2).map(cap => (
                <span key={cap} className={`ios-capability-badge ${cap}`}>
                  {cap === "browser-native" ? "Web" : "Wasm"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ios-status-pill">
        <span className="ios-status-pill-icon">{branchInfo.name}</span>
        <span className="ios-status-pill-text">{branchInfo.snapshotCount} snap</span>
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
    <div className="ios-app-shell">
      <header className="ios-nav-bar">
        <div className="ios-nav-left">
          <h1 className="ios-nav-title">Mobile IDE</h1>
        </div>

        <div className="ios-nav-right">
          <HeaderStatus />
          <OverflowMenu
            onImportZip={handleImportZip}
            onExportZip={handleExportZip}
            onHandover={handleHandover}
            onRestoreCheckpoint={handleRestoreCheckpoint}
            onOpenVault={handleOpenVault}
          />
        </div>
      </header>

      <main className="ios-main-surface">{children}</main>

      <nav className="ios-tab-bar" aria-label="Primary navigation">
        <button 
          className={`ios-tab-item${activeTab === "workspace" ? " ios-tab-item-active" : ""}`} 
          aria-current={activeTab === "workspace" ? "page" : undefined} 
          onClick={() => onNavigate("workspace")}
          type="button"
        >
          <span className="ios-tab-icon" aria-hidden="true">📁</span>
          <span className="ios-tab-label">Workspace</span>
        </button>
        <button 
          className={`ios-tab-item${activeTab === "terminal" ? " ios-tab-item-active" : ""}`} 
          aria-current={activeTab === "terminal" ? "page" : undefined} 
          onClick={() => onNavigate("terminal")}
          type="button"
        >
          <span className="ios-tab-icon" aria-hidden="true">💻</span>
          <span className="ios-tab-label">Terminal</span>
        </button>
        <button 
          className={`ios-tab-item${activeTab === "preview" ? " ios-tab-item-active" : ""}`} 
          aria-current={activeTab === "preview" ? "page" : undefined} 
          onClick={() => onNavigate("preview")}
          type="button"
        >
          <span className="ios-tab-icon" aria-hidden="true">🌐</span>
          <span className="ios-tab-label">Preview</span>
        </button>
        <button 
          className={`ios-tab-item${activeTab === "handoff" ? " ios-tab-item-active" : ""}`} 
          aria-current={activeTab === "handoff" ? "page" : undefined} 
          onClick={() => onNavigate("handoff")}
          type="button"
        >
          <span className="ios-tab-icon" aria-hidden="true">📊</span>
          <span className="ios-tab-label">Ledger</span>
        </button>
        <button 
          className={`ios-tab-item${activeTab === "mcp" ? " ios-tab-item-active" : ""}`} 
          aria-current={activeTab === "mcp" ? "page" : undefined} 
          onClick={() => onNavigate("mcp")}
          type="button"
        >
          <span className="ios-tab-icon" aria-hidden="true">🔗</span>
          <span className="ios-tab-label">MCP</span>
        </button>
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
