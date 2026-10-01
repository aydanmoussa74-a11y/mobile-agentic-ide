import { useEffect, useState, useCallback } from "react";
import { scanText, type ScanFinding } from "../lib/security/secretScanner";
import { processScheduler, type ScheduledProcess } from "../lib/agent/processScheduler";
import { logStorage, type ExecutionLog } from "../lib/agent/logStorage";
import { vfsHistory } from "../lib/vfs";

export type AgentPhase = "idle" | "planning" | "reading" | "checkpointing" | "editing" | "testing" | "selfCorrecting" | "complete" | "failed";

export interface AgentActivity {
  id: string;
  phase: AgentPhase;
  message: string;
  timestamp: number;
  filePath?: string;
  testStatus?: "pass" | "fail" | "skipped";
  findings?: ScanFinding[];
  isSecretSafe?: boolean;
}

export interface AgentActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: string;
  activeModel: string;
}

const PHASE_ICONS: Record<AgentPhase, string> = {
  idle: "IDLE",
  planning: "PLAN",
  reading: "READ",
  checkpointing: "CHECK",
  editing: "EDIT",
  testing: "TEST",
  selfCorrecting: "CORR",
  complete: "DONE",
  failed: "FAIL",
};

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: "Idle",
  planning: "Planning",
  reading: "Reading Files",
  checkpointing: "Checkpointing",
  editing: "Editing",
  testing: "Running Tests",
  selfCorrecting: "Self-Correcting",
  complete: "Complete",
  failed: "Failed",
};

const PHASE_COLORS: Record<AgentPhase, string> = {
  idle: "#9aa8bd",
  planning: "#93c5fd",
  reading: "#fde68a",
  checkpointing: "#75e6da",
  editing: "#d1fae5",
  testing: "#86efac",
  selfCorrecting: "#fda4af",
  complete: "#86efac",
  failed: "#fda4af",
};

export function AgentActivityDrawer({ isOpen, onClose, activeProvider, activeModel }: AgentActivityDrawerProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [processes, setProcesses] = useState<ScheduledProcess[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dlpStatus, setDlpStatus] = useState<"safe" | "warning" | "danger">("safe");
  const [isScanning, setIsScanning] = useState(false);

  const refreshProcesses = useCallback(async () => {
    const recentProcesses = await processScheduler.status();
    const processesArray = Array.isArray(recentProcesses) ? recentProcesses : [recentProcesses];
    setProcesses(processesArray);
    const recentLogs = await logStorage.listLogs(undefined, 20);
    setLogs(recentLogs);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshProcesses();
    const interval = setInterval(() => void refreshProcesses(), 2000);
    return () => clearInterval(interval);
  }, [isOpen, refreshProcesses]);

  useEffect(() => {
    const newActivities: AgentActivity[] = processes.map((proc) => {
      let phase: AgentPhase = "idle";
      if (proc.status === "running") phase = "editing";
      else if (proc.status === "completed") phase = "complete";
      else if (proc.status === "failed") phase = "failed";
      else if (proc.status === "queued") phase = "planning";
      return {
        id: proc.id,
        phase,
        message: proc.command || `Process ${proc.id}`,
        timestamp: proc.queuedAt || Date.now(),
        testStatus: proc.exitCode === 0 ? "pass" : proc.exitCode ? "fail" : undefined,
      };
    });
    if (newActivities.length === 0) {
      setActivities([{ id: "initial", phase: "idle", message: "Agent ready - waiting for task", timestamp: Date.now() }]);
    } else {
      setActivities(newActivities);
    }
  }, [processes]);

  useEffect(() => {
    async function checkDlp() {
      setIsScanning(true);
      try {
        const recentLogs = await logStorage.listLogs(undefined, 10);
        const findings: ScanFinding[] = [];
        for (const log of recentLogs) {
          const result = scanText(log.message, log.processId);
          findings.push(...result);
        }
        if (findings.some(f => f.severity === "high")) setDlpStatus("danger");
        else if (findings.length > 0) setDlpStatus("warning");
        else setDlpStatus("safe");
      } catch {
        setDlpStatus("safe");
      } finally {
        setIsScanning(false);
      }
    }
    if (isOpen) void checkDlp();
  }, [isOpen]);

  const handleKillProcess = async (processId: string) => {
    await processScheduler.kill(processId);
    await refreshProcesses();
  };

  const handleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="activity-title">
      <div className="drawer-modal agent-activity-drawer">
        <div className="drawer-header">
          <div className="drawer-title">
            <h2 id="activity-title"><span className="drawer-icon">ACT</span> Agent Activity</h2>
            <span className="drawer-subtitle">{activeProvider} / {activeModel}</span>
          </div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Close">X</button>
        </div>

        <div className="dlp-badge">
          <span className={`dlp-indicator ${dlpStatus}`} />
          <span className="dlp-label">
            {dlpStatus === "safe" ? "Secret & DLP: Safe" :
             dlpStatus === "warning" ? "Secret & DLP: Warning" : "Secret & DLP: Danger - Review Required"}
          </span>
          {isScanning && <span className="dlp-scanning">Scanning...</span>}
        </div>

        <div className="activity-timeline">
          {activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-header">
                <span className="activity-phase" style={{ color: PHASE_COLORS[activity.phase] }}>
                  {PHASE_ICONS[activity.phase]}
                </span>
                <span className="activity-phase-label">{PHASE_LABELS[activity.phase]}</span>
                <span className="activity-time">{new Date(activity.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="activity-message">{activity.message}</div>
              {activity.filePath && <div className="activity-file">{activity.filePath}</div>}
              {activity.testStatus && <div className={`activity-test-status ${activity.testStatus}`}>Test: {activity.testStatus}</div>}
              {activity.findings && activity.findings.length > 0 && <div className="activity-findings">{activity.findings.length} DLP finding(s)</div>}
              {expandedId === activity.id && (
                <div className="activity-details">
                  <pre className="activity-logs">{logs.map(l => l.message).join("\n")}</pre>
                </div>
              )}
              <button className="activity-expand" type="button" onClick={() => handleExpand(activity.id)} aria-expanded={expandedId === activity.id}>
                {expandedId === activity.id ? "-" : "+"}
              </button>
            </div>
          ))}
        </div>

        <div className="drawer-actions">
          <button className="secondary-button" type="button" onClick={refreshProcesses}>Refresh</button>
          <button className="secondary-button" type="button" onClick={async () => { await vfsHistory.checkpoint("Manual checkpoint"); await refreshProcesses(); }}>Checkpoint</button>
        </div>

        {processes.some(p => p.status === "running") && (
          <div className="active-process-bar">
            <span>Active Process</span>
            {processes.filter(p => p.status === "running").map(proc => (
              <button key={proc.id} className="danger-button" type="button" onClick={() => void handleKillProcess(proc.id)}>Kill Process</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
