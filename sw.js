const CACHE='rempel-travel-v26';
const FILES=['./','./index.html','./style.css','./mobile.css','./share.html','./app.mjs','./weather.mjs','./map.mjs','./google-map.mjs','./mobile.mjs','./data.mjs','./catalog.mjs','./geocodes.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./leaflet.js','./leaflet.css','./suncalc.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rempel-travel-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(hit=>hit||(event.request.mode==='navigate'?caches.match(new URL('./index.html',self.registration.scope)):Response.error()))));});








