/* eslint-disable no-unused-vars */
import { dlopen, FFIType, suffix, ptr, CString, read, toArrayBuffer } from 'bun:ffi';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url))
const libPath = join(__dirname, "ZCaptcha." + suffix)

const {
    symbols: {
        initialise,
        gen_emoji_captcha,
        gen_text_captcha
    },
} = dlopen(
    libPath,
    {
        initialise: {
            args: [FFIType.cstring],
            returns: FFIType.void,
        },
        gen_emoji_captcha: {
            args: [],
            returns: FFIType.pointer,
        },
        gen_text_captcha: {
            args: [],
            returns: FFIType.pointer,
        }
    }
)

function decodeGenResult(genResult) {
    const answerPtr = new CString(read.ptr(genResult, 0))
    const dummiesPtr = new CString(read.ptr(genResult, 8))
    const imgPtr = read.ptr(genResult, 16)
    const imgLen = read.u32(genResult, 24)
    const imageData = toArrayBuffer(imgPtr, 0, imgLen)

    return { answer: answerPtr.toString(), dummies: dummiesPtr.toString(), data: imageData }
}

export function init() {
    const pathStr = join(__dirname, "Data/NotoColorEmoji-Regular.ttf") + "\0"
    const strBuffer = Buffer.from(pathStr, "utf8")
    initialise(strBuffer)
}

export function genEmojiCaptcha() {
    const genResult = gen_emoji_captcha()
    return decodeGenResult(genResult)
}

export function genTextCaptcha() {
    const genResult = gen_text_captcha()
    return decodeGenResult(genResult)
}