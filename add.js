import sha256 from 'sha256'
import fs from 'fs'

let rand = Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10) + Math.random().toString(16).slice(2,10)
if(process.argv[2])rand='!'+rand

let txt = fs.readFileSync('../vip.txt').toString()
txt += '\n' + sha256(rand)
fs.writeFileSync('../vip.txt', txt)
console.log('Key:',rand)
