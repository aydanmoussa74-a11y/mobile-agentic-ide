import type { VirtualFile } from "../lib/storage";

export type StarterTemplate = "react" | "html" | "python";

interface LandingDashboardProps {
  files: VirtualFile[];
  message: string;
  onOpenFile: (file: VirtualFile) => void;
  onCreateTemplate: (template: StarterTemplate) => void;
  creating: boolean;
}

const TEMPLATES: Array<{ id: StarterTemplate; title: string; detail: string }> = [
  { id: "react", title: "React Starter", detail: "A small local component and stylesheet." },
  { id: "html", title: "HTML/CSS Sandbox", detail: "A single page you can preview immediately." },
  { id: "python", title: "Python Script", detail: "A local script for the terminal sandbox." },
];

export function LandingDashboard({ files, message, onOpenFile, onCreateTemplate, creating }: LandingDashboardProps) {
  const recent = [...files].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

  return (
    <section className="landing-dashboard" aria-labelledby="landing-title">
      <p className="eyebrow">This device</p>
      <h2 id="landing-title">Start something local.</h2>
      <p className="workspace-intro">{message}</p>

      <div className="section-heading">
        <h3>Quick start</h3>
      </div>
      <div className="template-grid">
        {TEMPLATES.map((template) => (
          <button key={template.id} className="template-card" type="button" onClick={() => onCreateTemplate(template.id)} disabled={creating}>
            <strong>{template.title}</strong>
            <span>{template.detail}</span>
          </button>
        ))}
      </div>

      <div className="section-heading">
        <h3>Recent workspaces</h3>
        <span>{files.length} files</span>
      </div>
      {recent.length === 0 ? (
        <p className="empty-state">No IndexedDB files yet. Tap a template or the plus button to create one.</p>
      ) : (
        <div className="recent-list" aria-label="Recent local files">
          {recent.map((file) => (
            <button key={file.path} className="recent-row" type="button" onClick={() => onOpenFile(file)}>
              <span>{file.path}</span>
              <small>{new Date(file.updatedAt).toLocaleDateString()}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
