export type PwaStatus = "unsupported" | "registering" | "active" | "update-ready" | "offline" | "error";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) { announce("unsupported"); return; }
  announce("registering");
  window.addEventListener("online", () => announce("active"));
  window.addEventListener("offline", () => announce("offline"));
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.active) announce("active");
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) announce("update-ready");
          if (worker.state === "activated") announce("active");
        });
      });
    }).catch(() => announce("error"));
  }, { once: true });
}

function announce(status: PwaStatus): void {
  window.dispatchEvent(new CustomEvent<PwaStatus>("mobile-agentic-ide:pwa-status", { detail: status }));
}
