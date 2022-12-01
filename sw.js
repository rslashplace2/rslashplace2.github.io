// Service worker for PWA installation

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
        .open("v1")
        .then((cache) =>
            cache.addAll([
            "/index.html",
            "/style.css",
            "/custom_emojis/fan.png",
            "/warning.png",
            "/timelapse.png",
            "/rplace2.png",
            "/rplace.png",
            "/reddit.png",
            "/proxy-image.jpg",
            "/patreon.png",
            "/news.png",
            "/live.png",
            "/hammer-and-wrench.png",
            "/favicon.png",
            "/canv.png",
            "/discord.png",
            "/burdurland.png",
            ])
        )
    )
})


self.addEventListener('fetch', (event) => {
    event.respondWith(async function() {
        try {
            return await fetch(event.request)
        }
        catch(exception) {
            let dataCache = await caches.open("v1")
            let cachedResponse = await dataCache.match(event.request)
            if (cachedResponse) return cachedResponse    
        }
    })
})