let pass = localStorage.vip ? "/" + localStorage.vip : ""
let mode = pass == "" ? true : false
let activityMode = false
let socket = new WebSocket(localStorage.server + pass)
socket.onmessage = async (data) => {
	if (activityMode) {
		let d = await data.arrayBuffer()
		data = new DataView(d)
		let code = data.getUint8(0)
		if (code == 7) {
			let a = data.getUint32(5);
			let b = data.getUint8(9);
			let cods = {
				x: a % WIDTH,
				y: a / WIDTH
			};
			console.log("a")
			fakePaint(cods.x, cods.y, "sex", b)
		}
		if (code == 6) {
			let i = 0
			while (i < data.byteLength - 2) {
				let ii = data.getUint32(i += 1)
				let b = data.getUint8(i += 4)
				xa[0] = PALETTE[b]
				let HEXC = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16);
				HEXC = HEXC.substring(0, HEXC.length - 2);
				let pxl = document.createElement("div");
				pxl.style = "position: absolute; top: " + Math.floor(ii % WIDTH) + "px; left: " + Math.floor(ii / WIDTH) + "px; height: 1px; width: 1px; background-color: " + HEXC + ";"
				document.getElementById("canvparent2").appendChild(pxl);
				console.log("X: " + Math.floor(ii % WIDTH) + ", Y: " + Math.floor(ii / WIDTH) + ", C: " + HEXC)
			}
		}
	}
}
let ifr = document.createElement('iframe')
document.body.appendChild(ifr)
socket.send = ifr.contentWindow.WebSocket.prototype.send
ifr.remove()
var ModButton = document.createElement("div")
ModButton.id = "ModButton"
ModButton.textContent = "Modtools"
ModButton.style = `
position: absolute;
bottom: 20px;
right: 90px;
width: 80px;
height: 24px;
padding: 5px;
line-height: 15px;
background: white;
border-radius: 100px;
text-align: center;
z-index: 5;
box-shadow: black 0px 0px 30px;
box-sizing: border-box;
user-select: none;
cursor: pointer;
`
document.body.appendChild(ModButton);
var SizePanel = document.createElement("input")
SizePanel.type = "range"
SizePanel.max = "32"
SizePanel.value = "16"
SizePanel.min = "8"
SizePanel.id = "EraserSize"
SizePanel.style = "position: absolute; height: 7%; width: 20%; top: -50%; left: 50%; transform: translate(-50%); transition: transform .3s ease-out; z-index: 320;"
document.body.appendChild(SizePanel)
var ModPanel = document.createElement("div")
ModPanel.id = "ModPanel"
ModPanel.innerHTML = `
<div style="display: flex; flex-direction: row;" noselect="" bis_skin_checked="1">
    <h1 style="user-select: none;">Modtools v1.4.5</h1>
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="activityModee" x="0px" y="0px" viewBox="0 0 612 612" style="position: relative; top: 3px; left: 2.5%; cursor: pointer; transform: translate(0, 10%); height: 24px; enable-background:new 0 0 488.898 488.898;" xml:space="preserve"><g><g><path d="M609.608,315.426c3.19-5.874,3.19-12.979,0-18.853c-58.464-107.643-172.5-180.72-303.607-180.72    S60.857,188.931,2.393,296.573c-3.19,5.874-3.19,12.979,0,18.853C60.858,423.069,174.892,496.147,306,496.147    S551.143,423.069,609.608,315.426z M306,451.855c-80.554,0-145.855-65.302-145.855-145.855S225.446,160.144,306,160.144    S451.856,225.446,451.856,306S386.554,451.855,306,451.855z"/><path d="M306,231.67c-6.136,0-12.095,0.749-17.798,2.15c5.841,6.76,9.383,15.563,9.383,25.198c0,21.3-17.267,38.568-38.568,38.568    c-9.635,0-18.438-3.541-25.198-9.383c-1.401,5.703-2.15,11.662-2.15,17.798c0,41.052,33.279,74.33,74.33,74.33    s74.33-33.279,74.33-74.33S347.052,231.67,306,231.67z"/></g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
    <icon-close noselect="" id="close-btn" class="active" style="position: absolute; top: 16px; right: 16px; flex: initial;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="active"><path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path></svg></icon-close>
</div>
<br>
<h4 style="user-select: none;">Canvas Selector</h4>
<br>
<select id="canvases" style="position: relative; left: 5%; font-size: 20px; text-align: center; width: 90%;"/>
<br><br>
<h4 style="user-select: none;">Image Selector</h4>
<br>
<input id="selimg" type="file" style="width: 100%;">
<br><br>
<h4 style="user-select: none;">Tools</h4>
<br>
<input id="xx" type="number" placeholder="x" style="width: 24%;">
<input id="yy" type="number" placeholder="y" style="width: 24%;">
<input id="ww" type="number" placeholder="width" style="width: 24%;">
<input id="hh" type="number" placeholder="height" style="width: 24%;">
<br><br>
<button id="rollArea" disabled style="position: absolute; left: 50%; font-size: 150%; width: 85%; transform: translate(-50%);">Rollback Area
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" viewBox="0 0 488.898 488.898" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 488.898 488.898;" xml:space="preserve"><g><g><path d="M487.247,218.699c-17.9-168.2-171.6-228.2-269.4-217.5c-72.9,8-137.3,47.9-177.9,109.2c-6.2,9.4-4.2,21.8,5.2,28.1    s21.8,3.1,28.1-6.2c34.3-51,88.4-84.3,148.8-90.5c103.6-10.7,203.6,52.4,224.7,181c15.5,94.4-58.6,212.6-181,224.7    c-74.6,7.4-147.3-25.9-189.4-86.5l38.5,8.5c10.4,2.1,21.8-4.2,23.9-15.6c2.1-10.4-4.2-21.8-15.6-23.9l-81.1-17.7    c-5.2-1-22-0.4-25,15.6l-16.6,82.2c-2.1,10.4,4.2,21.8,15.6,23.9c13,1.1,21.8-6.2,23.9-16.6l6.2-28.2    c79.5,111.3,215.3,99.8,223.7,99C400.047,475.399,503.047,366.099,487.247,218.699z"/><path d="M260.447,129.199c-11.4,0-20.8,9.4-20.8,20.8v94.7c0,5.2,2.1,10.4,6.2,14.6l94.7,94.7c12.2,11.6,25,4.2,30.2,1    c8.3-8.3,8.3-20.8,0-29.1l-89.5-89.5v-86.3C281.347,138.599,271.947,129.199,260.447,129.199z"/></g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
</button>
<br><br><br>
<button id="pasteImage" disabled style="position: absolute; left: 50%; font-size: 150%; width: 85%; transform: translate(-50%);">Paste Image
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Icons" x="0px" y="0px" viewBox="0 0 32 32" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 32 32;" xml:space="preserve"><style type="text/css">.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}</style><polyline class="st0" points="23,12 23,18 29,18 23,12 15,12 15,30 29,30 29,18 "/><path class="st0" d="M20,6h-8V4c0-1.1,0.9-2,2-2h4c1.1,0,2,0.9,2,2V6z"/><path class="st0" d="M15,28h-5c-2.2,0-4-1.8-4-4V8c0-2.2,1.8-4,4-4h2"/><path class="st0" d="M20,4h2c2.2,0,4,1.8,4,4v7"/></svg>
</button>
<br><br><br>
<h4 style="user-select: none;">Extra</h4>
<br>
<button id="brush" style="font-size: 150%; width: 45%;transform: translate(7%);">Brush
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" viewBox="0 0 422.555 422.555" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 422.555 422.555;" xml:space="preserve"><g><path d="M419.061,11.643c-2.223-2.127-5.45-3.139-9.544-3.139c-32.927,0-122.005,65.392-196.859,141.77   c-42.696,43.557-64.478,74.066-72.961,96.074c6.455,2.162,13.001,5.199,19.671,9.167c5.219,3.105,10.092,6.77,14.468,10.88   c0.006,0.002,0.008,0.004,0.014,0.006c8.528,8.007,14.971,17.444,19.188,27.578c21.773-9.709,51.271-32.1,92.405-74.059   C369.608,134.048,439.164,30.877,419.061,11.643z"/><path d="M150.175,266.736c-11.455-6.818-22.257-10.794-32.808-12.057c-2.466-0.295-4.918-0.443-7.361-0.443   c-8.065,0-16.189,1.62-24.149,4.817c-30.825,12.389-33.835,41.568-36.491,67.315c-3.306,32.045-6.979,52.036-39.43,58.957   c-5.942,1.268-10.125,6.608-9.93,12.682c0.195,6.074,4.711,11.136,10.723,12.02c18.16,2.67,35.401,4.023,51.246,4.024   c0.004,0,0.007,0,0.011,0c34.558,0,63.052-6.296,84.689-18.712c19.855-11.393,33.144-27.572,38.43-46.788   c2.911-10.582,3.135-21.488,1.005-31.951C182.025,296.534,169.276,278.103,150.175,266.736z"/></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
</button>
<button id="eraser" style="font-size: 150%; width: 45%;transform: translate(12%);">Eraser
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 297 297" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 297 297;" xml:space="preserve"><g><g><path d="M287.55,260.218H149.47l131.846-131.846c10.437-10.437,10.437-27.419,0-37.856l-64.808-64.808    c-10.437-10.437-27.419-10.436-37.856,0L11.788,192.573c-5.055,5.056-7.84,11.778-7.84,18.928c0,7.15,2.785,13.872,7.84,18.928    l29.79,29.79H9.45c-5.218,0-9.45,4.231-9.45,9.45c0,5.219,4.231,9.45,9.45,9.45h278.1c5.218,0,9.45-4.231,9.45-9.45    C297,264.45,292.769,260.218,287.55,260.218z M192.016,39.072c3.069-3.069,8.063-3.067,11.128,0l64.808,64.808    c1.487,1.486,2.305,3.462,2.305,5.565c0,2.101-0.819,4.078-2.305,5.564L159.309,223.651l-75.936-75.936L192.016,39.072z     M122.742,260.219H68.306l-43.154-43.155c-3.068-3.067-3.068-8.06,0-11.127l44.858-44.858l75.936,75.936L122.742,260.219z"/></g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
</button>
<br><br>
<h4 style="user-select: none;">Actions</h4>
<br>
<button id="editModeMode" style="position: absolute; left: 16px; font-size: 150%; width: 45%;">editMode Mode
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" viewBox="0 0 217.855 217.855" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 217.855 217.855;" xml:space="preserve"><path d="M215.658,53.55L164.305,2.196C162.899,0.79,160.991,0,159.002,0c-1.989,0-3.897,0.79-5.303,2.196L3.809,152.086  c-1.35,1.352-2.135,3.166-2.193,5.075l-1.611,52.966c-0.063,2.067,0.731,4.069,2.193,5.532c1.409,1.408,3.317,2.196,5.303,2.196  c0.076,0,0.152-0.001,0.229-0.004l52.964-1.613c1.909-0.058,3.724-0.842,5.075-2.192l149.89-149.889  C218.587,61.228,218.587,56.479,215.658,53.55z M57.264,201.336l-42.024,1.28l1.279-42.026l91.124-91.125l40.75,40.743  L57.264,201.336z M159,99.602l-40.751-40.742l40.752-40.753l40.746,40.747L159,99.602z"/><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
</button>
<button id="viewMode" style="position: absolute; right: 16px; font-size: 150%; width: 45%;">View Mode
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" viewBox="0 0 80.794 80.794" style="transform: translate(0, 10%); height: 24px; enable-background:new 0 0 80.794 80.794;" xml:space="preserve"><g><g><path d="M79.351,38.549c-0.706-0.903-17.529-22.119-38.953-22.119c-21.426,0-38.249,21.216-38.955,22.119L0,40.396l1.443,1.847    c0.706,0.903,17.529,22.12,38.955,22.12c21.424,0,38.247-21.217,38.953-22.12l1.443-1.847L79.351,38.549z M40.398,58.364    c-15.068,0-28.22-13.046-32.643-17.967c4.425-4.922,17.576-17.966,32.643-17.966c15.066,0,28.218,13.045,32.642,17.966    C68.614,45.319,55.463,58.364,40.398,58.364z"/><path d="M40.397,23.983c-9.052,0-16.416,7.363-16.416,16.414c0,9.053,7.364,16.417,16.416,16.417s16.416-7.364,16.416-16.417    C56.813,31.346,49.449,23.983,40.397,23.983z M40.397,50.813c-5.744,0-10.416-4.673-10.416-10.417    c0-5.742,4.672-10.414,10.416-10.414c5.743,0,10.416,4.672,10.416,10.414C50.813,46.14,46.14,50.813,40.397,50.813z"/></g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>
</button>
`
ModPanel.style = `
position: absolute;
width: 380px;
height: calc(110% - 85px);
right: 0px;
background-color: white;
margin-top: 15px;
margin-right: 10px;
z-index: 8;
border-radius: 16px;
padding: 10px;
transition: transform .3s ease-out;
box-shadow: 0 0 30px black;
box-sizing: border-box;
transform: translateX(calc(100% + 50px));
`
document.body.appendChild(ModPanel);
let RollArea = document.createElement("div");
RollArea.style = "background: rgba(60, 111, 163, 0.81); pointer-events: none; position: absolute; transform: translate(0px, 0px) scale(1); transform-origin: top left; will-change: transform; z-index: 12;"
document.getElementById("canvparent2").appendChild(RollArea)
let EraseArea = document.createElement("div");
EraseArea.style = "background: rgb(233 36 36 / 81%); pointer-events: none; position: absolute; transform: translate(0px, 0px) scale(1); transform-origin: top left; will-change: transform; z-index: 12;"
document.getElementById("canvparent2").appendChild(EraseArea)

