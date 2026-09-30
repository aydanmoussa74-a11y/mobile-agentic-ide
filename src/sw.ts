// @ts-nocheck
const CACHE_NAME = "mobile-agentic-ide-shell-v1";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon.svg", "/robots.txt"];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(caches.match(request).then((cached) => cached || caches.match("/").then((shell) => shell || fetch(request))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); } return response; })));
});

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(CORE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined)));
  const shell = await fetch("/", { cache: "no-store" });
  if (!shell.ok) return;
  await cache.put("/", shell.clone());
  const html = await shell.text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]).filter((url) => url.startsWith("/") && !url.startsWith("//"));
  await Promise.all([...new Set(discovered)].map((asset) => cache.add(asset).catch(() => undefined)));
}
