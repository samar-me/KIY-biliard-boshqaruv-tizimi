const CACHE_NAME = "kiy-pwa-v1";

const STATIC_ASSETS = [
  "/",
  "/favicon.svg",
  "/__grok/icon-180.png",
  "/__grok/manifest.webmanifest",
];

// Install: pre-cache critical shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Pre-cache error:", err);
      });
    }),
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch: Network-first for navigation/HTML, Stale-While-Revalidate for static assets
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST server functions are handled by client offline-ops)
  if (request.method !== "GET") {
    return;
  }

  // 1. Navigation (HTML pages: /, /bar, /hisobot, /sozlamalar)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              cache.put("/", clone); // Also cache as root fallback
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline: try matched cached page or root fallback
          const cached =
            (await caches.match(request)) || (await caches.match("/"));
          if (cached) {
            return cached;
          }
          return new Response(
            "<html><body><h2>Offline</h2><p>Internet yo'q va kesh topilmadi.</p></body></html>",
            { headers: { "Content-Type": "text/html" } },
          );
        }),
    );
    return;
  }

  // 2. Static Assets: JS, CSS, Fonts, Images
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/__grok/") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Cache-First with background revalidation
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // 3. All other GET requests: try network, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
