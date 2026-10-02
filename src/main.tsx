import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderRoute } from "./app/routes";
import "./styles/index.css";

// Service Worker registration is disabled to debug GitHub Pages mounting issues
// import { registerServiceWorker } from "./lib/pwa";
// registerServiceWorker();

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", background: "#1a1a1a", color: "#fff", fontFamily: "sans-serif" }}>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || "An error occurred"}</p>
          <p>Please reload the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", marginTop: "10px" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (root) {
  try {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          {renderRoute()}
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (error) {
    // Clear loading indicator and show exact error
    root.innerHTML = `
      <pre style="color:#f87171; padding:20px; white-space:pre-wrap; background:#1a1a1a; font-family:sans-serif; line-height:1.5;">
TOP-LEVEL MOUNT ERROR:
${error instanceof Error ? error.message : String(error)}

Stack:
${error instanceof Error ? error.stack || 'No stack trace' : 'No stack trace'}
      </pre>
    `;
    console.error("Top-level mount failure:", error);
  }
}
