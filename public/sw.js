const CACHE = "orchid-cache-v2";
const PRECACHE_URLS = ["/login"];

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icon-") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".ico")
  );
}

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Do not cache auth-sensitive pages and API.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/orders" || url.pathname.startsWith("/orders/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const fallback = await caches.match("/login");
        return fallback || offlineResponse();
      })
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }

        return network.then((res) => res || offlineResponse());
      })
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(req);
      return cached || offlineResponse();
    })
  );
});
