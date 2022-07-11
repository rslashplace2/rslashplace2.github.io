import im from 'imagemagick'
import imageDataURI from 'image-data-uri'
import fs from 'fs'

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

//Emoji captcha
export default function genEmojiCaptcha() {
    return new Promise((resolve, reject) => {
        let answer = ["😎", "🤖", "🗣️", "🔥", "🏠", "🤡", "👾", "👋", "💩", "⚽"][Math.floor(Math.random() * 10)] //determine answer
        let fileNm = `captcha.${Date.now()}.${Math.floor(Math.random() * 10)}.png` //generate original random file name (we hope)
        im.convert(['-background', ['yellow', 'purple', 'gray' ,'brown', 'white', 'orange', 'blue', 'red'][Math.floor(Math.random() * 8)], '-set', 'colorspace', 'sRGB', '-font', 'Noto_Color_Emoji', `pango:'<span font="Noto Color Emoji">${answer}</span>'`, fileNm], //generate emoji
        function(err, stdout){
            if (err) {
            	console.log(err)
                reject(err)
            }
            //resolve(stdout);
       		imageDataURI.encodeFromFile('./' + fileNm)
	       	.then(res => { //Encode to png datauri
	       		fs.unlink(fileNm, (err) => { if (err) console.error(err)}); //delete the temp saved captcha image
	       		resolve(answer + ' ' + res) //return the answer and captcha as an image data URI to the asker
	       	})
        })
    })
}
