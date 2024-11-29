import { LitElement, html, css, styleMap } from "./lit.all.min.js"
// @ts-expect-error Hack to access window globals from module script
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var { cMessages, currentChannel, chatMessages, x, y, pos, chatMentionUser, onChatContext, chatReply, chatReport, chatModerate, CHAT_COLOURS, hash } = window.moduleExports

class LiveChatMessage extends LitElement {
	static properties = {
		messageId: { type: Number, reflect: true, attribute: "messageid" },
		senderId: { type: String, reflect: true, attribute: "senderid" },
		name: { type: String, reflect: true, attribute: "name" },
		sendDate: { type: Number, reflect: true, attribute: "senddate" },
		repliesTo: { type: Number, reflect: true, attribute: "repliesto" },
		content: { type: String, reflect: true, attribute: "content" },
		class: { reflect: true }
	}
	
	constructor() {
		super()
		this.messageId = null
		this.senderId = null
		this.name = null
		this.sendDate = null
		this.repliesTo = null
		this.content = null
		this.reactions = null
		this.replyingMessage = null
	}

	connectedCallback() {
		super.connectedCallback()
		this.classList.add("message")
	}

	// @ts-expect-error Remove shadow DOM by using element itself as the shadowroot
	createRenderRoot() {
		return this
	}

	/**
	 * @param {{ messageId: any; txt: any; senderId: any; name: any; sendDate: any; repliesTo?: null | undefined; }} data
	 */
	setMessageData(data) {
		const { messageId, txt, senderId, name, sendDate, repliesTo = null } = data
		this.messageId = messageId
		this.senderId = senderId
		this.name = name
		this.sendDate = sendDate
		this.repliesTo = repliesTo
		this.content = txt
	}

	/**
	 * @param {Map<any, any>} changedProperties
	 */
	willUpdate(changedProperties) {
		if (changedProperties.has("repliesTo") && this.repliesTo !== null) {
			this.replyingMessage = this.findReplyingMessage()
		}
		if (changedProperties.has("class")) {
			this.classList.add("message")
		}
	}

	/**
	 * @param {string} txt
	 * @returns {string}
	 */
	formatMessage(txt) {
		if (!txt) return ""
		
		let formatted = sanitise(txt)
		formatted = markdownParse(formatted)
		
		// Handle emojis
		formatted = formatted.replaceAll(/:([a-z-_]{0,16}):/g, (full, source) => {
			const isLargeEmoji = formatted.match(new RegExp(source)).length === 1 &&
			!formatted.replace(full, "").trim()
			const size = isLargeEmoji ? "48" : "16"
			return `<img src="custom_emojis/${source}.png" alt=":${source}:" title=":${source}:" width="${size}" height="${size}">`
		})
		
		// Handle coordinates
		formatted = formatted.replaceAll(/([0-9]+),\s*([0-9]+)/g, (match, px, py) => {
			px = parseInt(px.trim())
			py = parseInt(py.trim())
			if (!isNaN(px) && !isNaN(py)) {
				return `<a href="#" @click=${(e) => this.handleCoordinateClick(e, px, py)}>${px},${py}</a>`
			}
			return match
		})
		
		return formatted
	}
	
	findReplyingMessage() {
		if (!cMessages[currentChannel]) {
			return { name: "[ERROR]", originalContent: "Channel not found", fake: true }
		}
		
		const message = cMessages[currentChannel].find(msg => msg.messageId === this.repliesTo)
		return message || {
			name: "[?????]",
			originalContent: translate("messageNotFound"),
			fake: true
		}
	}
	
	scrollToReply() {
		if (!this.replyingMessage || this.replyingMessage.fake || !chatMessages) {
			return
		}
		
		const height = Array.from(cMessages[currentChannel])
		.slice(0, cMessages[currentChannel].indexOf(this.replyingMessage))
		.reduce((sum, msg) => sum + msg.offsetHeight, 0)
		
		this.replyingMessage.setAttribute("highlight", "true")
		setTimeout(() => this.replyingMessage.removeAttribute("highlight"), 500)
		
		chatMessages.scroll({
			top: height,
			left: 0,
			behavior: "smooth"
		})
	}
	
