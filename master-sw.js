const CACHE='mcommerce-master-shell-6';
const PREFIX=['j3-master-shell-','mcommerce-master-shell-'];
const SHELL=[
  '/app-maestro/install',
  '/app-maestro/panel',
  '/manifest.webmanifest?v=6',
  '/assets/m-commerce-icon-192.png?v=6',
  '/assets/m-commerce-icon-512.png?v=6',
  '/fallback/master.html'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(SHELL.map(async url=>{try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone())}catch{}}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>PREFIX.some(p=>k.startsWith(p))&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin!==location.origin)return;
  if(u.pathname.endsWith('.webmanifest')||u.pathname.endsWith('manifest.json')||u.pathname==='/app-version.json'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(r=>{
    if(r.ok&&['script','style','image','manifest'].includes(event.request.destination)){
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(event.request,copy));
    }
    return r;
  }).catch(async()=>await caches.match(event.request)||await caches.match('/fallback/master.html')));
});
self.addEventListener('message',event=>{
  if(['J3_FORCE_RELEASE_REFRESH','M_COMMERCE_FORCE_RELEASE_REFRESH'].includes(event.data?.type))self.skipWaiting();
});