/* eslint-disable no-unused-vars */
import { Canvas, FontLibrary } from 'skia-canvas'
import im from 'imagemagick'
import { promises as fs } from 'fs'
import path from 'path'

export let config = {
    letters: ["d", "G", "b", "E", "j", "k", "v", "D", "n", "e", "W", "N", "C", "o", "B", "U", "V",
        "x", "Q", "z", "y", "r", "a", "Y", "P", "q", "Z", "K", "S", "J", "T", "O", "m", "s", "f", "R", "w",
        "c", "A", "X", "F", "t", "u", "g", "h", "M", "H"],
    emojis: [ "😎", "🤖", "🔥", "🏠", "🤡", "👋", "💩", "⚽", "👅", "🧠", "🕶", "🌳", "🌍", "🌈", "🎅", "👶", "👼",
        "🥖", "🍆", "🎮", "🎳", "🗿", "📱", "🔑", "❤", "👺", "🤯", "🤬", "🦩", "🍔", "🎬", "🚨", "⚡️", "🍪",
        "🕋", "🎉", "📋", "🚦", "🔇", "🥶", "💼", "🎩", "🎒", "🦅", "🧊", "★", "✅", "😂", "😍", "🚀", "😈", "👟", "🍷",
        "🚜", "🐥", "🔍", "🎹", "🚻", "🚗", "🏁", "🥚", "🔪", "🍕", "🐑", "🖱", "😷", "🌱", "🏀", "🛠", "🤮", "💂", "📎",
        "🎄", "🕯️", "🔔", "⛪", "☃", "🍷", "❄", "🎁", "🩸"],
    dummiesCount: 10,
    fontFile: path.resolve("zcaptcha/NotoColorEmoji-Regular.ttf"),
    
    // genEmojiCaptcha2 specific
    width: 96,
    height: 96,
    fontSize: 48,
    noise1Size: 3,
    noise1Opacity: 0.35,
    textShift: 32,
    textRotateRad: 0.4
}

let entropy = 0

// Skia captcha
FontLibrary.use("captcha-font", [ config.fontFile ])
let canvas = new Canvas(config.width, config.height)
let ctx = canvas.getContext("2d")

function randomColor() {
    const r = Math.floor(Math.random() * 256)
    const g = Math.floor(Math.random() * 256)
    const b = Math.floor(Math.random() * 256)
    return `rgb(${r},${g},${b})`
}

export function regenCanvasConfig() {
    FontLibrary.use("captcha-font", [ config.fontFile ])
    canvas = new Canvas(config.width, config.height)
    ctx = canvas.getContext("2d")
}

