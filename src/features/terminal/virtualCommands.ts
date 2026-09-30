import { createDirectory, deleteDirectory, deleteFile, listDirectories, listFiles, readFile } from "../../lib/storage";

export async function runVirtualCommand(command: string): Promise<string> {
  const [verb, ...args] = command.trim().split(/\s+/);
  if (verb === "help") return "ls [path] · cat <file> · mkdir <path> · rm [-r] <path> · node run <file> · git status";
  if (verb === "ls") return formatListing(await listFiles(), await listDirectories(), args[0]);
  if (verb === "cat") { if (!args[0]) throw new Error("cat: missing file path"); const file = await readFile(args[0]); if (!file) throw new Error(`cat: ${args[0]}: file not found`); return file.content || "(empty file)"; }
  if (verb === "mkdir") { if (!args[0]) throw new Error("mkdir: missing directory path"); await createDirectory(args[0]); return `created directory ${args[0]}`; }
  if (verb === "rm") { const path = args.find((arg) => !arg.startsWith("-")); if (!path) throw new Error("rm: missing path"); const file = await readFile(path); if (file) { await deleteFile(path); return `removed ${path}`; } if (args.includes("-r") || args.includes("-rf")) { await deleteDirectory(path); return `removed directory ${path}`; } throw new Error(`rm: ${path}: is a directory or does not exist (use -r for directories)`); }
  if (verb === "node" && args[0] === "run") { const file = await readFile(args[1] ?? ""); if (!file) throw new Error(`node: ${args[1] ?? ""}: file not found`); return executeJavaScript(file.content); }
  if (verb === "git" && args[0] === "status") { const files = await listFiles(); return `On mobile-local workspace\n${files.length ? `${files.length} tracked file${files.length === 1 ? "" : "s"} in IndexedDB` : "No files in IndexedDB"}\nNo remote repository is attached to the virtual terminal.`; }
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
  try { new Function("console", source)(safeConsole); return output.join("\n") || "(node run completed with no console output)"; } catch (error: unknown) { throw new Error(`node run: ${error instanceof Error ? error.message : "script failed"}`); }
}
