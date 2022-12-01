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
    event.respondWith(async () => {
        try {
            let res = await fetch(event.request)
            let cache = await caches.open("v1")
            cache.put(event.request.url, res.clone())
            return res
        }
        catch(error) {
            return caches.match(event.request) || await fetch(event.request)
        }
    })
})