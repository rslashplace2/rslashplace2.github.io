import { promises as fs } from 'fs'
import process from 'process'

async function merge(c1, c2, c) {
    try {
        const d1 = await fs.readFile(c1)
        const d2 = await fs.readFile(c2)
        
        if (d1.byteLength != d2.byteLength) {
            console.error("Could not merge canvases, lengths were different")
            return
        }
        
        const merged = new Uint8Array(d1.byteLength)

        for (let i = 0; i < d1.byteLength; i++) {
            merged[i] = c.includes(d1.readUint8(i)) ? d2.readUint8(i) : d1.readUint8(i)
        }

        await fs.writeFile("place", merged)
        console.log("Merged canvas written to 'place'")
    }
    catch (error) {
        console.error("Error occurred:", error)
    }
}

// Get the file path from the command-line argument
if (process.argv.length < 5) {
    console.error("Usage: merge.js <cmask_canvas_path> <merge_canvas_path> <mask_colour_index=31 ... ...>")
}
else {
    const c1 = process.argv[2]
    const c2 = process.argv[3]
    const c = [parseInt(process.argv[4]) || 31]
    for (let i = 5; i < process.argv.length; i++) {
        let p = parseInt(process.argv[i]);
        if (p) c.push(p)
    }

    merge(c1, c2, c)
}