export async function genEmojiCaptcha2() {
    const dummies = []

    for (let i = 0; i < config.dummiesCount; i++) {
        let chosen = config.emojis[Math.floor(Math.random() * config.emojis.length)]
        while (dummies.includes(chosen)) chosen = config.emojis[Math.floor(Math.random() * config.emojis.length)]
        dummies.push(chosen)
    }

    const answer = dummies[Math.floor(Math.random() * dummies.length)]
    entropy++

    if (entropy % 10 == 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    ctx.save()
        for (let x = 0; x < canvas.width / config.noise1Size; x++) {
            for (let y = 0; y < canvas.height / config.noise1Size; y++) {
                const r = Math.random() * 255
                const g = Math.random() * 255
                const b = Math.random() * 255

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${config.noise1Opacity})`
                ctx.fillRect(x * config.noise1Size, y * config.noise1Size, config.noise1Size, config.noise1Size)
            }
        }
    ctx.restore()

    const textX = canvas.width / 2 + (Math.random() * config.textShift - (config.textShift/2))
    const textY = canvas.height / 2 + (Math.random() * config.textShift - (config.textShift/2))
    const textR = Math.random() * config.textRotateRad - config.textRotateRad / 2
        ctx.save()
        ctx.font = config.fontSize + "px captcha-font"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillStyle = "black"
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(textR)
        ctx.translate(-(canvas.width / 2), -(canvas.height / 2))
        ctx.translate(textX, textY)
        ctx.fillText(answer, 0, 0)
        ctx.resetTransform()
    ctx.restore()

    ctx.save()
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = randomColor()
            ctx.lineWidth = 1

            ctx.beginPath()
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height)
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height)
            ctx.stroke()
        }
    ctx.restore()

    return { data: await canvas.toBuffer("png"), answer: answer, dummies: dummies.join("\n") } 
}

// ImageMagick captacha

/**
 * Generates an letter image captcha with a random background color, wave effect,
 * and a set of dummy letters along with the correct answer letter.
 * @async
 * @function emojiCaptcha
 * @returns {Promise<{ data: Buffer, answer: string, dummies: string }>|null} A promise that resolves to an object with the captcha data.
*/
export async function genLetterCaptcha() {
    const dummiesPos = Math.floor(Math.random() * (config.letters.length - Math.min(config.dummiesCount, config.letters.length)))
    const dummies = config.letters.slice(dummiesPos, dummiesPos + config.dummiesCount)
    const answer = dummies[Math.floor(Math.random() * dummies.length)]
    const fileNm = `captcha.${Date.now()}.${entropy}.webp`
    entropy++

    try {
        await new Promise((resolve, reject) => {
            im.convert([
                    '-background',
                    ['yellow', 'purple', 'gray', 'brown', 'white', 'orange', 'blue', 'red'][Math.floor(Math.random() * 8)],
                    '-set',
                    'colorspace',
                    'sRGB',
                    '-pointsize',
                    '72',
                    '-wave', `10x${Math.min(Math.max(70 + Math.floor(Math.random() * 10), 70), 80)}`,
                    '-font',
                    (config.fontFile || 'Noto_Color_Emoji'),
                    `pango:<span font="${(config.fontFile) || 'Noto Color Emoji'}">${answer}</span>`,
                    fileNm
                ],
                function (err, res) {
                    if (err) reject(err);
                    else resolve(res);
                }
            )
        })

        const buffer = await fs.readFile(fileNm)
        await fs.unlink(fileNm)
        return { data: buffer.buffer, answer: answer, dummies: dummies.join("\n") }
    }
    catch (err) {
        console.log(err)
        await fs.unlink(fileNm)
        return null
    }
}


/**
 * Generates an emoji image captcha with a random background color, wave effect,
 * and a set of dummy emojis along with the correct answer emoji.
 * @async
 * @function emojiCaptcha
 * @returns {Promise<{ data: Buffer, answer: string, dummies: string }>|null} A promise that resolves to an object with the captcha data.
*/
export async function genEmojiCaptcha() {
    const dummies = []

    for (let i = 0; i < config.dummiesCount; i++) {
        let chosen = config.emojis[Math.floor(Math.random() * config.emojis.length)]
        while (dummies.includes(chosen)) chosen = config.emojis[Math.floor(Math.random() * config.emojis.length)]
        dummies.push(chosen)
    }

    const answer = dummies[Math.floor(Math.random() * dummies.length)]
    const fileNm = `captcha.${Date.now()}.${entropy}.webp`
    entropy++

    try {
        await new Promise((resolve, reject) => {
            im.convert([
                    '-background', ['yellow', 'purple', 'brown', 'white', 'orange', 'blue', 'red', 'pink', 'green', 'black'][Math.floor(Math.random() * 10)],
                    `pango:<span size="32384" font="Noto Color Emoji">${answer}</span>`, '-set', 'colorspace', 'sRGB', '-quality', '100',
                    '-modulate', `${80 + Math.floor(Math.random()) * 150}, ${80 + Math.floor(Math.random()) * 150}, ${80 + Math.floor(Math.random()) * 150}`,
                    '-wave', `8x${Math.min(Math.max(60 + Math.floor(Math.random() * 40), 60), 100)}`,
                    '-roll', (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 10) + (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 10),
                    fileNm
                ], //generate emoji
                function(err, res){
                    if (err) reject(err)
                    else resolve(res)
                }
            )
        })

        const buffer = await fs.readFile(fileNm)
        await fs.unlink(fileNm)
        return { data: buffer.buffer, answer: answer, dummies: dummies.join("\n") }
    }
    catch (err) {
        console.log(err)
        await fs.unlink(fileNm)
        return null
    }
}