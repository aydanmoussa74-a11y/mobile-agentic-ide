import { useEffect, useRef, useState } from "react";
import { createDirectory, deleteDirectory, deleteFile, listDirectories, listFiles, readFile } from "../../lib/storage";

interface VirtualTerminalProps { onWorkspaceChange: () => Promise<void> | void; }
interface TerminalLine { kind: "command" | "output" | "error"; text: string; }

export function VirtualTerminal({ onWorkspaceChange }: VirtualTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([{ kind: "output", text: "Mobile Agentic IDE terminal · type help for commands" }]);
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function execute(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;
    setLines((current) => [...current, { kind: "command", text: `$ ${trimmed}` }]);
    try {
      const output = await runVirtualCommand(trimmed);
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
      <p className="scope-note">Commands: ls · cat · mkdir · rm · node run · git status</p>
    </section>
  );
}

async function runVirtualCommand(command: string): Promise<string> {
  const [verb, ...args] = command.split(/\s+/);
  if (verb === "help") return "ls [path] · cat <file> · mkdir <path> · rm [-r] <path> · node run <file> · git status";
  if (verb === "ls") return formatListing(await listFiles(), await listDirectories(), args[0]);
  if (verb === "cat") {
    if (!args[0]) throw new Error("cat: missing file path");
    const file = await readFile(args[0]);
    if (!file) throw new Error(`cat: ${args[0]}: file not found`);
    return file.content || "(empty file)";
  }
  if (verb === "mkdir") {
    if (!args[0]) throw new Error("mkdir: missing directory path");
    await createDirectory(args[0]);
    return `created directory ${args[0]}`;
  }
  if (verb === "rm") {
    const path = args.find((arg) => !arg.startsWith("-"));
    if (!path) throw new Error("rm: missing path");
    const file = await readFile(path);
    if (file) { await deleteFile(path); return `removed ${path}`; }
    if (args.includes("-r") || args.includes("-rf")) { await deleteDirectory(path); return `removed directory ${path}`; }
    throw new Error(`rm: ${path}: is a directory or does not exist (use -r for directories)`);
  }
  if (verb === "node" && args[0] === "run") {
    const file = await readFile(args[1] ?? "");
    if (!file) throw new Error(`node: ${args[1] ?? ""}: file not found`);
    return executeJavaScript(file.content);
  }
  if (verb === "git" && args[0] === "status") {
    const files = await listFiles();
    return `On mobile-local workspace\n${files.length ? `${files.length} tracked file${files.length === 1 ? "" : "s"} in IndexedDB` : "No files in IndexedDB"}\nNo remote repository is attached to the virtual terminal.`;
  }
  throw new Error(`${verb}: command not found`);
}

function formatListing(files: Awaited<ReturnType<typeof listFiles>>, directories: string[], path?: string): string {
  const prefix = path ? `${path.replace(/\/+$/, "")}/` : "";
  const names = [...directories.filter((directory) => directory.startsWith(prefix) && !directory.slice(prefix.length).includes("/")), ...files.filter((file) => file.path.startsWith(prefix) && !file.path.slice(prefix.length).includes("/")).map((file) => file.path)].map((entry) => entry.slice(prefix.length));
  return [...new Set(names)].sort().join("  ") || "(empty)";
}

function executeJavaScript(source: string): string {
  const output: string[] = [];
  const safeConsole = { log: (...values: unknown[]) => output.push(values.map(String).join(" ")), warn: (...values: unknown[]) => output.push(`warn: ${values.map(String).join(" ")}`), error: (...values: unknown[]) => output.push(`error: ${values.map(String).join(" ")}`) };
  try {
    new Function("console", source)(safeConsole);
    return output.join("\n") || "(node run completed with no console output)";
  } catch (error: unknown) { throw new Error(`node run: ${error instanceof Error ? error.message : "script failed"}`); }
}
