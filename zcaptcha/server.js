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
//Math Captcha
function genMathCaptcha() {
    return new Promise((resolve, reject) => {
        let operation = ["+", "-"][Math.floor(Math.random() * 2)]
        let val = Math.floor(Math.random() * 5), val1 = Math.floor(Math.random() * 5)
        answer = eval(val.toString() + operation.toString() + val1.toString())
        im.convert(['-background', 'white', '-fill', 'black', '-font', 'Candice', '-pointsize', '72', '-wave', `10x${Math.min(Math.max(70 + Math.floor(Math.random() * 10), 70), 80)}`,`label:${val} ${operation} ${val1}`, 'captcha.png'], 
        function(err, stdout){
            if (err) {
                throw err
                reject(err)
            }
            resolve(stdout);
        });
    })
}

function genWordCaptcha() {
    return new Promise((resolve, reject) => { //Allow it to wait for the promise to return before continuing, so we are definite that we 1000% have the new image before we set.
        answer = ["rplace", "blobkat", "zekiahepic", "pixels", "game", "donate", "flag", "art", "build", "team", "create", "open"][Math.floor(Math.random() * 12)]
        im.convert(['-background', 'white', '-fill', 'black', '-font', 'Candice', '-pointsize', '72', '-wave', `10x${Math.min(Math.max(70 + Math.floor(Math.random() * 10), 70), 80)}`,`label:${answer}`, 'captcha.png'], 
        function(err, stdout){
            if (err) {
                throw err
                reject(err) //Call back and say that it failed
            }
            resolve(stdout); //Finish the async, and allow the program to go on
        });
    })
}

const fontFile = path.resolve(path.join("zcaptcha/NotoColorEmoji-Regular.ttf"))

//Emoji captcha
export default async function genEmojiCaptcha() {
    const dummiesPos = Math.floor(Math.random() * (emojis.length - 10))
    const dummies = emojis.slice(dummiesPos, dummiesPos + 10)
    const answer = dummies[Math.floor(Math.random() * dummies.length)]
    const fileNm = `captcha.${Date.now()}.${Math.floor(Math.random() * 10)}.webp`

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
        throw new Error('Error generating captcha: ' + err.message)
    }
}
