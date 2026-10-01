// @ts-nocheck
const CACHE_NAME = "mobile-agentic-ide-shell-v2";
const CACHE_VERSION = "v2::2026-10-01";

// Core assets that must always be cached
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/robots.txt",
];

// Static asset patterns to cache for offline use
const STATIC_PATTERNS = [
  /\/assets\/.*\.(js|css|woff2?|png|svg|jpg|jpeg|gif)$/,
  /\/sw\.js$/,
];

// Runtime cache for API/data requests (separate from static cache)
const RUNTIME_CACHE = "mobile-agentic-ide-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell().then(() => {
      // Force update on new version
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Clean up old caches
      const oldCaches = keys.filter((key) => {
        // Keep caches that start with our prefix and have the current version
        if (!key.startsWith("mobile-agentic-ide-")) return true;
        // Extract version from cache name
        const parts = key.split("-");
        const version = parts[parts.length - 1];
        // Keep shell caches with version >= v2
        if (key.includes("shell") && version >= "v2") return false;
        return true;
      });
      return Promise.all(oldCaches.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests from our origin
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests - serve from cache or fallback to shell
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        // Fallback to shell
        return caches.match("/").then((shell) => shell || fetch(request));
      })
    );
    return;
  }

  // Check if this is a static asset we should cache
  const isStaticAsset = STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (isStaticAsset) {
    // Cache-first strategy for static assets
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request).then((cached) => cached || caches.match("/"));
    })
  );
});

// Precache the shell and all discovered assets
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);

  // Cache core assets first
  await Promise.all(
    CORE_ASSETS.map((asset) =>
      cache.add(asset).catch(() => {
        console.warn(`[SW] Failed to cache: ${asset}`);
      })
    )
  );

  // Fetch and cache the shell HTML
  const shell = await fetch("/", { cache: "no-store" });
  if (!shell.ok) {
    console.warn("[SW] Failed to fetch shell");
    return;
  }

  await cache.put("/", shell.clone());

  // Parse HTML to discover all assets
  const html = await shell.text();
  const discovered = [...html.matchAll(/(?:src|href|content)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => {
      // Only cache relative URLs from our origin
      if (url.startsWith("data:") || url.startsWith("blob:")) return false;
      if (url.startsWith("//")) return false;
      if (url.startsWith("http://") || url.startsWith("https://")) return false;
      return url.startsWith("/");
    });

  // Add common asset paths that might be missing
  const additionalAssets = [
    "/assets/index-JEWyAWQc.css",
    "/assets/index-9cUcFcfe.js",
  ];

  const allAssets = [...new Set([...discovered, ...additionalAssets])];

  // Cache all discovered assets
  await Promise.all(
    allAssets.map((asset) =>
      cache.add(asset).catch(() => {
        console.warn(`[SW] Failed to cache asset: ${asset}`);
      })
    )
  );

  console.log(`[SW] Pre-cached ${CORE_ASSETS.length + allAssets.length} assets`);
}

// Listen for messages from the client (e.g., to trigger cache updates)
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_UPDATE") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.add(event.data.url);
      })
    );
  }
});