function showToast(text, duration = 5000, back, color) { //TODO: Fix this
	console.log(text)
}

function zz(n) {
	if (n < 10) return "0" + n;
	else return n;
}

async function fetchBackuplist() {
	let response = await fetch("https://server2.rplace.tk:8081/backuplist");
	if (response.ok) {
		let text = await response.text();
		text = text.split('\n')
		text.pop()
		let rgb = [25, 25, 25];
		for (let i = 0; i < text.length; i++) {
			rgb[0] = Math.floor(Math.random() * 255 + 25),
				rgb[1] = Math.floor(Math.random() * 255 + 25),
				rgb[2] = Math.floor(Math.random() * 255 + 25)
			let opt = document.createElement("option");
			opt.value = text[i];
			opt.innerHTML = text[i];
			opt.style = `background-color: rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
			canvases.appendChild(opt);
		}
	} else {
		alert("HTTP-Error: " + response.status);
	}
}

fetchBackuplist()

//FIX THIS - all references to this will be broken as I have changed it from object to arr
let palette2 = [
	'109, 0, 26', '190, 0, 57', '255, 69, 0', '255, 168, 0', '255, 214, 53', '255, 248, 184', '0, 163, 104', '0, 204, 120', '126, 237, 86', '0, 117, 111',
	'0, 158, 170', '0, 204, 192', '36, 80, 164', '54, 144, 234', '81, 233, 244', '73, 58, 193', '106, 92, 255','148, 179, 255', '129, 30, 159', '180, 74, 192', '228, 171, 255', '222, 16, 127', '255, 56, 129', '255, 153, 170',
	'109, 72, 47','156, 105, 38', '255, 180, 112', '0, 0, 0', '81, 82, 82', '137, 141, 144', '212, 215, 217', '255, 255, 255',
]

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

let rollBoard;
let pasteBoard;
let pasteBoard2 = [];
let areaSelected = false,
	selecting = false;
let last = {
	x: 0,
	y: 0,
};
let rollarea = {
	x: 0,
	y: 0,
	w: 0,
	h: 0
}
var changes = [];
var PanelOpen = false, editModeMode = false, ViewMode = false, BrushMode = false, EraserMode = false;
let BrushSize = 2, EraserSize = 8;
//let canvases = document.getElementById("canvases"); let rollArea = document.getElementById("rollArea"); let pasteImage = document.getElementById("pasteImage"); let editMode = document.getElementById("editModeMode");
let View = document.getElementById("viewMode"); //TODO: FIX THESE
let Brush = document.getElementById("brush");
let Eraser = document.getElementById("eraser");
let Selimg = document.getElementById("selimg");

SizePanel.oninput = () => {
	EraserSize = Number(SizePanel.value)
}
async function fetchOldPlace(url) {
	await fetch("https://server2.rplace.tk:8081/backups/" + url).then(a => a.arrayBuffer()).then(a => {
		rollBoard = new Uint8Array(a)
	})
	showToast("Canvas loaded succesfully.", 3000, "green", "white");
	console.log(rollBoard)
}
async function statePanel() {
	if (PanelOpen) {
		document.getElementById("ModPanel").style.transform = "translateX(calc(100% + 50px))";
		PanelOpen = false;
	} else {
		document.getElementById("ModPanel").style.transform = "";
		PanelOpen = true;
	}
}

function disable(els) {
	for (let i; i < els.length(); i++) els[i].disabled = true
}
function enable(els) {
	for (let i; i < els.length(); i++) els[i].removeAttribute("disabled")
}
async function disableEl(el) {
	switch (el) {
		case '*': disable([rollArea, canvases, Selimg, Eraser, Brush, viewMode, editMode, xx, yy, x2, y2]); break
		case 'editMode': disable([canvases, Brush, Eraser, viewMode]); enable([rollArea, pasteImage, editMode]); break
		case 'view': disable([canvases, Brush, Eraser, editMode, pasteImage]); enable([View]); break
		case 'brush': disable([canvases, Eraser, View, rollArea, editMode]); enable([Brush]); break
		case 'eraser': disable([canvases, Eraser, View, rollArea, editMode, Brush, pasteImage]); enable([Eraser]); break
	}
}
async function enableEl(el) {
	switch (el) {
		case '*': disable([rollArea]); enable([canvases, Selimg, Eraser, Brush, View, editMode, xx, yy, x2, yz]); break
		case 'editMode': disable([rollArea, pasteImage]); enable([canvases, Brush, Eraser, View]); break
		case 'view':
		case 'brush':
		case 'eraser': disable([rollArea, pasteImage]); enable([canvases, Eraser, View, Brush, editMode]); break
	}
}

async function enableMovement() {
	document.body.onmousemove = function(e) {
		if (e.target != document.body && !canvparent2.contains(e.target)) return
		moved--
		let dx = -(mx - (mx = e.clientX - innerWidth / 2))
		let dy = -(my - (my = e.clientY - innerHeight / 2))
		if (dx != dx || dy != dy) return
		if (click) {
			x -= dx / (z * 50)
			y -= dy / (z * 50)
			pos()
			clearInterval(anim)
		}
	}
	clicked = function(clientX, clientY) {
		clearInterval(anim)
		clientX = Math.floor(x + (clientX - innerWidth / 2) / z / 50) + 0.5
		clientY = Math.floor(y + (clientY - innerHeight / 2) / z / 50) + 0.5
		if (clientX == Math.floor(x) + 0.5 && clientY == Math.floor(y) + 0.5) {
			clientX -= 0.5;
			clientY -= 0.5
			if (CD < Date.now()) zoomIn(), showPalette()
			else audios.invalid.run()
			return
		}
		(CD > Date.now() ? audios.invalid : audios.highlight).run()
		anim = setInterval(function() {
			x += (clientX - x) / 10
			y += (clientY - y) / 10
			pos()
			if (Math.abs(clientX - x) + Math.abs(clientY - y) < 0.1) clearInterval(anim)
		}, 15)
	}
}
async function disableMovement() {
	clicked = "";
	document.body.onmousemove = "a"
}
async function getArea(xx, yy, ww, hh) {
	if (document.getElementById("canvasarea")) document.getElementById("canvasarea").outerHTML = ""
	let canv = document.createElement("canvas");
	canv.id = "canvasarea"
	canv.height = hh;
	canv.width = ww;
	document.body.appendChild(canv)
	let ctx = canv.getContext("2d")
	for (let yyy = 0; yyy < hh; yyy++) {
		for (let xxx = 0; xxx < ww; xxx++) {
			let rboard = rollBoard[(xxx + xx) % WIDTH + ((yyy + yy) % HEIGHT) * WIDTH];
			xa[0] = PALETTE[rboard];
			ctx.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
			await ctx.clearRect(xxx, yyy, 1, 1)
			await ctx.fillRect(xxx, yyy, 1, 1)
		}
	}
	return canv.toDataURL();
}

function fill(xxxx, yyyy, w, h, originalBoard) {
	if (isNaN(xxxx) || isNaN(yyyy)) return;
	w >>>= 0;
	h >>>= 0;
	xxxx >>>= 0;
	yyyy >>>= 0;
	if (w > 250 || h > 250 || !w || !h || xxxx >= WIDTH || yyyy >= HEIGHT) return;
	let buffer = new Uint8Array(w * h + 7),
		i = xxxx + yyyy * WIDTH
	Object.assign(buffer, [99, w, h, i >> 24, i >> 16, i >> 8, i])
	let hi = 0
	while (hi < h) {
		buffer.set(originalBoard.slice(i, i + w), hi * w + 7)
		i += WIDTH
		hi++
	}
	socket.send(buffer)
}

function paste(xxxx, yyyy, w, h, originalBoard) {
	if (isNaN(xxxx) || isNaN(yyyy)) return;
	w >>>= 0;
	h >>>= 0;
	xxxx >>>= 0;
	yyyy >>>= 0
	if (w > 250 || h > 250 || !w || !h || xxxx >= WIDTH || yyyy >= HEIGHT) return;
	let buffer = new Uint8Array(w * h + 7),
		i = xxxx + yyyy * WIDTH
	Object.assign(buffer, [99, w, h, i >> 24, i >> 16, i >> 8, i])
	buffer.set(originalBoard, 7)
	socket.send(buffer)
	showToast("Image pasted succesfully.", 5000, "green", "white");
}
async function fakePaint(xxx, yyy, cc, cc2) {
	if (cc == "sex") xa[0] = PALETTE[cc2];
	else xa[0] = PALETTE[cc]
	c.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
	await c.clearRect(xxx, yyy, 1, 1)
	await c.fillRect(xxx, yyy, 1, 1)
}
async function realPaint(xxx, yyy, cc) {
	let a = new DataView(new Uint8Array(6).buffer)
	a.setUint8(0, 4)
	a.setUint32(1, Math.floor(xxx) + Math.floor(yyy) * WIDTH)
	a.setUint8(5, cc)
	socket.send(a)
}
async function fillArea(xxx, yyy, w, h) {
	let somethingChanged = false;
	if (PEN == -1) return showToast("You didn't select any color.", 3000, "red", "white");
	for (let yy = 0; yy < h; yy++) {
		for (let xx = 0; xx < w; xx++) {
			let cc = c.getImageData(xx + xxx, yy + yyy, 1, 1).data
			let pxl = palette2[`${cc[0]}, ${cc[1]}, ${cc[2]}`];
			if (pxl == null || pxl == PEN) continue;
			if (xx + xxx > WIDTH - 1 || yy + yyy > HEIGHT - 1) continue;
			somethingChanged = true;
			fakePaint(xx + xxx, yy + yyy, PEN)
			realPaint(xx + xxx, yy + yyy, PEN)
		}
	}
	if (somethingChanged) {
		console.log(pixels + " pixels made an total of $" + costs.toFixed(3) + " costs to the server.")
		document.title = "place : " + pixels + "px/$" + costs.toFixed(3)
	}
}
async function updateTitle() {
	document.title = "modtools: " + changes.length + " changes made."
}
document.getElementById("activityModee").onclick = () => {
	if (activityMode) {
		activityMode = false;
		canvas.style.filter = ""
		enableEl('*')
	} else {
		activityMode = true;
		canvas.style.filter = "brightness(0.1)"
		disableEl('*')
	}
}
rollArea.onclick = async () => {
	if (x2.value <= 0 || x2.value >= 250 || y2.value <= 0 || y2.value >= 250) return showToast("Selection size is minor than 0x0 or it is bigger than 250x250.", 5000, "red", "white");
	fill(Number(xx.value), Number(yy.value), Number(x2.value), Number(y2.value), rollBoard)
	let b64 = await getArea(Number(xx.value), Number(yy.value), Number(x2.value), Number(y2.value))
	let imgg = new Image()
	imgg.src = b64;
	imgg.onload = async function() {
		c.drawImage(imgg, Number(xx.value), Number(yy.value))
	};
}
let inputt = Selimg;
inputt.addEventListener("input", async function() {
	if (!inputt.files || !inputt.files[0]) return;
	let reader = new FileReader();
	reader.addEventListener("load", async function() {
		let image = new Image();
		image.src = reader.result;
		image.addEventListener("load", async function() {
			if (image.height > 250 || image.width > 250) {
				inputt.files[0] = undefined;
				pasteBoard = undefined;
				pasteBoard2 = [];
				showToast("Image bigger than 250x250.", 5000, "red", "white")
				return;
			}
			if (document.getElementById("canvasImg")) document.getElementById("canvasImg").outerHTML = "";
			var div = document.createElement("canvas")
			div.id = "canvasImg"
			div.style = "position: absolute; z-index: -24; visibility: hidden;"
			div.width = image.width;
			div.height = image.height;
			document.body.appendChild(div)
			let ctxx = document.getElementById("canvasImg").getContext("2d")
			ctxx.drawImage(image, 0, 0);
			let arr = [];
			for (let yyy = 0; yyy < image.height; yyy++) {
				for (let xxx = 0; xxx < image.width; xxx++) {
					let pxl = ctxx.getImageData(xxx, yyy, 1, 1).data;
					let pxl2 = palette2[`${pxl[0]}, ${pxl[1]}, ${pxl[2]}`];
					if (pxl2 == null) continue;
					arr.push(pxl2)
					pasteBoard2.push([xxx, yyy, pxl2])
				}
			}
			pasteBoard = new Uint8Array(arr);
			showToast("Image loaded: " + pasteBoard.length + " pixels", 5000, "green", "white");
			console.log(pasteBoard)
		});
	});
	reader.readAsDataURL(inputt.files[0]);
});
canvases.oninput = () => {
	fetchOldPlace(canvases.value);
}
View.onclick = async function() {
	if (ViewMode) {
		ViewMode = false;
		enableEl("view")
		canvas.style.filter = ""
		document.getElementById("viewarea").outerHTML = "";
	} else {
		ViewMode = true;
		disableEl("view")
		let b64 = await getArea(Number(xx.value), Number(yy.value), Number(x2.value) + 1, Number(y2.value) + 1)
		let imgg = document.createElement("img")
		imgg.src = b64
		imgg.id = "viewarea"
		imgg.style = `
    pointer-events: none;
    position: absolute;
    transform: translate(0px, 0px) scale(1);
    transform-origin: left top;
    image-rendering: pixelated;
    will-change: transform;
    z-index: 2;
    left: ${Number(xx.value)}px;
    top: ${Number(yy.value)}px;
    filter: reverse(2.5)
    `
		document.getElementById("canvparent2").appendChild(imgg)
		canvas.style.filter = "grayscale(1)"
	}
}
pasteImage.onclick = async function() {
	if (pasteBoard == undefined || pasteBoard2.length == 0) return showToast("No image selected.", 5000, "red", "white");
	paste(Number(xx.value), Number(yy.value), document.getElementById("canvasImg").width, document.getElementById("canvasImg").height, pasteBoard);
	for (let iii = 0; iii < pasteBoard2.length; iii++) {
		let rboard = pasteBoard2[iii];
		xa[0] = PALETTE[rboard[2]];
		c.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		await c.clearRect(Number(xx.value) + rboard[0], Number(yy.value) + rboard[1], 1, 1)
		await c.fillRect(Number(xx.value) + rboard[0], Number(yy.value) + rboard[1], 1, 1)
	}
}
editMode.onclick = () => {
	if (editModeMode) {
		editModeMode = false;
		enableEl("editMode")
	} else {
		editModeMode = true;
		disableEl("editMode")
	}
}
Brush.onclick = () => {
	if (BrushMode) {
		EraseArea.style.height = "0px";
		EraseArea.style.width = "0px";
		BrushMode = false;
		enableEl("brush")
		enableMovement()
	} else {
		BrushMode = true;
		disableEl("brush")
		disableMovement()
	}
}
Eraser.onclick = () => {
	if (EraserMode) {
		EraseArea.style.height = "0px";
		EraseArea.style.width = "0px";
		document.getElementById("EraserSize").style.top = "-50%"
		EraserMode = false;
		enableEl("eraser")
		enableMovement()
	} else {
		document.getElementById("EraserSize").style.top = "10%"
		EraserMode = true;
		disableEl("eraser")
		disableMovement()
	}
}
let mouseisdown = false;
document.getElementById("canvparent2").onmousedown = () => {
	mouseisdown = true;
}
document.getElementById("canvparent2").onmouseup = () => {
	mouseisdown = false;
}
document.getElementById("canvparent2").onmousemove = async function(e) {
	last.x = e.clientX, last.y = e.clientY;
	var rect = document.getElementById("canvas").getBoundingClientRect();
	scaleX = WIDTH / rect.width,
		scaleY = HEIGHT / rect.height;
	let xx = (last.x - rect.left) * scaleX;
	let yy = (last.y - rect.top) * scaleY;
	if (EraserMode) {
		EraseArea.style.height = EraserSize + "px";
		EraseArea.style.width = EraserSize + "px";
		let locX = Math.floor(xx / EraserSize);
		let locY = Math.floor(yy / EraserSize);
		EraseArea.style.transform = "translate(" + (locX * EraserSize) + "px, " + (locY * EraserSize) + "px) scale(1)"
		last.eraserX = locX * EraserSize
		last.eraserY = locY * EraserSize
	}
	if (BrushMode) {
		EraseArea.style.height = BrushSize + "px";
		EraseArea.style.width = BrushSize + "px";
		let locX = Math.floor(xx) // BrushSize);
		let locY = Math.floor(yy) // BrushSize);
		EraseArea.style.transform = "translate(" + (locX /* BrushSize*/ ) + "px, " + (locY /* BrushSize*/ ) + "px) scale(1)"
		last.eraserX = locX // * BrushSize
		last.eraserY = locY // * BrushSize
	}
	last.realX = Math.floor(xx),
		last.realY = Math.floor(yy);
	if (EraserMode || BrushMode) {
		if (last.eraserX < 0 || last.eraserY < 0 || last.eraserX > WIDTH - 1 || last.eraserY > HEIGHT - 1) return;
		if (mouseisdown) {
			if (EraserMode) fillArea(last.eraserX, last.eraserY, EraserSize, EraserSize);
			if (BrushMode) fillArea(last.eraserX, last.eraserY, BrushSize, BrushSize);
		}
	}
}
ModButton.onclick = () => {
	statePanel()
}
document.querySelectorAll('#close-btn')[document.querySelectorAll('#close-btn').length - 1].onclick = () => {
	statePanel();
}
document.body.onkeydown = async (e) => {
	if (e.keyCode == 17) {
		let clrr = PEN;
		let cx = Math.floor(last.realX),
			cy = Math.floor(last.realY)
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				let a = new DataView(new Uint8Array(6).buffer)
				a.setUint8(0, 4)
				a.setUint32(1, (Math.floor(Math.random() * 8) + cx) + (Math.floor(Math.random() * 8) + cy) * WIDTH)
				a.setUint8(5, clrr)
				socket.send(a)
				await sleep(1000)
			}
		}
	}
	if (e.keyCode == 89) {
		if (PEN == -1) return;
		xa[0] = PALETTE[PEN];
		c.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		await c.clearRect(last.realX, last.realY, 1, 1)
		await c.fillRect(last.realX, last.realY, 1, 1)
		let a = new DataView(new Uint8Array(6).buffer)
		a.setUint8(0, 4)
		a.setUint32(1, Math.floor(last.realX) + Math.floor(last.realY) * WIDTH)
		a.setUint8(5, PEN)
		socket.send(a)
	}
	if (e.keyCode == 90) {
		xx.value = last.realX
		yy.value = last.realY
		RollArea.style.transform = "translate(" + xx.value + "px, " + yy.value + "px)"
		rollarea.x = Number(xx.value)
		rollarea.y = (yy.value)
	}
	if (e.keyCode == 88) {
		if (Math.abs(xx.value - last.realX) > 250 || Math.abs(yy.value - last.realY) > 250) return showToast("The maximum area size is 250x250!")
		if (Math.abs(xx.value - last.realX) < 0 || Math.abs(yy.value - last.realY) < 0) return
		x2.value = Math.abs(xx.value - last.realX);
		y2.value = Math.abs(yy.value - last.realY);
		RollArea.style.height = Math.abs(yy.value - last.realY) + 1 + "px";
		RollArea.style.width = Math.abs(xx.value - last.realX) + 1 + "px";
		rollarea.w = Math.abs(xx.value - last.realX) + 1
		rollarea.h = Math.abs(yy.value - last.realY) + 1
	}
}
if (mode) {
	disableEl('*');
	ModButton.style.visibility = "hidden";
	showToast("No modpass found, disabling modtools.", 10000, "red", "white")
}