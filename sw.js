const CACHE_NAME =
  'gpt-to-pc-v1';

const FILES = [
  './',
  './index.html',
  './share.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];


self.addEventListener(
  'install',
  event => {

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(cache => {
          return cache.addAll(
            FILES
          );
        })
    );

    self.skipWaiting();
  }
);


self.addEventListener(
  'activate',
  event => {

    event.waitUntil(
      self.clients.claim()
    );
  }
);


self.addEventListener(
  'fetch',
  event => {

    if (
      event.request.method !== 'GET'
    ) {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(
            event.request
          );
        })
    );
  }
);