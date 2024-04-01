/* eslint-disable jsdoc/require-jsdoc */
// Special features for april fools darkplace event
(function() {
    // Mon Apr 01 2024 18:33:20 GMT+0100
    const eventStart = 1711992800000
    if (Date.now() > eventStart + 60_000) {
        return console.warn("Darkplace event is complete (> 1 minute ago)")
    }

    const forceTheme = "r/place 2022"
    if (localStorage.theme !== forceTheme) {
        localStorage.theme = forceTheme
        console.warn("Forcing site theme to", forceTheme)
        window.location.reload(true) // Hacky but will avoid the theme race
    }
    document.documentElement.classList.add("dark")
    document.body.style.backgroundSize = "contain"
    const bgWrapper = document.getElementById("bgWrapper")
    const backgroundCanvas = document.createElement("canvas")
    backgroundCanvas.style.position = "absolute"
    backgroundCanvas.style.top = "0"
    backgroundCanvas.style.left = "0"
    backgroundCanvas.style.width = "100%"
    backgroundCanvas.style.height = "100%"
    backgroundCanvas.style.filter = "blur(1px)"
    bgWrapper?.appendChild(backgroundCanvas)

    function updateBgCanvasSize() {
        backgroundCanvas.width = window.innerWidth
        backgroundCanvas.height = window.innerHeight    
    }
    updateBgCanvasSize()
    window.addEventListener("resize", updateBgCanvasSize)

    const messages = [
        "88",
        "Zekiah",
        "X!Gaster",
        "Zubigri",
        "Lazvell.09",
        "Thiagoxnahuel",
        "Ward",
        "Bushi",
        "Lapis",
        "Relick",
        "BlobKat",
        "BeyazVoid",
        "Ysufxad",
        "Redje",
        "Etta",
        "BiskivitliTost",
        "MTC",
        "TmusiniYan",
        "SUS",
        "Люти Омни",
        "Авир",
        "Ых",
        "Insertnamehere",
        "Mr. John",
        "Царь изумрудного королевства",
        "The Great Wall",
        "C42Ё!!!",
        "Forbidding racism is racist",
        "Bugfix when? No",
        "Later, never",
        "∆∆∆",
        "∆  ∆∆",
        "Zubigri write this text",
        "Geometry Dash",
        "TK",
        "Bushi Catgirls Slayers https://discord.com/invite/hk7r6Kye7x",
        "rplace.live",
        "rplace.tk",
        "darkplace.live",
        "susplace.live",
        "is am are what???",
        "r/place 2 ad it",
        "The Bullet? The Bullet!",
        "BloodBath",
        "Legalise nuclear bombs",
        "Absence of proof is not proof of absence",
        "Proof of absence is not absence of proof",
        "Qwertyuiop",
        "Asdfghjkl",
        "Zxcvbnm",
        "Site is saled",
        "(Nothing)",
        "Loading...)",
        "...---...",
        "Code",
        "Decode",
        "Delete :vip? Too lazy",
        "АРМОРС!!!",
        "КОНЬ НИЗКО ЛЕТИТ К ДОЖДЮ, НЕГРОВАЯ КРАСКА СЛЕЗЛА С ФЕРЗЯ И ОН ОТБЕЛИЛСЯ!!!",
        "Make Flag Speedrun Here",
        "3301",
        "42",
        "666",
        "777",
        "(Numbers 1-10)",
        "13",
        "284654548244662065667669143349975505484487365510612937903489695250411210311237163400731822443778191321442634040459295815516156858468105775285314299961880757005305548204686781529063932731323704485670912",
        "Ñ",
        "196883 Dimensions?",
        "Peace is never was an opinion",
        "Loading screen text",
        "Zek add loading screen text — ©Zubigri",
        "blobk.at 19132 mc server join",
        "We eat pixels",
        "The End.",
        "爱国无罪",
        "富狗",
        "我是好黑"
    ]

    let wind = 1
    let gravity = 0.001
    const messageColours = ["#fff", "#aaa", "#db7c7c", "#4a4949"]

    class FallingMessage {
        constructor(x, y, msg) {
            this.x = x
            this.y = y
            this.msg = msg
            this.colour = messageColours[Math.floor(Math.random() * messageColours.length)]
            this.fontSize = Math.random() * 32 + 6
            this.velocityY = Math.random() * 0.4
            this.velocityX = Math.random() - 0.5
        }

        update(ctx) {
            this.velocityX += wind * (38 / this.fontSize) * 0.014
            this.x += this.velocityX
            this.velocityY += gravity
            this.y += this.velocityY
            const speed = Math.abs(this.velocityX * this.velocityY)
            ctx.globalAlpha = Math.min(1, speed * 0.4 + 0.4)
            ctx.font = `${this.fontSize}px 'Brush Script MT', cursive`
            ctx.fillStyle = this.colour
            ctx.fillText(this.msg, this.x, this.y)
        }
    }

    const backgroundContext = backgroundCanvas.getContext("2d")
    if (backgroundContext == null) {
        return
    }
    const fallingMessages = new Set()
    let lastWindChange = Date.now()
    let lastSpawn = Date.now()
    setInterval(() => {
        backgroundContext.clearRect(0, 0, window.innerWidth, window.innerHeight)
        if (Date.now() - lastSpawn > 400 && Math.random() < 0.1) {
            const chosenMessage = messages[Math.floor(Math.random() * messages.length)]
            fallingMessages.add(new FallingMessage(Math.random() * window.innerWidth - 100, 0, chosenMessage))
            lastSpawn = Date.now()
        }
        if (Date.now() - lastWindChange > 5_000 && Math.random() < 0.3) {
            wind = Math.random() * 0.1 - 0.05
            lastWindChange = Date.now()
        }
        for (const message of fallingMessages) {
            message.update(backgroundContext)
            if (message.y > window.innerHeight) {
                fallingMessages.delete(message)
            }
        }
    }, 17)

    setTimeout(async () => {
        await startCountDown(eventStart)
    }, 500)
})()