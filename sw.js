/* PARKLINK Service Worker — 웹푸시 수신 및 알림 표시 */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 같은 출처의 HTML/JS/CSS/manifest는 항상 최신(network-first, no-store)으로 받아
// 차주화면 코드가 옛 버전으로 고정되지 않게 한다. 그 외(데이터 API 등)는 그대로 통과.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin === self.location.origin && /\.(html|js|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => fetch(req)));
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'PARKLINK', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'PARKLINK';
  const options = {
    body: data.body || '새 연락 요청이 도착했습니다',
    vibrate: [400, 200, 400, 200, 400],
    tag: data.tag || 'parklink',
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.indexOf('owner.html') !== -1 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
