const CACHE_VERSION = 'v1';
const CACHE_NAME = `audio-visualizer-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  'index.html',
  'style.css',
  'scripts/constants.js',
  'scripts/domElements.js',
  'scripts/loaders.js',
  'scripts/main.js',
  'scripts/playerControls.js',
  'scripts/visualizer.js',
  'settings/Boxes.json',
  'settings/CellularSpectrum.json',
  'settings/Disco.json',
  'settings/Waves.json',
  'shaders/boxes.glsl',
  'shaders/cellular_spectrum.glsl',
  'shaders/disco.glsl',
  'shaders/wave_lines.glsl',
  'songs/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (!shouldHandleRequest(request, url)) {
    return;
  }

  event.respondWith(cacheFirst(request));
});

function shouldHandleRequest(request, url) {
  if (request.destination === 'script') {
    return true;
  }

  const pathname = url.pathname;
  return (
    pathname.endsWith('.glsl') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.js')
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
