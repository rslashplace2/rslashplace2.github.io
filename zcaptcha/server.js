/* eslint-disable no-unused-vars */
import { dlopen, FFIType, suffix, CString, read, toArrayBuffer } from 'bun:ffi';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url))
const libPath = join(__dirname, "ZCaptcha." + suffix)

const {
    symbols: {
        initialise,
        gen_emoji_captcha,
        gen_text_captcha,
        dispose_result
    },
} = dlopen(
    libPath,
    {
        initialise: {
            args: [ FFIType.cstring ],
            returns: FFIType.void,
        },
        gen_emoji_captcha: {
            args: [],
            returns: FFIType.pointer,
        },
        gen_text_captcha: {
            args: [],
            returns: FFIType.pointer,
        },
        dispose_result: {
            args: [FFIType.pointer],
            returns: FFIType.void
        }
    }
)

function copy(src)  {
    var dst = new ArrayBuffer(src.byteLength)
    new Uint8Array(dst).set(new Uint8Array(src))
    return dst
}

function decodeGenResult(genResult) {
    const answerPtr = new CString(read.ptr(genResult, 0))
    const dummiesPtr = new CString(read.ptr(genResult, 8))
    const imgPtr = read.ptr(genResult, 16)
    const imgLen = read.u32(genResult, 24)
    const imageData = copy(toArrayBuffer(imgPtr, 0, imgLen))

    return { answer: answerPtr.toString(), dummies: dummiesPtr.toString(), data: imageData }
}

export function init() {
    const pathStr = join(__dirname, "Data/NotoColorEmoji-Regular.ttf")
    const strBuffer = Buffer.from(pathStr, "utf8")
    initialise(strBuffer)
}

export function genEmojiCaptcha() {
    const genResult = gen_emoji_captcha()
    const resultObj = decodeGenResult(genResult)
    dispose_result(genResult)
    return resultObj
}

export function genTextCaptcha() {
    const genResult = gen_text_captcha()
    const resultObj = decodeGenResult(genResult)
    dispose_result(genResult)
    return resultObj
}

export function genMathCaptcha() {
    throw new Error("Math captcha not implemented")
}