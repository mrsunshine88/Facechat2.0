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
  // Endast fånga upp "navigate" (när användaren laddar om eller byter sida)
  // Detta förhindrar att enstaka bilder eller script-fel kraschar hela sidan med offline-text.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(
          "<html><body style='background:#0f172a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;'><div><h1>Facechat är offline 🛸</h1><p>Vi kan inte nå servern just nu. Kontrollera din internetanslutning.</p><button onclick='window.location.reload()' style='background:#3b82f6;color:white;border:none;padding:10px 20px;border-radius:10px;font-weight:bold;cursor:pointer;'>Försök igen</button></div></body></html>", 
          { 
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })
    );
  } else {
    // För vanliga filer (bilder, JS, API), låt de bara passera som vanligt
    return;
  }
})
