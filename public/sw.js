/**
 * Service Worker — qo'lda yozilgan (workbox emas).
 *
 * Nega qo'lda: next-pwa/workbox 5 ta zaiflik olib keladi va webpack'ga
 * tayanadi (biz Turbopack ishlatamiz). Bizga kerak narsa oddiy:
 *  - statik fayllarni keshlash (trafik tejash — o'quvchilar mobil internetda)
 *  - internet yo'q bo'lganda tushunarli sahifa ko'rsatish
 *
 * MUHIM: API so'rovlari va sahifalar HECH QACHON keshdan berilmaydi —
 * o'quvchi eski ball yoki eski vazifani ko'rmasligi kerak.
 */

const VERSION = "v1";
const STATIC_CACHE = `intellectit-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.json"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("intellectit-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API — hech qachon keshlanmaydi (ball, natija, vazifa doim yangi bo'lsin)
  if (url.pathname.startsWith("/api/")) return;

  // Sahifalar — tarmoqdan. Internet yo'q bo'lsa offline sahifasi.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // Statik fayllar (JS, CSS, shrift, rasm) — avval keshdan, keyin tarmoqdan.
  // Next.js fayl nomlariga hash qo'yadi, shuning uchun eskirish xavfi yo'q.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(js|css|woff2?|png|svg|jpg|webp)$/.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
