let [, , w, h] = process.argv
import fs from 'fs'
fs.writeFileSync('place', new Uint8Array(w * h).fill(31))
fs.unlinkSync('change')
