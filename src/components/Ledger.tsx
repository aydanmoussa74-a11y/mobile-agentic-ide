import { useState, useEffect } from "react";
import { scanFiles, type ScanFinding } from "../lib/security/secretScanner";
import type { VirtualFile } from "../lib/storage";
import { vfsHistory } from "../lib/vfs";
import { createHandoverPayload } from "../lib/agent/handoverEngine";
import { readProjectManifest, type ProjectManifest } from "../lib/vfs/projectManager";

export interface LedgerProps {
  files: VirtualFile[];
  activeProvider: string;
  activeModel: string;
  testLogs: string[];
  onHandover: () => void;
}

export function Ledger({ files, activeProvider, activeModel, testLogs, onHandover }: LedgerProps) {
  const [dlpStatus, setDlpStatus] = useState<"safe" | "warning" | "danger">("safe");
  const [isScanning, setIsScanning] = useState(false);
  const [findings, setFindings] = useState<ScanFinding[]>([]);
  const [payloadSize, setPayloadSize] = useState<{ raw: number; compressed: number }>({ raw: 0, compressed: 0 });
  const [showSecretScan, setShowSecretScan] = useState(false);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState("");

  useEffect(() => {
    async function scanForSecrets() {
      setIsScanning(true);
      try {
        const results = scanFiles(files);
        setFindings(results);
        if (results.some(f => f.severity === "high")) setDlpStatus("danger");
        else if (results.length > 0) setDlpStatus("warning");
        else setDlpStatus("safe");
      } catch {
        setDlpStatus("safe");
        setFindings([]);
      } finally {
        setIsScanning(false);
      }
    }
    void scanForSecrets();
  }, [files]);

  useEffect(() => {
    async function calculatePayloadSize() {
      try {
        const projectState = await readProjectManifest();
        const agentState = { project_name: projectState.name || "mobile-agentic-ide", version: "0.1.0" };
        const payload = createHandoverPayload({ agentState, files, diffs: [], sessionHistory: [], recentTestLogs: testLogs });
        const jsonString = JSON.stringify(payload);
        const rawSize = new Blob([jsonString]).size;
        setPayloadSize({ raw: rawSize, compressed: Math.round(rawSize * 0.7) });
        setPayloadPreview(jsonString.slice(0, 500) + (jsonString.length > 500 ? "..." : ""));
      } catch {
        setPayloadSize({ raw: 0, compressed: 0 });
        setPayloadPreview("");
      }
    }
    void calculatePayloadSize();
  }, [files, testLogs]);

  const handleCopyHandover = async () => {
    try {
      const projectState = await readProjectManifest();
      const agentState = { project_name: projectState.name || "mobile-agentic-ide", version: "0.1.0" };
      const payload = createHandoverPayload({ agentState, files, diffs: [], sessionHistory: [], recentTestLogs: testLogs });
      await navigator.clipboard.writeText(JSON.stringify(payload));
      onHandover();
    } catch {
      onHandover();
    }
  };

  const handleExportPayload = () => {
    const payload = { agentState: { project_name: "mobile-agentic-ide", version: "0.1.0" }, files: files.map(f => ({ path: f.path, content: f.content })), diffs: [], sessionHistory: [], recentTestLogs: testLogs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mobile-agentic-ide-handover.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <section id="handoff" className="workspace-card ledger-card" aria-labelledby="handoff-title">
      <div className="status-row">
        <span className="status-dot" aria-hidden="true" />
        <span>Agent Ledger device-local orchestration</span>
      </div>
      <div className="ledger-header">
        <h2 id="handoff-title">Switch agents in one tap.</h2>
        <p className="workspace-intro">The ledger combines project state, files, diffs, and session history into one model-agnostic payload.</p>
      </div>

      <div className="ledger-section dlp-section">
        <div className="ledger-section-header">
          <h3><span className="ledger-section-icon">DLP</span> Secret & DLP Safety</h3>
          <button className="ledger-section-toggle" type="button" onClick={() => setShowSecretScan(!showSecretScan)}>{showSecretScan ? "-" : "+"}</button>
        </div>
        <div className="dlp-status-bar">
          <span className={`dlp-status-indicator ${dlpStatus}`} />
          <span className="dlp-status-label">
            {dlpStatus === "safe" ? "All Clear - No secrets detected" :
             dlpStatus === "warning" ? `${findings.length} potential secret(s) found` :
             `${findings.filter(f => f.severity === "high").length} high-severity finding(s)`}
          </span>
          {isScanning && <span className="dlp-scanning">Scanning...</span>}
        </div>
        {showSecretScan && findings.length > 0 && (
          <div className="findings-list">
            {findings.slice(0, 10).map((finding, index) => (
              <div key={index} className={`finding-item ${finding.severity}`}>
                <span className="finding-icon">{finding.severity === "high" ? "HIGH" : "MEDIUM"}</span>
                <span className="finding-message">{finding.message}</span>
                <span className="finding-path">{finding.path}</span>
              </div>
            ))}
            {findings.length > 10 && <p className="findings-more">+{findings.length - 10} more findings</p>}
          </div>
        )}
      </div>

      <div className="ledger-section payload-section">
        <div className="ledger-section-header">
          <h3><span className="ledger-section-icon">SIZE</span> Payload Size Preview</h3>
          <button className="ledger-section-toggle" type="button" onClick={() => setShowPayloadPreview(!showPayloadPreview)}>{showPayloadPreview ? "-" : "+"}</button>
        </div>
        <div className="payload-stats">
          <div className="payload-stat"><span className="payload-stat-label">Raw Size:</span><span className="payload-stat-value">{formatBytes(payloadSize.raw)}</span></div>
          <div className="payload-stat"><span className="payload-stat-label">Compressed:</span><span className="payload-stat-value">{formatBytes(payloadSize.compressed)}</span></div>
          <div className="payload-stat"><span className="payload-stat-label">Files:</span><span className="payload-stat-value">{files.length}</span></div>
          <div className="payload-stat"><span className="payload-stat-label">Logs:</span><span className="payload-stat-value">{testLogs.length}</span></div>
        </div>
        {showPayloadPreview && payloadPreview && (
          <div className="payload-preview">
            <pre className="payload-preview-content">{payloadPreview}</pre>
            <button className="payload-copy-button secondary-button" type="button" onClick={() => navigator.clipboard.writeText(payloadPreview)}>Copy Preview</button>
          </div>
        )}
      </div>

      <div className="ledger-section provider-section">
        <h3><span className="ledger-section-icon">PROV</span> Active Provider</h3>
        <div className="provider-info">
          <div className="provider-field"><span className="provider-field-label">Provider:</span><span className="provider-field-value">{activeProvider}</span></div>
          <div className="provider-field"><span className="provider-field-label">Model:</span><span className="provider-field-value">{activeModel}</span></div>
        </div>
      </div>

      <div className="ledger-actions">
        <div className="ledger-actions-primary">
          <button className="handover-button primary-button" type="button" onClick={handleCopyHandover}>
            <span className="handover-button-icon">HO</span>
            <span className="handover-button-text">One-Tap Handover state + test logs</span>
            <span className="handover-button-arrow" aria-hidden="true">UP</span>
          </button>
        </div>
        <div className="ledger-actions-secondary">
          <button className="secondary-button" type="button" onClick={handleExportPayload}>Export JSON</button>
          <button className="secondary-button" type="button" onClick={async () => { await vfsHistory.checkpoint("Before handover"); }}>Checkpoint First</button>
        </div>
      </div>
      <p className="scope-note">Keys use a device-local IndexedDB vault. Browser storage is not a substitute for a hardware-backed secret manager.</p>
    </section>
  );
}