	/**
	 * 
	 * @param {MouseEvent} e
	 * @param {number} newX 
	 * @param {number} newY 
	 */
	handleCoordinateClick(e, newX, newY) {
		e.preventDefault()
		x = newX
		y = newY
		pos()
	}
	
	handleNameClick() {
		if (this.messageId > 0) {
			chatMentionUser(this.senderId)
		}
	}
	
	handleContextMenu(e) {
		if (this.messageId > 0) {
			onChatContext(e, this.senderId, this.messageId)
		}
	}
	
	handleReply() {
		chatReply(this.messageId, this.senderId)
	}
	
	handleReport() {
		chatReport(this.messageId, this.senderId)
	}
	
	handleModerate() {
		chatModerate("delete", this.senderId, this.messageId, this)
	}
	
	renderName() {
		const nameStyle = {
			color: this.messageId === 0 ? undefined : CHAT_COLOURS[hash("" + this.senderId) & 7]
		}
		
		return html`
			<span 
				class="name ${this.messageId === 0 ? "rainbow-glow" : ''}" style=${styleMap(nameStyle)}
				title=${new Date(this.sendDate * 1000).toLocaleString()}
				@click=${this.handleNameClick}>[${this.name || ("#" + this.senderId)}]</span>
		`
	}
	
	renderReply() {
		if (!this.repliesTo || !this.replyingMessage) {
			return null
		}
		
		return html`
			<p class="reply" @click=${() => this.scrollToReply()}>
			↪️ ${this.replyingMessage.name} ${this.replyingMessage.originalContent}
			</p>
		`
	}
	
	renderActions() {
		if (this.messageId <= 0) {
			return null
		}
		
		return html`
			<div class="actions">
				<img class="action-button" src="svg/reply-action.svg"
					title=${translate("replyTo")} tabindex="0" @click=${this.handleReply}>
				<img class="action-button" src="svg/report-action.svg"
					title=${translate("report")} tabindex="0" @click=${this.handleReport}>
				<img class="action-button" src="svg/react-action.svg"
					title=${translate("react")} tabindex="0" @click=${this.handleReact}>
				${localStorage.vip?.startsWith("!") ? html`
					<img class="action-button" src="svg/moderate-action.svg"
						title=${translate("Moderation options")} tabindex="0" @click=${this.handleModerate}>
				` : null}
			</div>
		`
	}
		
	render() {
		return html`
			${this.renderReply()}
			${this.renderName()}
			<span .innerHTML=${this.formatMessage(this.content)}></span>
			${this.renderActions()}
		`
	}
}
customElements.define("r-live-chat-message", LiveChatMessage)

class CreatePostContent extends HTMLElement {
	#fileThumbnail
	#deleteButton
	#deleteEvent
	#ondelete

	constructor() {
		super()
		this.file = null
		this.#deleteEvent = new Event("delete")
		this.ondelete = null
		const _this = this
		this.#fileThumbnail = document.createElement("img")
		this.#deleteButton = document.createElement("button")
		this.#deleteButton.onclick = function() {
			_this.dispatchEvent(_this.#deleteEvent)
		}
		this.#deleteButton.innerHTML = `
			<svg viewBox="0 0 20 20" style="fill: white;" xmlns="http://www.w3.org/2000/svg" height="16">
				<path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
			</svg>`
	}

	get ondelete() {
		return this.#ondelete
	}

	set ondelete(value) {
		if (this.#ondelete) {
			this.removeEventListener("delete", this.#ondelete)
		}
		this.addEventListener("delete", value)
		this.#ondelete = value
	}

	connectedCallback() {
		this.appendChild(this.#fileThumbnail)
		this.appendChild(this.#deleteButton)
	}

	setFile(fileObject) {
		this.file = fileObject
		this.#fileThumbnail.src = window.URL.createObjectURL(this.file)
	}
}
customElements.define("r-create-post-content", CreatePostContent)