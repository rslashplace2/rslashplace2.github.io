import fs from 'fs'
import sha256 from 'sha256'

let rand = Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10)
if(process.argv[2]) rand = process.argv[2] + rand
if(process.argv[3]) rand = process.argv[3] + rand

fs.appendFileSync("./vip.txt", `\n# ${process.argv[2]}\n${sha256(rand)} {"cooldownMs": 500, "perms": "vip" }`)
console.log("Key:", rand)