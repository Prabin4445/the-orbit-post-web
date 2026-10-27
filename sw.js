/* The Orbit Post service worker — Web Push only. */
var PUSH_API = "";
self.addEventListener('push', function (e) {
  e.waitUntil((function () {
    function render(d) {
      var title = (d && d.title) || 'The Orbit Post';
      return self.registration.showNotification(title, {
        body: (d && d.body) || '',
        icon: '/assets/img/icon-192.png',
        badge: '/assets/img/icon-192.png',
        tag: (d && d.tag) || 'orbitpost',
        data: { url: (d && d.url) || '/' }
      });
    }
    if (!PUSH_API) return render(null);
    return fetch(PUSH_API + '/v1/orbitpush/latest', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(render, function () { return render(null); });
  })());
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  var target;
  try { target = new URL(url, self.location.origin).href; }
  catch (_) { target = self.location.origin + '/'; }
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
      for (var i = 0; i < ws.length; i++) {
        try {
          if (new URL(ws[i].url).pathname === new URL(target).pathname) {
            return ws[i].focus();
          }
        } catch (_) {}
      }
      return clients.openWindow(target);
    })
  );
});
