/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Contains shared resources across pages
const DEFAULT_SERVER = "wss://server.rplace.live:443"
const DEFAULT_BOARD = "https://raw.githubusercontent.com/rplacetk/canvas1/main/place"
const DEFAULT_AUTH = "https://server.rplace.live/auth"

const TRANSLATIONS = {
	en: {
		// Game
		connecting: "Connecting...",
		connectingFail: "Could not connect!",
		disconnectedFromServer: "Disconnected from server",
		downloadingImage: "Downloading image...",
		placeTile: "Place a tile",
		donate: "Donate",
		myAccount: "My Account",
		chat: "Chat",
		liveChat: "Live Chat:",
		nicknameToContinue: "Enter a nickname to continue:",
		changeChannel: "Change channel:",
		captchaPrompt: "Solve this small captcha to help keep rplace.live fun for all...",
		webappInstall: "Install rplace.live web app",
		connectionProblems: "Connection problems?",
		tryClickingHere: "try clicking here",
		pleaseBeRespectful: "Please be respectful and try not to spam!",
		enterNickname: "Enter nickname...",
		enterMessage: "Enter message...",
		signInInstead: "Sign in instead",
		createNewAccount: "Create a new account",
		mention: "Mention",
		replyTo: "Reply to",
		addReaction: "Add reaction",
		report: "Report",
		block: "Block",
		unblock: "Unblock",
		changeMyName: "Change my name",
		putOnCanvas: "🫧 Put on canvas",
		sendInLiveChat: "📨 Send in live chat",
		overlayMenu: "Overlay menu",
		modalAboutContent: "There is an empty canvas.<br><br>You may place a tile upon it, but you must wait to place another.<br><br>Individually you can create something.<br><br>Together you can create something more.",
		overlayMenuDesciption: "Visualise your build with a template image!",
		messageNotFound: "Message could not be loaded",
		placedBy: "Placed by:",
		lockMessage: "This canvas is locked... You can't place pixels here anymore",
		adHidden: "Ad hidden for 14 days!",
		specialEventTitle: "Special event - August 21st!",
		copiedToClipboard: "Copied to clipboard!",
		// Posts
		rplaceLivePosts: "rplace.live posts",
		searchKeyword: "Search keyword",
		createPost: "Create post",
		communityPosts: "Community posts",
		sortBy: "Sort by:",
		hideSensitive: "Hide sensitive:",
		date: "Date",
		upvotes: "Upvotes",
	}
}

const lang = navigator.language.split("-")[0]

const TRANSLATION_EXPIRY = 3 * 24 * 60 * 60 * 1000 // 3 days
function openTranslationDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("translationsDB", 1)
		request.onupgradeneeded = event => {
			const db = event.target.result
			db.createObjectStore("translations", { keyPath: "lang" })
		};
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

