import im from 'imagemagick'
import { promises as fs } from 'fs'
import path from 'path'

export let config = {
    letters: ["d", "G", "b", "E", "j", "k", "v", "D", "n", "e", "W", "N", "C", "o", "B", "U", "V",
        "x", "Q", "z", "y", "r", "a", "Y", "P", "q", "Z", "K", "S", "J", "T", "O", "m", "s", "f", "R", "w",
        "c", "A", "X", "F", "t", "u", "g", "h", "M", "H"],
    emojis: [ "😎", "🤖", "🗣", "🔥", "🏠", "🤡", "👾", "👋", "💩", "⚽", "👅", "🧠", "🕶", "🌳", "🌍", "🌈", "🎅", "👶", "👼",
        "🥖", "🍆", "🎮", "🎳", "🚢", "🗿", "ඞ", "📱", "🔑", "❤", "👺", "🤯", "🤬", "🦩", "🍔", "🎬", "🚨", "⚡️", "🍪",
        "🕋", "🎉", "📋", "🚦", "🔇", "🥶", "💼", "🎩", "🎒", "🦅", "🧊", "★", "✅", "😂", "😍", "🚀", "😈", "👟", "🍷",
        "🚜", "🐥", "🔍", "🎹", "🚻", "🚗", "🏁", "🥚", "🔪", "🍕", "🐑", "🖱", "😷", "🌱", "🏀", "🛠", "🤮", "💂", "📎",
        "🎄", "🕯️", "🔔", "⛪", "☃", "🍷", "❄", "🎁", "🩸"],
    dummiesCount: 10,
    fontFile: path.basename(path.resolve("zcaptcha/NotoColorEmoji-Regular.ttf"))
}

let entropy = 0

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