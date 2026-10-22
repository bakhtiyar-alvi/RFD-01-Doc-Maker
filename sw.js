/* =====================================================================
   Peak GST RFD-01 Form & Document Maker — Service Worker (sw.js v3.4)
   GitHub Pages & Offline-First PWA Caching Engine
   ===================================================================== */

const CACHE_NAME = "peak-rfd01-pwa-v3.4";

// Local App Shell Assets (Relative paths for GitHub Pages compatibility)
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./Logo.png"
];

// External CDN Assets (PDF.js for offline GSTR-3B PDF parsing)
const CDN_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];

// 1. INSTALL: Pre-cache local files and PDF.js CDN files resiliently
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache core local files
      for (const url of LOCAL_ASSETS) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch (err) {
          console.warn("[SW v3.4] Skipped local asset during install:", url, err.message);
        }
      }
      // Cache external PDF.js CDN libraries
      for (const cdnUrl of CDN_ASSETS) {
        try {
          const req = new Request(cdnUrl, { mode: "cors" });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res);
        } catch (err) {
          console.warn("[SW v3.4] Skipped CDN asset during install:", cdnUrl, err.message);
        }
      }
    })
  );
});

// 2. ACTIVATE: Purge older cache versions (v3.1 / v3.2 / v3.3) & claim clients immediately
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(oldKey => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. FETCH: Stale-While-Revalidate for Local App Shell + Cache-First for CDN & Images
self.addEventListener("fetch", event => {
  const req = event.request;

  // Only handle GET requests over http/https
  if (req.method !== "GET" || !req.url.startsWith("http")) return;

  const url = new URL(req.url);

  // Strategy A: External CDN (cdnjs.cloudflare.com) -> Cache-First, fallback to Network
  if (url.hostname.includes("cdnjs.cloudflare.com")) {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        if (cachedRes) return cachedRes;
        return fetch(req).then(netRes => {
          if (netRes && netRes.status === 200) {
            const copy = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return netRes;
        });
      })
    );
    return;
  }

  // Strategy B: Same-Origin Files (index.html, Logo.png, manifest.json) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then(cachedRes => {
      const networkFetch = fetch(req)
        .then(netRes => {
          if (netRes && netRes.status === 200 && netRes.type === "basic") {
            const copy = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return netRes;
        })
        .catch(() => {
          // Offline fallback for page navigation
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return cachedRes;
        });

      return cachedRes || networkFetch;
    })
  );
});
