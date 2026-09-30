import { MobileShell } from "../components/MobileShell";

export function App() {
  return (
    <MobileShell>
      <section id="workspace" className="workspace-card" aria-labelledby="workspace-title">
        <div className="status-row">
          <span className="status-dot" aria-hidden="true" />
          <span>Ready for a session</span>
        </div>
        <h2 id="workspace-title">Start with a focused handover.</h2>
        <p>
          This is the mobile shell foundation. Agent sessions, streamed work, and resumable
          handovers will be added behind this surface in later tasks.
        </p>
        <button className="primary-button" type="button" disabled>
          New session <span aria-hidden="true">→</span>
        </button>
        <p className="scope-note">Baseline only · no model connection is active yet.</p>
      </section>
    </MobileShell>
  );
}
