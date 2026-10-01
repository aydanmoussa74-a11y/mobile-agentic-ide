import { useEffect, useState } from "react";
import { wasmContainer, type WasmMetrics } from "../../lib/wasm";

interface BenchmarkRun { latencyMs: number; readBytes: number; writeBytes: number; completedAt: string; }

export function SandboxBenchmark() {
  const [metrics, setMetrics] = useState<WasmMetrics>(() => wasmContainer.getMetrics());
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<BenchmarkRun | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setMetrics(wasmContainer.getMetrics()), 1500); return () => window.clearInterval(timer); }, []);

  async function runBenchmark() {
    if (running) return;
    setRunning(true);
    const started = performance.now();
    const payload = "sandbox-benchmark\n".repeat(128);
    const bytes = new TextEncoder().encode(payload);
    const path = `.benchmark-${Date.now()}.txt`;
    try { new Uint8Array(wasmContainer.memory.buffer).set(bytes, 0); await wasmContainer.write(path, 0, bytes.length); await wasmContainer.read(path, 0, bytes.length); await wasmContainer.execute("echo benchmark | cat"); await wasmContainer.remove(path); const end = wasmContainer.getMetrics(); setMetrics(end); setLastRun({ latencyMs: Math.round((performance.now() - started) * 100) / 100, readBytes: end.vfsReadBytes - metrics.vfsReadBytes, writeBytes: end.vfsWriteBytes - metrics.vfsWriteBytes, completedAt: new Date().toLocaleTimeString() }); } finally { setRunning(false); }
  }

  return <section className="sandbox-benchmark" aria-labelledby="sandbox-benchmark-title"><div className="test-matrix-heading"><div><p className="eyebrow">Runtime telemetry</p><h3 id="sandbox-benchmark-title">Sandbox Stress Test</h3></div><button className="refresh-button" type="button" onClick={() => { void runBenchmark(); }} disabled={running}>{running ? "…" : "Run"}</button></div><div className="benchmark-grid"><Metric label="Wasm memory" value={`${formatBytes(metrics.memoryBytes)} · ${metrics.memoryPages} pages`} /><Metric label="Last execution" value={`${metrics.lastExecutionMs.toFixed(2)} ms`} /><Metric label="Average execution" value={`${metrics.averageExecutionMs.toFixed(2)} ms`} /><Metric label="VFS read" value={`${formatRate(metrics.readThroughputBytesPerSecond)} · ${metrics.vfsReadOps} ops`} /><Metric label="VFS write" value={`${formatRate(metrics.writeThroughputBytesPerSecond)} · ${metrics.vfsWriteOps} ops`} /><Metric label="Isolation" value={`${metrics.process.totalProcesses} PIDs · ${metrics.process.isolationViolations} violations`} /></div>{lastRun && <p className="benchmark-result" aria-live="polite">Stress run {lastRun.completedAt}: {lastRun.latencyMs.toFixed(2)} ms · read {formatBytes(lastRun.readBytes)} · wrote {formatBytes(lastRun.writeBytes)}.</p>}<p className="scope-note">Metrics are measured locally from WebAssembly.Memory, IndexedDB syscall calls, and virtual process lifecycles.</p></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="benchmark-metric"><span>{label}</span><strong>{value}</strong></div>; }
function formatBytes(value: number): string { if (value < 1024) return `${Math.round(value)} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function formatRate(value: number): string { return `${formatBytes(value)}/s`; }
