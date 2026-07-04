// G & P Finance Service Worker v2 (network-first for HTML, cache-first for assets)
const CACHE_NAME = 'gp-finance-v2';
const APP_SHELL = [
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(err => console.warn('Cache warning:', err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const req = event.request;

  if (url.includes('supabase.co') || url.includes('/rest/') || url.includes('/auth/') || url.includes('/storage/')) {
    return;
  }

  if (req.method !== 'GET') return;

  const isHtmlRequest = req.destination === 'document' ||
                        url.endsWith('/') ||
                        url.endsWith('/index.html') ||
                        url.endsWith('/GandP-Finance/') ||
                        url.endsWith('/GandP-Finance/index.html');

  if (isHtmlRequest) {
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.match(req).then(cached => {
              if (cached) {
                Promise.all([cached.text(), clone.clone().text()]).then(([oldText, newText]) => {
                  if (oldText !== newText) {
                    self.clients.matchAll().then(clients => {
                      clients.forEach(client => client.postMessage({ type: 'UPDATE_AVAILABLE' }));
                    });
                  }
                });
              }
              cache.put(req, clone).catch(() => {});
            });
          });
        }
        return response;
      }).catch(() => {
        return caches.match(req);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone).catch(() => {}));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
