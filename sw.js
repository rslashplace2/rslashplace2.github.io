/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Service worker for PWA installation
const CURRENT_CACHES = "tkv2"
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CURRENT_CACHES).then((cache) =>
            cache.addAll([
                "index.html",
                "style.css",
                "rplace-2022.css",
                "rplace-2023.css",

                // Images
                "images/1984.png",
                "images/account-profile.png",
                "images/canv.png",
                "images/discord-ad.png",
                "images/discord.png",
                "images/discord-popup.png",
                "images/hammer-and-wrench.png",
                "images/lamda.png",
                "images/live.png",
                "images/news.png",
                "images/patreon.png",
                "images/reddit-login-banner.png",
                "images/reddit.png",
                "images/rplace2.png",
                "images/rplace-loader.gif",
                "images/rplace-offline.png",
                "images/rplace.png",
                "images/snoo-edge.png",
                "images/telegram-ad.png",
                "images/timelapse.png",
                "images/trophy.png",
                "images/twitter.png",
                "images/default-ad.png",

                // Svg
                "svg/place-chat.svg",
                "svg/clipboard.svg",
                "svg/flag-gb.svg",
                "svg/pattern.svg",
                "svg/santa-hat.svg",
                "svg/pixel-select-2022.svg",
                "svg/chat.svg",
                "svg/lock.svg",
                "svg/moderate-action.svg",
                "svg/reply-action.svg",
                "svg/report-action.svg",
                "svg/player.svg",
                "svg/help.svg",
                "svg/green-checkmark.svg",
                "svg/pixel-select-2023.svg",
                
                //Badges
                "badges/1000000-pixels-placed.svg",
                "badges/100000-pixels-placed.svg",
                "badges/1000-pixels-placed.svg",
                "badges/100-pixels-placed.svg",
                "badges/20000-pixels-placed.svg",
                "badges/5000-pixels-placed.svg",
                "badges/admin.svg",
                "badges/based.svg",
                "badges/discord-member.svg",
                "badges/ethical-botter.svg",
                "badges/gay.svg",
                "badges/moderator.svg",
                "badges/noob.svg",
                "badges/script-kiddie.svg",
                "badges/trouble-maker.svg",
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
                "custom_emojis/trollface.png",

                // Fonts
                "fonts/RedditMono-Bold.woff2",
                "fonts/RedditSans-Bold.woff2",
                "fonts/RedditSans-Regular.woff2",

                // Sounds
                "sounds/cooldown-start.mp3",
                "sounds/invalid.mp3",
                "sounds/cooldown-end.mp3",
                "sounds/highlight.mp3",
                "sounds/select-colour.mp3",
                "sounds/close-palette.mp3",
                "sounds/bell.mp3"
            ])
        )
    )
})

self.addEventListener("fetch", (event) => {
    // Only catch GET requests.
    if (event.request.method !== "GET") return

    // Prevent the default, and handle the request ourselves.
    event.respondWith(
        (async () => {
            const cache = await caches.open(CURRENT_CACHES)
            const cachedResponse = await cache.match(event.request)

            if (cachedResponse) return cachedResponse
            return await fetch(event.request)
        })()
    )
})
