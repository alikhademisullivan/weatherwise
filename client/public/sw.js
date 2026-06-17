const CACHE = 'weatherwise-v1';
const OFFLINE_URLS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  // Ignore non-http(s) schemes (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) return;
  const url = new URL(request.url);

  // Network-first for API calls — fall back to nothing (let browser handle the error)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets (JS/CSS/images)
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // SPA shell: serve index.html for navigation requests; inject ?offline=true when network unavailable
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/index.html');
        if (!cached) return new Response('Offline', { status: 503 });
        // Clone and rewrite the URL to include ?offline=true so the app can detect it
        const offlineUrl = new URL(request.url);
        offlineUrl.searchParams.set('offline', 'true');
        return new Response(await cached.text(), {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      })
    );
    return;
  }
});
