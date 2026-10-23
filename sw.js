/* =====================================================================
   Peak GST RFD-01 Form & Document Maker PWA — Offline Service Worker
   File: sw.js (v3.4.1)
   ===================================================================== */

const CACHE_NAME = "peak-gst-rfd01-pwa-v3.4.1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./Logo.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];

// 1. INSTALL: Pre-cache core app shell, Logo.png & PDF.js (fault-tolerant)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map(async (url) => {
          try {
            const req = new Request(url, { mode: url.startsWith("http") ? "cors" : "same-origin" });
            const res = await fetch(req);
            if (res && (res.ok || res.type === "opaque")) {
              await cache.put(req, res);
            }
          } catch (err) {
            console.warn("[SW] Skipped pre-caching asset:", url, err);
          }
        })
      );
    })
  );
});

// 2. ACTIVATE: Clean up older cache versions & claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. FETCH: Stale-While-Revalidate for fast offline load + background updates
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests over http/https (ignore blob:, data:, chrome-extension:)
  if (req.method !== "GET" || !req.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const networkFetch = fetch(req)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === "opaque")
          ) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, resClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for page navigation requests
          if (req.mode === "navigate") {
            return caches.match("./index.html") || caches.match("./");
          }
          return cachedResponse;
        });

      // Return cached copy immediately if available; otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});
