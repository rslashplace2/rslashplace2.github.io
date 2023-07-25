import im from 'imagemagick'
import { promises as fs } from 'fs'
import path from 'path'

const emojis = ["d", "G", "i", "L", "b", "E", "j", "k", "v", "I", "D", "n", "e", "W", "N", "C", "o", "B", "U", "V", "x", "Q", "z", "y", "r", "a", "Y", "P", "q", "Z", "K", "S", "J", "T", "O", "m", "s", "f", "R", "l", "w", "c", "A", "X", "F", "t", "u", "g", "h", "M", "H"]
/*
const emojis = [ "😎", "🤖", "🗣", "🔥", "🏠", "🤡", "👾", "👋", "💩", "⚽", "👅", "🧠", "🕶", "🌳", "🌍", "🌈", "🎅", "👶", "👼",
"🥖", "🍆", "🎮", "🎳", "🚢", "🗿", "ඞ", "📱", "🔑", "❤", "👺", "🤯", "🤬", "🦩", "🍔", "🎬", "🚨", "⚡️", "🍪",
"🕋", "🎉", "📋", "🚦", "🔇", "🥶", "💼", "🎩", "🎒", "🦅", "🧊", "★", "✅", "😂", "😍", "🚀", "😈", "👟", "🍷",
"🚜", "🐥", "🔍", "🎹", "🚻", "🚗", "🏁", "🥚", "🔪", "🍕", "🐑", "🖱", "😷", "🌱", "🏀", "🛠", "🤮", "💂", "📎",
"🎄", "🕯️", "🔔", "⛪", "☃", "🍷", "❄", "🎁", "🩸"]
*/
const fontFile = path.resolve(path.join("zcaptcha/NotoColorEmoji-Regular.ttf"))

let entropy = 0
export let dummiesCount = 10

/**
 * Generates an emoji captcha image with a random background color, wave effect,
 * and a set of dummy emojis along with the correct answer emoji.
 * @async
 * @function emojiCaptcha
 * @returns {Promise<{ data: Buffer, answer: string, dummies: string }>|null} A promise that resolves to an object with the captcha data.
 */
async function genEmojiCaptcha() {
    const dummiesPos = Math.floor(Math.random() * (emojis.length - Math.min(dummiesCount, emojis.length)))
    const dummies = emojis.slice(dummiesPos, dummiesPos + dummiesCount)
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
                    (fontFile || 'Noto_Color_Emoji'),
                    `pango:<span font="${path.basename(fontFile) || 'Noto Color Emoji'}">${answer}</span>`,
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
