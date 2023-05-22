// Service worker for PWA installation

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
        .open("tkv1")
        .then((cache) =>
            cache.addAll([
            "/index.html",
            "/style.css",
            
            // Images
            "images/account_profile.png",
            "images/burdurland.png",
            "images/canv.png",
            "images/discord.png",
            "images/hammer-and-wrench.png",
            "images/live.png",
            "images/news.png",
            "images/patreon.png",
            "images/place-chat.svg",
            "images/reddit.png",
            "images/rplace.png",
            "images/rplace2.png",
            "images/timelapse.png",
            "images/twitter.png",
            
            //Badges
            "badges/1000000_pixels_placed.svg",
            "badges/100000_pixels_placed.svg",
            "badges/1000_pixels_placed.svg",
            "badges/100_pixels_placed.svg",
            "badges/20000_pixels_placed.svg",
            "badges/5000_pixels_placed.svg",
            "badges/admin.svg",
            "badges/based.svg",
            "badges/discord_member.svg",
            "badges/ethical_botter.svg",
            "badges/gay.svg",
            "badges/moderator.svg",
            "badges/noob.svg",
            "badges/script_kiddie.svg",
            "badges/trouble_maker.svg",
            "badges/veteran.svg",

            // Custom emojis
            "custom_emojis/amogus.png",
            "custom_emojis/biaoqing.png",
            "custom_emojis/deepfriedh.png",
            "custom_emojis/edp445.png",
            "custom_emojis/fan.png",
            "custom_emojis/heavy.png",
            "custom_emojis/herkul.png",
            "custom_emojis/kaanozdil.png",
            "custom_emojis/lowtiergod.png",
            "custom_emojis/manly.png",
            "custom_emojis/plsaddred.png",
            "custom_emojis/rplace.png",
            "custom_emojis/rplacediscord.png",
            "custom_emojis/sonic.png",
            "custom_emojis/transparent.png",
            "custom_emojis/trollface.png"
            ])
        )
    )
})


self.addEventListener('fetch', (event) => {
    // Only catch GET requests.
    if (event.request.method !== "GET") return

    // Prevent the default, and handle the request ourselves.
    event.respondWith(
      (async () => {
        const cache = await caches.open("tkv1")
        const cachedResponse = await cache.match(event.request)
  
        if (cachedResponse) {
          return cachedResponse
        }
  
        return await fetch(event.request)
      })()
    )
})