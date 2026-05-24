const CACHE_NAME = "myday-static-203747e882a5";
const PRECACHE_ASSETS = [
  "./",
  "./assets/index-Df3XX1IM.js",
  "./assets/index-DheA5q6G.css",
  "./index.html",
  "./manifest.webmanifest",
  "./myday-icon-1024-v2.png",
  "./myday-icon-1024.png",
  "./myday-icon-180-v2.png",
  "./myday-icon-180.png",
  "./myday-icon-192-v2.png",
  "./myday-icon-192.png",
  "./myday-icon-512-v2.png",
  "./myday-icon-512.png",
  "./myday-mark.svg",
  "./rain-window-bg.png"
];

async function cacheAsset(cache, asset) {
  const request = new Request(asset, { cache: "reload" });
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(asset, response);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(PRECACHE_ASSETS.map((asset) => cacheAsset(cache, asset).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("./", copy.clone());
            cache.put("./index.html", copy);
          });
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) ??
            (await caches.match("./index.html")) ??
            (await caches.match("./")) ??
            new Response("MyDay is offline and no cached page is available.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
    );
    return;
  }

  if (["style", "script", "worker", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? Response.error()),
    );
  }
});
