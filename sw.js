// Service worker for PWA installation

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
        .open("v1")
        .then((cache) =>
            cache.addAll([
            "./index.html",
            "./styles.css",
            "./custom_emojis/fan.png",
            ])
        )
    )
})
