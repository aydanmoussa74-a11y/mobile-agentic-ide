import { useEffect, useRef, useState } from "react";
import { runVirtualCommand as runSharedVirtualCommand } from "./virtualCommands";
import { createDirectory, deleteDirectory, deleteFile, listDirectories, listFiles, readFile } from "../../lib/storage";
import { TestMatrix } from "./TestMatrix";
import type { TestRunResult } from "../../lib/testing/testRunner";

interface VirtualTerminalProps { onWorkspaceChange: () => Promise<void> | void; testResult: TestRunResult | null; testsRunning: boolean; onRunTests: () => void; }
interface TerminalLine { kind: "command" | "output" | "error"; text: string; }

export function VirtualTerminal({ onWorkspaceChange, testResult, testsRunning, onRunTests }: VirtualTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([{ kind: "output", text: "Mobile Agentic IDE terminal · type help for commands" }]);
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function execute(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;
    setLines((current) => [...current, { kind: "command", text: `$ ${trimmed}` }]);
    try {
      const output = await runSharedVirtualCommand(trimmed);
      if (output) setLines((current) => [...current, { kind: "output", text: output }]);
      if (/^(mkdir|rm)(\s|$)/.test(trimmed)) await onWorkspaceChange();
    } catch (error: unknown) {
      setLines((current) => [...current, { kind: "error", text: error instanceof Error ? error.message : "Command failed." }]);
    }
    setCommand("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); void execute(command); }

  return (
    <section id="terminal" className="workspace-card terminal-card" aria-labelledby="terminal-title">
      <div className="status-row"><span className="status-dot" aria-hidden="true" /><span>Local virtual shell · no server process</span></div>
      <h2 id="terminal-title">Run the workspace.</h2>
      <p className="workspace-intro">Touch-friendly commands operate against the same IndexedDB files used by the editor and preview.</p>
      <div className="terminal-output" role="log" aria-live="polite" onClick={() => inputRef.current?.focus()}>
        {lines.map((line, index) => <div className={`terminal-line terminal-${line.kind}`} key={`${index}-${line.text}`}>{line.text}</div>)}
      </div>
      <form className="terminal-form" onSubmit={handleSubmit}>
        <label htmlFor="terminal-command">Command</label>
        <div className="input-row"><span className="terminal-prompt" aria-hidden="true">$</span><input ref={inputRef} id="terminal-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="ls" autoComplete="off" autoCapitalize="none" spellCheck={false} /><button className="primary-button" type="submit">Run</button></div>
      </form>
      <TestMatrix result={testResult} running={testsRunning} onRun={onRunTests} />
      <p className="scope-note">Commands: ls · cat · mkdir · rm · node run · git status</p>
    </section>
  );
}
