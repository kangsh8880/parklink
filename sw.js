/* PARKLINK Service Worker — 웹푸시 수신 및 알림 표시 */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'PARKLINK', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'PARKLINK';
  const options = {
    body: data.body || '새 연락 요청이 도착했습니다',
    vibrate: [200, 100, 200],
    tag: data.tag || 'parklink',
    renotify: true,
    requireInteraction: true,
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
