/* 枕冬工作台 · Service Worker
   只缓存页面外壳，接口请求（GitHub API）一律不缓存，避免读到旧数据。 */
const CACHE = 'zd-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(SHELL))
      .catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;
  if(url.pathname.endsWith('/sw.js')) return;

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const cp = res.clone();
          caches.open(CACHE).then(c=>c.put('./index.html', cp));
          return res;
        })
        .catch(()=>caches.match('./index.html').then(r=>r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit=>hit || fetch(req).then(res=>{
      if(res && res.status === 200 && res.type === 'basic'){
        const cp = res.clone();
        caches.open(CACHE).then(c=>c.put(req, cp));
      }
      return res;
    }))
  );
});
