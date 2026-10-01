import { createFile, listFiles, readFile, updateFile, type VirtualFile } from "../storage";
import { buildZip } from "../export/projectZip";
import { scanFiles, type ScanFinding } from "../security/secretScanner";

export const PROJECT_MANIFEST_PATH = "project.manifest.json";
export const PROJECT_MANIFEST_VERSION = 1;
export type RuntimeCapability = "browser-native" | "wasm-curated";

export interface ProjectManifest {
  schemaVersion: typeof PROJECT_MANIFEST_VERSION;
  projectId: string;
  name: string;
  runtime: { capabilities: RuntimeCapability[]; entryPoints: string[] };
  dependencies: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ImportLimits {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  rejectSecrets?: boolean;
}

export interface ImportResult {
  files: VirtualFile[];
  manifest: ProjectManifest;
  findings: ScanFinding[];
  skipped: string[];
  totalBytes: number;
}

const DEFAULT_LIMITS: Required<ImportLimits> = { maxFiles: 500, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024, rejectSecrets: true };

export function createProjectManifest(input: Partial<Pick<ProjectManifest, "projectId" | "name" | "runtime" | "dependencies">> = {}): ProjectManifest {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_MANIFEST_VERSION,
    projectId: input.projectId?.trim() || crypto.randomUUID(),
    name: input.name?.trim() || "Untitled mobile project",
    runtime: input.runtime ?? { capabilities: ["browser-native", "wasm-curated"], entryPoints: ["index.html"] },
    dependencies: input.dependencies ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function readProjectManifest(): Promise<ProjectManifest> {
  const file = await readFile(PROJECT_MANIFEST_PATH);
  if (!file) return createProjectManifest();
  return validateProjectManifest(JSON.parse(file.content) as unknown);
}

export async function saveProjectManifest(manifest: ProjectManifest): Promise<ProjectManifest> {
  const valid = validateProjectManifest({ ...manifest, updatedAt: new Date().toISOString() });
  const content = JSON.stringify(valid, null, 2);
  const existing = await readFile(PROJECT_MANIFEST_PATH);
  if (existing) await updateFile(PROJECT_MANIFEST_PATH, content); else await createFile(PROJECT_MANIFEST_PATH, content);
  return valid;
}

export async function exportProjectZip(options: { filename?: string; rejectSecrets?: boolean } = {}): Promise<Blob> {
  const files = await listFiles();
  const findings = scanFiles(files);
  if (options.rejectSecrets !== false && findings.some((finding) => finding.severity === "high")) throw new Error(`Export blocked: ${findings.length} potential secret finding${findings.length === 1 ? "" : "s"}. Review or remove sensitive files first.`);
  return buildZip(files);
}

export async function importProjectZip(source: Blob | ArrayBuffer | Uint8Array, limits: ImportLimits = {}): Promise<ImportResult> {
  const config = { ...DEFAULT_LIMITS, ...limits };
  const bytes = source instanceof Blob ? new Uint8Array(await source.arrayBuffer()) : source instanceof ArrayBuffer ? new Uint8Array(source) : source;
  const entries = await readZipEntries(bytes);
  if (entries.length > config.maxFiles) throw new Error(`Import blocked: archives may contain at most ${config.maxFiles} files.`);
  const candidates: VirtualFile[] = [];
  const skipped: string[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const path = normalizeImportedPath(entry.name);
    if (!path || entry.directory) { if (entry.directory) skipped.push(entry.name); continue; }
    if (entry.data.length > config.maxFileBytes) throw new Error(`Import blocked: ${path} exceeds the ${config.maxFileBytes}-byte file limit.`);
    totalBytes += entry.data.length;
    if (totalBytes > config.maxTotalBytes) throw new Error(`Import blocked: archive exceeds the ${config.maxTotalBytes}-byte total limit.`);
    const content = new TextDecoder().decode(entry.data);
    candidates.push({ path, content, createdAt: Date.now(), updatedAt: Date.now() });
  }
  const findings = scanFiles(candidates);
  if (config.rejectSecrets && findings.some((finding) => finding.severity === "high")) throw new Error(`Import blocked: ${findings.length} potential secret finding${findings.length === 1 ? "" : "s"}.`);
  const imported = candidates.filter((file) => file.path !== PROJECT_MANIFEST_PATH);
  for (const file of imported) { const existing = await readFile(file.path); if (existing) await updateFile(file.path, file.content); else await createFile(file.path, file.content); }
  const manifestEntry = candidates.find((file) => file.path === PROJECT_MANIFEST_PATH);
  const manifest = manifestEntry ? validateProjectManifest(JSON.parse(manifestEntry.content) as unknown) : createProjectManifest({ name: inferProjectName(candidates) });
  await saveProjectManifest(manifest);
  return { files: imported, manifest, findings, skipped, totalBytes };
}

function validateProjectManifest(value: unknown): ProjectManifest {
  if (!isRecord(value) || value.schemaVersion !== PROJECT_MANIFEST_VERSION || typeof value.projectId !== "string" || typeof value.name !== "string" || !isRecord(value.runtime) || !Array.isArray(value.runtime.capabilities) || !Array.isArray(value.runtime.entryPoints) || !isRecord(value.dependencies) || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") throw new Error("Invalid project.manifest.json schema.");
  const capabilities = value.runtime.capabilities.filter((item): item is RuntimeCapability => item === "browser-native" || item === "wasm-curated");
  const entryPoints = value.runtime.entryPoints.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  const dependencies = Object.fromEntries(Object.entries(value.dependencies).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"));
  if (!capabilities.length || !entryPoints.length) throw new Error("Project manifest requires runtime capabilities and entry points.");
  return { schemaVersion: PROJECT_MANIFEST_VERSION, projectId: value.projectId.trim(), name: value.name.trim(), runtime: { capabilities, entryPoints }, dependencies, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

interface ZipEntry { name: string; data: Uint8Array; directory: boolean; }
async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50 || signature === 0x07064b50) break;
    if (signature !== 0x04034b50) throw new Error("Unsupported or corrupt ZIP archive.");
    if (offset + 30 > bytes.length) throw new Error("Truncated ZIP entry.");
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    if (flags & 0x08) throw new Error("ZIP data descriptors are not supported; export from this IDE or use a standard archive without streaming entries.");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (compressed.length !== compressedSize) throw new Error("Truncated ZIP payload.");
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : (() => { throw new Error(`Unsupported ZIP compression method: ${method}.`); })();
    entries.push({ name, data, directory: name.endsWith("/") });
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot import deflated ZIP archives; use an uncompressed export or update the browser.");
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const stream = new Blob([owned.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function normalizeImportedPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) return "";
  return normalized;
}
function inferProjectName(files: VirtualFile[]): string { return files.find((file) => file.path === "index.html") ? "Imported web project" : "Imported mobile project"; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
