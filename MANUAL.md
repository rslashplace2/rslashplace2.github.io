# Rplace.tk custom server manual.

## Preramble:
Setting up a custom server that users can connect to (usually with the server switch menu, under the key combination shift+s) is admittedly not an easy feat *and would only be recommended for those with moderate knowledge in development with node and javascript*, however, provided you follow the rules outlined in the [README](./README.md), this guide will help you along the way of setting up a shiny custom rplace server, with whatever canvas, chat or cooldown rules you like!

### Important notes:
 - To run a rplace custom server, you require:
    * Acess to a `server` or `PC` capable of running node. 
    * Some `knowledge in computing` and the use of node/javascript
    * Acess to your/your server's `port forwarding` rules in order to connect your custom server to the internet
    * A `web domain` for https connections [will be outlined later in this document]
 - If you intend to use a windows or macos host, a virtual machine must be used if you do not intend on having to make modifications to many parts of the server, as the server has only been designed to run on **linux**.
 - If you encounter a bug, please ask us on the discord or submit a github issue.
 - Make sure that you are running the latest versions of runtimes and libraries, such as the latest node.js, or you may encounter issues.
 - Read the instructions *carefully*, if something seems like common sense, you are probably doing it wrong and will mess up the process further down the line.

## Setting up the server:
1. Get a web domain.
2. Port forward ports 80 (will be used by certbot), 443 (web socket), 8080 (place file server) to the computer you decide to use to host the server
3. Install certbot, nodejs and npm
4. Use certbot to set up the keys and certificates on the computer you would like to use
5. Install the latest version of node from the official site onto your computer
6. Install the latest npm available on your system
7. Clone the rslashplace2.github.io github repository, it may take a while ~~because we pack in all node modules~~ 
8. Enter the rslashplace2.github.io directory cloned to your system
9. Run ./newboard.sh [canvas width] [canvas height] [cooldown in seconds] to generate a new config.json file e.g `./newboard.sh 500 500 1`
10. Open config.json in a text editor, set "USE_GIT" to false to disable the canvas backup system
11. Open server.js in a text editor, comment out the line 'let ORIGIN ='... and any other line conataining that variable with `//` before it
12. Set `PORT` in server.js to 443, or whatever port you desire,
13. Set the `key:` and `cert:` variables to the path that certbot gave you for your domain keys and certificates
14. Run server.js with admin privilages, such as "sudo node server.js"
15. In a new terminal, enter the rplace_http_server directory
16. Modify the server.js file in this directory, and set the `PORT` to 8080, or whatever port you desire for the place file server
17. Set the `key:` and `cert:` variables in this file to the path of the keys and certificates used in the main folder's server.js file.
18. Remain in the place_http_server directory, and run `node .` to start up the server.
19. If no errors occured, Bon Voilà, you have set up an ruplace custom server acessable from in the game.
