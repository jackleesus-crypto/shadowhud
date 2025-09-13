self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ self.clients.claim(); });
// very basic offline passthrough
self.addEventListener('fetch', e=>{});
