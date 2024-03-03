# rplace.live - An open source faithful recreation of r/place

This site aims to be as similar to the april fools r/place event, where users were given a 2000x2000px canvas, allowing anyone to place a single pixel on it at a time. 

"Alone you can create something, but together, you can create something bigger" (or something like that)

**Site link: https://rplace.live/**

![https://rplace.live running on firefox as of 18/4/2022](site_demo.png)

*Feel free to contribute!*

# Setting up my own custom canvas!
To set up your own custom canvas to be played on rplace.tk, we have made a guide at our [Manual](MANUAL.md)!


# Development

Forks of this project should either:
- Connect to the same server, that is, wss://server.rplace.tk:443
- Or use the same app, that is, https://rplace.live

This project is licensed under the GNU LGPL v3, out of goodwill we request forks are
not run commercially (That is, they should not generate more than the cost of server upkeep).

### For example,

- My app (`fork-of-a-place.tk`) connecting to `wss://server.rplace.tk:443` [✅ Cool, non-commercially]
- Making `https://rplace.live` connect to `wss://fork-of-a-place.tk` (via devtools, for example) [✅ Cool, non-commercially]
- My app (`fork-of-a-place.tk`) connecting to `wss://fork-of-a-place.tk` [❌ Not cool: Uses both different app and different server]

### Testing:
 - While in theory, all dependencies should be installable using `bun install` within the root directory. Some
 modules, such as skia canvas may have dependency issues using the bun package manager. It is reccomended you
 also run `npm i` to ensure all dependencies, such as n-api v6 are installed.
 - The server can be run with `bun run server.js` in the root directory of the project.
 - You can use a simple HTTP server, such as the npm static-server module to test the client with a local server. For example, `npx static-server --cors='*'`
 
For more information on the game's protocol, look to the [protocol documentation](PROTOCOL.md).

### Also see:
 - [bun vscode extension](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode)
