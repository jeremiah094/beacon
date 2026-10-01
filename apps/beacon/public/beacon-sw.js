// Beacon's web push service worker. Registered by usePushRegistration.ts,
// which also owns the subscribe/permission flow — this file only handles
// what happens once a push actually arrives, and where a tap on it goes.

self.addEventListener('push', (event) => {
  let payload = { title: 'Beacon', body: '', data: {} };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Non-JSON payload — fall back to the default above rather than throw.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Beacon', {
      body: payload.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: payload.data || {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const isExternal = /^https?:\/\//.test(url);

  // stream_live (match-notify) sets this to a real https:// Twitch URL,
  // not an in-app path — open it in its own tab rather than navigating
  // the existing Beacon tab away from itself.
  if (isExternal) {
    event.waitUntil(self.clients.openWindow(url));
    return;
  }

  const target = self.location.origin + url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
