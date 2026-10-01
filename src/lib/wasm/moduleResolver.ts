import { listFiles, readFile } from "../storage";

export interface ResolvedModule { specifier: string; path: string; content: string; language: "javascript" | "python" | "unknown"; }

export class ModuleResolver {
  private readonly cache = new Map<string, ResolvedModule>();

  async resolve(specifier: string, fromPath = "index.js"): Promise<ResolvedModule> {
    const key = `${fromPath}:${specifier}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const candidates = this.candidates(specifier, fromPath);
    for (const path of candidates) {
      const file = await readFile(path);
      if (file) { const resolved = { specifier, path, content: file.content, language: languageFor(path) }; this.cache.set(key, resolved); return resolved; }
    }
    throw new Error(`module not found: ${specifier} from ${fromPath}`);
  }

  async resolveAll(specifiers: string[], fromPath = "index.js"): Promise<ResolvedModule[]> { return Promise.all(specifiers.map((specifier) => this.resolve(specifier, fromPath))); }
  invalidate(path?: string): void { if (!path) this.cache.clear(); else for (const [key, module] of this.cache) if (module.path === path) this.cache.delete(key); }
  async snapshot(): Promise<ResolvedModule[]> { const files = await listFiles(); return files.filter((file) => /\.(m?js|py)$/.test(file.path)).map((file) => ({ specifier: file.path, path: file.path, content: file.content, language: languageFor(file.path) })); }

  private candidates(specifier: string, fromPath: string): string[] {
    const base = specifier.startsWith(".") ? `${fromPath.split("/").slice(0, -1).join("/")}/${specifier}` : specifier;
    const normalized = base.replace(/^\.\//, "").replace(/\/+/g, "/");
    return [...new Set([normalized, `${normalized}.js`, `${normalized}.mjs`, `${normalized}.py`, `${normalized}/index.js`, `${normalized}/index.py`])];
  }
}

function languageFor(path: string): ResolvedModule["language"] { if (/\.py$/.test(path)) return "python"; if (/\.(m?js)$/.test(path)) return "javascript"; return "unknown"; }
export const moduleResolver = new ModuleResolver();
