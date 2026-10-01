import { useEffect, useMemo, useState } from "react";
import type { VirtualFile } from "../../lib/storage";
import { buildMockScript } from "../../lib/vfs/mockGateway";

interface LivePreviewProps { files: VirtualFile[]; }

export function LivePreview({ files }: LivePreviewProps) {
  const [manualRefresh, setManualRefresh] = useState(0);
  const [mockScript, setMockScript] = useState("");
  useEffect(() => { let active = true; void buildMockScript(files).then((script) => { if (active) setMockScript(script); }).catch(() => { if (active) setMockScript(""); }); return () => { active = false; }; }, [files]);
  const srcDoc = useMemo(() => compileLocalPreview(files, mockScript), [files, manualRefresh, mockScript]);
  const hasHtml = files.some((file) => file.path.endsWith(".html"));

  return (
    <section id="preview" className="workspace-card preview-card" aria-labelledby="preview-title">
      <div className="status-row"><span className="status-dot" aria-hidden="true" /><span>Isolated iframe · auto-refresh on file changes</span><button className="refresh-button" type="button" onClick={() => setManualRefresh((current) => current + 1)} aria-label="Refresh preview">↻</button></div>
      <h2 id="preview-title">See it come alive.</h2>
      <p className="workspace-intro">The preview assembles local HTML, CSS, JavaScript, and optional VFS mock fixtures into a sandboxed <code>srcdoc</code> surface.</p>
      <div className="preview-frame-wrap">
        <iframe className="preview-frame" title="Local project preview" srcDoc={srcDoc} sandbox="allow-scripts" />
      </div>
      <p className="scope-note">{hasHtml ? "index.html · local CSS · local JavaScript · local mocks" : "Create an .html file to start the preview."}</p>
    </section>
  );
}

function compileLocalPreview(files: VirtualFile[], mockScript: string): string {
  const htmlFile = files.find((file) => file.path === "index.html") ?? files.find((file) => file.path.endsWith(".html"));
  const css = files.filter((file) => file.path.endsWith(".css")).map((file) => `/* ${file.path} */\n${file.content}`).join("\n");
  const scripts = files.filter((file) => file.path.endsWith(".js")).map((file) => `// ${file.path}\n${file.content}`).join("\n");
  const source = htmlFile?.content ?? `<main><h1>Local preview</h1><p>Create <code>index.html</code> in the workspace to begin.</p></main>`;
  const hasDocument = /<!doctype|<html[\s>]/i.test(source);
  const document = hasDocument ? source : `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${source}</body></html>`;
  return document.replace(/<\/head>/i, `<style>${escapeClosingTag(css, "style")}</style></head>`).replace(/<\/body>/i, `${mockScript}<script>${escapeClosingTag(scripts, "script")}</script></body>`);
}

function escapeClosingTag(source: string, tag: string): string { return source.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`); }
