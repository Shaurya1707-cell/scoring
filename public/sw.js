const CACHE_NAME = "pickleball-referee-cache-v1";
const ASSETS_TO_CACHE = [
  "/login",
  "/referee",
  "/manifest.json",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only intercept HTTP/S GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  
  // Skip caching API routes, hot-reload websockets, and live SSE stream
  if (url.pathname.startsWith("/api/") || url.pathname.includes("_next") || url.pathname.includes("webpack")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request)
        .then((response) => {
          // If valid response, clone it and cache it for future offline use
          if (response && response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseCopy);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails completely and it's a page navigation, return cached referee or login page
          if (event.request.mode === "navigate") {
            return caches.match("/login") || caches.match("/referee");
          }
        });
    })
  );
});
