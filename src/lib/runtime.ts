import type { RuntimeCapabilities } from "./types";

export function getRuntimeCapabilities(): RuntimeCapabilities {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  return {
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone)),
    supportsServiceWorker: "serviceWorker" in navigator,
    prefersReducedMotion: mediaQuery.matches,
  };
}
