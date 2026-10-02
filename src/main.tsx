import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderRoute } from "./app/routes";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/index.css";

// Cache purge before registering new service worker
async function purgeOldCachesAndRegister(): Promise<void> {
  // Unregister any existing service worker
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }

  // Delete all old caches
  if (caches) {
    const cacheKeys = await caches.keys();
    for (const cacheKey of cacheKeys) {
      await caches.delete(cacheKey);
    }
  }

  // Check for old cache version and force hard reload
  const currentVersion = "v2::2026-10-01";
  const oldVersion = localStorage.getItem("sw-cache-version");
  if (oldVersion && oldVersion !== currentVersion) {
    localStorage.setItem("sw-cache-version", currentVersion);
    window.location.reload();
    return;
  }
  localStorage.setItem("sw-cache-version", currentVersion);

  // Register new service worker
  registerServiceWorker();
}

// Initialize cache purge and SW registration
if ("serviceWorker" in navigator) {
  purgeOldCachesAndRegister().catch(() => {
    // Fallback: register normally if purge fails
    registerServiceWorker();
  });
} else {
  registerServiceWorker();
}

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
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        {renderRoute()}
      </ErrorBoundary>
    </StrictMode>,
  );
}
