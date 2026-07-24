/* GUITAR TOGETHER — 서비스 워커
   - 페이지(navigation): network-first (항상 최신, 오프라인 시 캐시)
   - 정적 자원: cache-first */
const CACHE = "gt-shell-v4";
const SHELL = ["/", "/reservation", "/board", "/setlist", "/members", "/finance"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // 페이지 이동 요청 → network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/")))
    );
    return;
  }

  // 그 외 자원 → cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});

/* ---------- 웹푸시 ---------- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "기타투게더", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "기타투게더";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* 브라우저가 구독을 자동 교체하면 새 구독을 서버에 다시 등록 — 회원 연결 유지.
   이 처리가 없으면 옛 구독이 410으로 정리된 뒤 마이페이지 재방문 전까지 알림이 끊긴다. */
self.addEventListener("pushsubscriptionchange", (event) => {
  const oldSub = event.oldSubscription;
  event.waitUntil(
    self.registration.pushManager
      .subscribe(oldSub ? oldSub.options : { userVisibleOnly: true })
      .then((sub) =>
        fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ old: oldSub ? oldSub.endpoint : null, sub }),
        })
      )
      .catch(() => {})
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          if ("navigate" in w) w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