function getCachedTranslation(lang) {
	return new Promise(async (resolve, reject) => {
		const db = await openTranslationDB()
		const transaction = db.transaction("translations", "readonly")
		const store = transaction.objectStore("translations")
		const request = store.get(lang)
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

function setCachedTranslation(lang, data) {
	return new Promise(async (resolve, reject) => {
		const db = await openTranslationDB()
		const transaction = db.transaction("translations", "readwrite")
		const store = transaction.objectStore("translations")
		const request = store.put({ lang, data, timestamp: Date.now() })
		request.onsuccess = () => resolve()
		request.onerror = event => reject(event.target.error)
	})
}

async function fetchTranslations(lang) {
	try {
		const cachedTranslation = await getCachedTranslation(lang)
		const now = Date.now()
		if (cachedTranslation && (now - cachedTranslation.timestamp) <= TRANSLATION_EXPIRY) {
			return cachedTranslation.data
		}
		const response = await fetch(`translations/${lang}.json`)
		if (!response.ok) {
			throw new Error(`Translations for ${lang} not found`)
		}
		const translation = await response.json()
		await setCachedTranslation(lang, translation)
		TRANSLATIONS[lang] = translation
		return translation
	} catch (error) {
		console.log(error)
		return TRANSLATIONS["en"]
	}
}

async function translate(key) {
	let translations = TRANSLATIONS[lang]
	if (!translations) {
		translations = await fetchTranslations(lang)
	}
	return translations?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key
}

async function translateAll() {
	let translations = TRANSLATIONS[lang]
	if (!translations) {
		translations = await fetchTranslations(lang)
	}
	const elements = document.querySelectorAll("[translate]")
	elements.forEach((element) => {
		const key = element.getAttribute("translate")
		const translation = translations?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key
		if (element.nodeName === "INPUT" || element.nodeName === "TEXTAREA") {
			if (element.getAttribute("type") == "text") {
				element.placeholder = translation || element.placeholder
			}
			else {
				element.value = translation || element.value
			}
		}
		else {
			element.innerHTML = translation || element.innerHTML
		}
	})
}

// Preload default language translations
fetchTranslations(lang)

class PublicPromise {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}

class PublicPromiseSync {
	locked
	resolve
	reject
	#promise
	constructor() {
		this.#promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
		this.locked = false
	}

	async acquireAwaitPromise() {
		if (this.locked) {
			throw new Error("This promise is already being awaited.")
		}
		this.locked = true
		try {
			const result = await this.#promise
			this.locked = false
			return result
		}
		catch (error) {
			this.locked = false
			throw error
		}
	}
}

function sanitise(txt) {
	return txt.replaceAll(/&/g,"&amp;").replaceAll(/</g,"&lt;").replaceAll(/"/g,"&quot;")
}

function markdownParse(text) {
	// Headers
	text = text.replace(/^(#{3}\s)(.+)/gm, (match, p1, p2) => {
		return `<h3>${p2}</h3>`
	})
	text = text.replace(/^(#{2}\s)(.+)/gm, (match, p1, p2) => {
		return `<h2>${p2}</h2>`
	})
	text = text.replace(/^(#{1}\s)(.+)/gm, (match, p1, p2) => {
		return `<h1>${p2}</h1>`
	})
	// Bold
	text = text.replace(/\*\*(.+?)\*\*/g, (match) => {
		return `<b>${match.slice(2, -2)}</b>`
	})
	// Underline
	text = text.replace(/__(.+?)__/g, (match) => {
		return `<u>${match.slice(2, -2)}</u>`
	})
	// Italic
	text = text.replace(/\*([^*]+?)\*/g, (match) => {
		return `<i>${match.slice(1, -1)}</i>`
	})
	text = text.replace(/_(.+?)_/g, (match) => {
		return `<i>${match.slice(1, -1)}</i>`
	})
	// Spoiler
	text = text.replace(/\|\|([\s\S]+?)\|\|/g, (match) => {
		return `<r-spoiler hidden="true">${match.slice(2, -2)}</r-spoiler>`
	})
	// Strikethrough
	text = text.replace(/~(.+?)~/g, (match) => {
		return `<s>${match.slice(1, -1)}</s>`
	})
	// Separator
	text = text.replace(/^\s*---\s*$/gm, () => {
		return "<hr>"
	})
	return text
}

// Utility functions for Auth DB IndexedDB caches
const currentAuthUrl = new URL(localStorage.auth || DEFAULT_AUTH) // i.e server.rplace.live/auth
const currentAuthDb = `${currentAuthUrl.host}${currentAuthUrl.pathname}`

function openCurrentAuthDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(currentAuthDb, 2)
		request.onupgradeneeded = event => {
			const db = event.target.result
			db.createObjectStore("profiles", { keyPath: "id" })
			db.createObjectStore("users", { keyPath: "id" })
		}
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

function getCachedData(storeName, key) {
	return new Promise(async (resolve, reject) => {
		const db = await openCurrentAuthDB()
		const transaction = db.transaction(storeName, "readonly")
		const store = transaction.objectStore(storeName)
		const request = store.get(key)
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

function setCachedData(storeName, data) {
	return new Promise(async (resolve, reject) => {
		const db = await openCurrentAuthDB()
		const transaction = db.transaction(storeName, "readwrite")
		const store = transaction.objectStore(storeName)
		const request = store.put(data)
		request.onsuccess = () => resolve()
		request.onerror = event => reject(event.target.error)
	})
}

// Responsible for setting and retrieving form DB, will attempt to grab the object from the DB, if it can't
// it will grab the object from the URL and then cache it in the database
async function cachedFetch(keystore, id, url, expiry) {
	const now = Date.now()
	let cachedObject = await getCachedData(keystore, id)
	if (!cachedObject || (now - cachedObject.timestamp) > expiry) {
		const res = await fetch(url)
		if (!res.ok) {
			console.error(`Could not fetch object ${id} belonging to ${keystore}: ${res.status} ${res.statusText}:`, await res.json())
			return null
		}

		cachedObject = await res.json()
		await setCachedData(keystore, { id, data: cachedObject, timestamp: now })
	}
	else {
		cachedObject = cachedObject.data
	}

	return cachedObject
}

window.moduleExports = {
	...window.moduleExports,
	get DEFAULT_AUTH() {
		return DEFAULT_AUTH
	},
	get markdownParse() {
		return markdownParse
	},
	get sanitise() {
		return sanitise
	},
	get cachedFetch() {
		return cachedFetch
	}
}