const CACHE='mcommerce-merchant-shell-6';
const PREFIX=['j3-merchant-shell-','mcommerce-merchant-shell-'];
const SHELL=['/app-comercio/panel','/app-comercio/install','/platform.css','/platform.js','/config.js','/merchant-manifest.json','/app-version.json','/assets/m-commerce-icon-192.png?v=6','/assets/m-commerce-icon-512.png?v=6','/fallback/comercio.html'];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const url of SHELL){
    try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone())}catch{}
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>PREFIX.some(p=>k.startsWith(p))&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin!==location.origin)return;
  const noStore=u.pathname==='/app-version.json'||u.pathname.endsWith('manifest.json')||u.pathname.endsWith('.webmanifest');
  const isNavigation=event.request.mode==='navigate'||event.request.destination==='document';
  event.respondWith((async()=>{
    try{
      const r=await fetch(event.request,{cache:noStore?'no-store':'no-cache'});
      if(r.ok&&!noStore&&['script','style','image','manifest','document'].includes(event.request.destination)){
        const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
      }
      return r;
    }catch(err){
      const exact=await caches.match(event.request);
      if(exact)return exact;
      if(isNavigation){
        const fallback=await caches.match('/fallback/comercio.html');
        if(fallback)return fallback;
      }
      return new Response('Recurso temporalmente no disponible',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    }
  })());
});

self.addEventListener('message',event=>{
  if(['J3_FORCE_RELEASE_REFRESH','M_COMMERCE_FORCE_RELEASE_REFRESH'].includes(event.data?.type))self.skipWaiting();
});
