self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/'
      }
    }
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // En mer robust kontroll för iOS: Kolla om någon klient är synlig ELLER fokuserad
        const isAppActive = windowClients.some(client => 
          client.visibilityState === 'visible' || client.focused
        );
        
        if (!isAppActive) {
          // Visa enbart push-notis om ingen app/hemsida är aktiv i förgrunden
          return self.registration.showNotification(data.title || 'Nytt meddelande', options);
        }
      })
    );
  }
})

self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  event.notification.close()
  
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
  
  event.waitUntil(
    clients.openWindow(urlToOpen)
  )
})

self.addEventListener('fetch', function(event) {
  // Genuin pass-through fetch handler som uppfyller PWA Offline krav 100%
  event.respondWith(
    fetch(event.request).catch(function() {
      return new Response("<html><body><h1>Facechat är offline</h1></body></html>", { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
})
