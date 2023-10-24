# Rplace.live protocol documentation

## Preramble & protocol outline
The site was initially coded within a day, and main development, jump started by BlobKat over three. This has had many long lasting impacts on the site, resulting in some development decisions that made sense for that short term period, but have proved very complicated and confusing in the long term. One of the biggest impacts was the choice to use "git and changes system", for syncing the canvas between the client and server on the main [javascript server software](server.js), while also ensuring minimal bandwidth on the hoster's behalf. Further complicated by the introduction of the new server software, [RplaceServer](https://github.com/Zekiah-A/RplaceServer), which chose to use a completely new system, wherein the site is solely dependent on the monolithic server software, which handles both the socket live pixels, and hosting the canvas files directly for client consumption in a compressed form. 

## Packets
The site uses websocket for live client server communication. All packets are composed of an initial '''code''' byte, representing the type of the packet to be identified on the server, with all numberic packet data being formatted as big endian. 

### Pixel packet:
The pixel packet is one of the simplest. It is a six byte packet, the first byte being the packet '''code,''' the second to 5th 
bytes being '''position (board index)''' of the pixel, represented by a 4 byte unsigned 32 bit integer, and finally a byte representing the index of the '''colour''' in the palette that the pixel represents.

One can retrieve the X and Y position from an given pixel index with some basic math. To get the X position, we do '''index % canvas_width''', and to get the Y position '''floor(index / canvas_width)'''.

### Chat history packet
The chat history packet is used to ask the server to load a certain set of messages from the database, for example, in the context of attempting to load previous chat messages from before a client connected to the game session when scrolling up in the chat history.

 * (u8) packetCode = 13
 * (u32) fromMessageId (If set to 0, AND you are asking for messages sent BEFORE this specified message Id (see next byte), it will give you messages relative the most recent messageId in the channel (see last n bytes))
 * (u8) message count AND before|after (last 7 bits will tell the server how many messages you want before or since the specified message Id, first (most significant) bit will tell the server if you want messages from BEFORE or AFTER the specified message Id)
 * (n bytes) name of chat channel as a UTF8 encoded string

MessageId ascends as new chat messages are sent, so greater message ID = more recent.
