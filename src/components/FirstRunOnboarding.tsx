import { useEffect, useState } from "react";
import { readProjectManifest, createProjectManifest, saveProjectManifest } from "../lib/vfs/projectManager";
import { listFiles, createFile } from "../lib/storage";
import { storageManager, type StorageEstimate } from "../lib/vfs/storageManager";

export type OnboardingOption = "blank" | "import" | "github" | "handover" | "sample";

export interface FirstRunOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onOptionSelect: (option: OnboardingOption) => void;
}

const SAMPLE_PROJECT_FILES = [
  { path: "index.html", content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sample Project</title>
</head>
<body>
  <main>
    <h1>Hello from Mobile Agentic IDE</h1>
    <p>This is a sample project to get you started.</p>
    <button onclick="alert('Clicked!')">Try me</button>
  </main>
</body>
</html>` },
  { path: "styles.css", content: `body { font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
h1 { color: #75e6da; }
button { padding: 10px 20px; background: #75e6da; border: none; border-radius: 8px; cursor: pointer; }` },
  { path: "app.js", content: `console.log("Sample app loaded!");
// Try editing this file and see the preview update automatically` },
];

const CAPABILITY_BADGES = [
  { id: "browser-native", label: "browser-native", color: "#75e6da" },
  { id: "wasm-curated", label: "wasm-curated", color: "#93c5fd" },
];

export function FirstRunOnboarding({ isOpen, onClose, onOptionSelect }: FirstRunOnboardingProps) {
  const [step, setStep] = useState<"welcome" | "option" | "confirm">("welcome");
  const [selectedOption, setSelectedOption] = useState<OnboardingOption | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string }>({ usage: "0", quota: "0" });
  const [hasExistingProject, setHasExistingProject] = useState(false);

  useEffect(() => {
    async function checkExisting() {
      const files = await listFiles();
      const hasManifest = files.some((f) => f.path === "project.manifest.json");
      setHasExistingProject(files.length > 0 && hasManifest);

      try {
        const estimate: StorageEstimate = await storageManager.estimate();
        setStorageInfo({
          usage: formatBytes(estimate.usageBytes || 0),
          quota: formatBytes(estimate.quotaBytes || 0),
        });
      } catch {
        setStorageInfo({ usage: "N/A", quota: "N/A" });
      }
    }
    if (isOpen) void checkExisting();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOption = (option: OnboardingOption) => {
    setSelectedOption(option);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selectedOption) return;
    onOptionSelect(selectedOption);

    if (selectedOption === "blank") {
      const manifest = createProjectManifest({ name: "New Project" });
      await saveProjectManifest(manifest);
    } else if (selectedOption === "sample") {
      const manifest = createProjectManifest({ name: "Sample Project" });
      await saveProjectManifest(manifest);
      for (const file of SAMPLE_PROJECT_FILES) {
        await createFile(file.path, file.content);
      }
    }
    onClose();
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-modal">
        {step === "welcome" && (
          <>
            <div className="onboarding-icon">IDE</div>
            <h2 id="onboarding-title">Welcome to Mobile Agentic IDE</h2>
            <p className="onboarding-subtitle">
              A touch-first, offline-capable development environment
            </p>
            <div className="storage-badge">
              <span className="badge-label">Storage</span>
              <span>{storageInfo.usage} / {storageInfo.quota}</span>
            </div>
            <div className="capability-badges">
              {CAPABILITY_BADGES.map((badge) => (
                <span key={badge.id} className={`capability-badge ${badge.id}`}>
                  <span className="capability-dot" />
                  {badge.label}
                </span>
              ))}
            </div>
            <p className="onboarding-description">
              {hasExistingProject
                ? "You have an existing project. Continue where you left off?"
                : "Get started by creating a new project or importing an existing one."}
            </p>
            <div className="onboarding-actions">
              <button className="primary-button" type="button" onClick={() => setStep("option")}>
                {hasExistingProject ? "Continue to Workspace" : "Get Started"}
              </button>
              {hasExistingProject && (
                <button className="secondary-button" type="button" onClick={onClose}>
                  Start Fresh
                </button>
              )}
            </div>
          </>
        )}

        {step === "option" && (
          <>
            <h2>Start a New Project</h2>
            <p className="onboarding-subtitle">Choose how you want to begin</p>
            <div className="option-grid" role="list">
              <button className="option-card" type="button" onClick={() => handleOption("blank")} role="listitem">
                <span className="option-icon">+</span>
                <span className="option-title">Start Blank</span>
                <span className="option-description">Create a fresh project from scratch</span>
              </button>
              <button className="option-card" type="button" onClick={() => handleOption("import")} role="listitem">
                <span className="option-icon">IMPORT</span>
                <span className="option-title">Import ZIP</span>
                <span className="option-description">Load an existing project archive</span>
              </button>
              <button className="option-card" type="button" onClick={() => handleOption("github")} role="listitem">
                <span className="option-icon">GH</span>
                <span className="option-title">Connect GitHub</span>
                <span className="option-description">Clone from a GitHub repository</span>
              </button>
              <button className="option-card" type="button" onClick={() => handleOption("handover")} role="listitem">
                <span className="option-icon">HO</span>
                <span className="option-title">Open Handover</span>
                <span className="option-description">Restore from agent handover payload</span>
              </button>
              <button className="option-card" type="button" onClick={() => handleOption("sample")} role="listitem">
                <span className="option-icon">SAMPLE</span>
                <span className="option-title">Explore Sample</span>
                <span className="option-description">Try a sample project</span>
              </button>
            </div>
            <div className="onboarding-actions">
              <button className="secondary-button" type="button" onClick={() => setStep("welcome")}>
                Back
              </button>
            </div>
          </>
        )}

        {step === "confirm" && selectedOption && (
          <>
            <h2>Confirm: {getOptionLabel(selectedOption)}</h2>
            <p className="onboarding-subtitle">
              {getOptionDescription(selectedOption)}
            </p>
            {selectedOption === "import" && (
              <ImportDropZone onImport={handleConfirm} />
            )}
            <div className="onboarding-actions">
              <button className="secondary-button" type="button" onClick={() => setStep("option")}>
                Back
              </button>
              {selectedOption !== "import" && (
                <button className="primary-button" type="button" onClick={handleConfirm}>
                  Confirm
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getOptionLabel(option: OnboardingOption): string {
  const labels: Record<OnboardingOption, string> = {
    blank: "Start Blank",
    import: "Import ZIP",
    github: "Connect GitHub",
    handover: "Open Handover",
    sample: "Explore Sample Project",
  };
  return labels[option];
}

function getOptionDescription(option: OnboardingOption): string {
  const descriptions: Record<OnboardingOption, string> = {
    blank: "Create a new empty project with default configuration.",
    import: "Import a project from a ZIP archive into your workspace.",
    github: "Connect to GitHub and clone a repository.",
    handover: "Restore a project from an agent handover payload.",
    sample: "Load a sample project to explore the IDE features.",
  };
  return descriptions[option];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

interface ImportDropZoneProps {
  onImport: (file: File) => Promise<void>;
}

function ImportDropZone({ onImport }: ImportDropZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".zip")) {
      void handleFileSelect(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) void handleFileSelect(selectedFile);
  };

  return (
    <div className="import-drop-zone" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <input
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileInput}
        id="import-file-input"
        hidden
      />
      <label htmlFor="import-file-input" className="drop-zone-label">
        <span className="drop-icon">IMPORT</span>
        <span className="drop-text">
          {file ? file.name : "Drop ZIP file here or click to browse"}
        </span>
        <span className="drop-hint">Supports .zip archives</span>
      </label>
      {error && <p className="error-text">{error}</p>}
      {file && !error && (
        <button 
          className="primary-button" 
          type="button"
          onClick={() => void onImport(file)}
        >
          Import Project
        </button>
      )}
    </div>
  );
}
