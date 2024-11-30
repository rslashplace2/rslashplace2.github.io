import { LitElement, html, styleMap, unsafeHTML } from "./lit.all.min.js"
// @ts-expect-error Hack to access window globals from module script
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var { cMessages, currentChannel, chatMessages, x, y, pos, chatMentionUser, onChatContext, chatReply, chatReport, chatModerate, CHAT_COLOURS, hash, chatReact, EMOJIS, CUSTOM_EMOJIS, intIdNames } = window.moduleExports

class LiveChatMessage extends LitElement {
	static properties = {
		messageId: { type: Number, reflect: true, attribute: "messageid" },
		senderId: { type: String, reflect: true, attribute: "senderid" },
		name: { type: String, reflect: true, attribute: "name" },
		sendDate: { type: Number, reflect: true, attribute: "senddate" },
		repliesTo: { type: Number, reflect: true, attribute: "repliesto" },
		content: { type: String, reflect: true, attribute: "content" },
		reactions: { type: Object, attribute: false },
		showReactionsPanel: { type: Boolean, attribute: false },
		openedReactionDetails: { type: String, attribute: false },
		class: { reflect: true }
	}
	
	constructor() {
		super()
		this.messageId = null
		this.senderId = null
		this.name = null
		this.sendDate = null
		/** @type {LiveChatMessage|null} */ this.repliesTo = null
		this.content = null
		/** @type {Map<string, Set<number>>|null} */ this.reactions = null
		this.replyingMessage = null
		this.showReactionsPanel = false
		this.openedReactionDetails = ""
		this.addEventListener("contextmenu", this.#handleContextMenu)
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
	fromMessage(data) {
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
			this.replyingMessage = this.#findReplyingMessage()
		}
		if (changedProperties.has("class")) {
			this.classList.add("message")
		}
	}

	/**
	 * @param {string} txt
	 * @returns {string}
	 */
	#formatMessage(txt) {
		if (!txt) return ""
		
		let formatted = sanitise(txt)
		formatted = markdownParse(formatted)
		
		// Handle emojis
		formatted = formatted.replaceAll(/:([a-z-_]{0,16}):/g, (full, source) => {
			const isLargeEmoji = formatted.match(new RegExp(source)).length === 1 &&
			!formatted.replace(full, "").trim()
			const size = isLargeEmoji ? "48" : "16"
			return html`<img src="custom_emojis/${source}.png" alt=":${source}:" title=":${source}:" width="${size}" height="${size}">`
		})
	
		// Handle coordinates
		formatted = formatted.replaceAll(/([0-9]+),\s*([0-9]+)/g, (match, px, py) => {
			px = parseInt(px.trim())
			py = parseInt(py.trim())
			if (!isNaN(px) && !isNaN(py)) {
				return html`<a href="#" @click=${(e) => this.#handleCoordinateClick(e, px, py)}>${px},${py}</a>`
			}
			return match
		})
		
		return formatted
	}
	
	#findReplyingMessage() {
		if (!cMessages.has(currentChannel)) {
			return { name: "[ERROR]", content: "Channel not found", fake: true }
		}
		
		const message = cMessages[currentChannel].find(msg => msg.messageId === this.repliesTo)
		return message || {
			name: "[?????]",
			content: translate("messageNotFound"),
			fake: true
		}
	}
	
	#scrollToReply() {
		if (!this.replyingMessage || this.replyingMessage.fake || !chatMessages) {
			return
		}

		this.replyingMessage.setAttribute("highlight", "true")
		setTimeout(() => this.replyingMessage.removeAttribute("highlight"), 500)
		this.replyingMessage.scrollIntoView({ behavior: "smooth", block: "nearest" })
	}
	
	/**
	 * 
	 * @param {MouseEvent} e
	 * @param {number} newX 
	 * @param {number} newY 
	 */
	#handleCoordinateClick(e, newX, newY) {
		e.preventDefault()
		x = newX
		y = newY
		pos()
	}
	
	#handleNameClick() {
		if (this.messageId > 0) {
			chatMentionUser(this.senderId)
		}
	}
	
	#handleContextMenu(e) {
		e.preventDefault()
		if (this.messageId > 0) {
			onChatContext(e, this.senderId, this.messageId)
		}
	}
	
	#handleReply() {
		chatReply(this.messageId, this.senderId)
	}
	
	#handleReport() {
		chatReport(this.messageId, this.senderId)
	}
	
	#handleModerate() {
		chatModerate("delete", this.senderId, this.messageId, this)
	}

	#handleReact(e) {
		const { key } = e.detail
		chatReact(this.messageId, key)
	}
	
	#renderName() {
		const nameStyle = {
			color: this.messageId === 0 ? undefined : CHAT_COLOURS[hash("" + this.senderId) & 7]
		}
		
		return html`
			<span 
				class="name ${this.messageId === 0 ? "rainbow-glow" : ""}" style=${styleMap(nameStyle)}
				title=${new Date(this.sendDate * 1000).toLocaleString()}
				@click=${this.#handleNameClick}>[${this.name || ("#" + this.senderId)}]</span>`
	}
	
	#renderReply() {
		if (!this.repliesTo || !this.replyingMessage) {
			return null
		}
		
		return html`
			<p class="reply" @click=${this.#scrollToReply}>
				↪️ ${this.replyingMessage.name} ${this.replyingMessage.content}
			</p>`
	}
	
	#renderActions() {
		if (this.messageId <= 0) {
			return null
		}
		
		return html`
			<div class="actions">
				<img class="action-button" src="svg/reply-action.svg"
					title=${translate("replyTo")} tabindex="0" @click=${this.#handleReply}>
				<img class="action-button" src="svg/react-action.svg"
					title=${translate("addReaction")} tabindex="0" @click=${() => this.showReactionsPanel = true}>
				<img class="action-button" src="svg/report-action.svg"
					title=${translate("report")} tabindex="0" @click=${this.#handleReport}>
				${localStorage.vip?.startsWith("!") ? html`
					<img class="action-button" src="svg/moderate-action.svg"
						title=${translate("Moderation options")} tabindex="0" @click=${this.#handleModerate}>
				` : null}
			</div>
			${this.showReactionsPanel
				? html`<r-emoji-panel @selectionchanged=${this.#handleReact} @close=${() => this.showReactionsPanel = false}
					@mouseleave=${() => this.showReactionsPanel = false}></r-emoji-panel>`
				: null}`
	}

	#renderReactions() {
		if (this.reactions == null) {
			return null
		}

		return html`
			<ul class="reactions">
				${this.reactions.entries().map(([emojiKey, reactors]) => {
					let emojiEl = null
					if (EMOJIS.has(emojiKey)) {
						emojiEl = html`<span class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}">${EMOJIS.get(emojiKey)}</span>`
					}
					else if (CUSTOM_EMOJIS.has(emojiKey)) {
						emojiEl = html`<img src="custom_emojis/${emojiKey}.png" class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}" alt=":${emojiKey}:" title=":${emojiKey}:" width="18" height="18">`
					}
					if (!emojiEl) {
						return null
					}
					return html`
						<li class="reaction ${this.openedReactionDetails == emojiKey ? "expanded" : ""}">
							<details class="reaction-details" ?open=${this.openedReactionDetails === emojiKey} @toggle=${(e) => {
								if (e.target.open) {
									this.openedReactionDetails = emojiKey
								}
								else if (this.openedReactionDetails === emojiKey) {
									this.openedReactionDetails = ""
								}
							}}>
								<summary>
									<div class="emoji-container">
										${emojiEl}
										${this.openedReactionDetails == emojiKey ? html`<p>:${emojiKey}:</p>` : null}
									</div>
								</summary>
								<div class="reaction-body">
									<hr>
									<h3>Added by:</h3>
									<ul class="reactors">
										${reactors.entries().map(([reactorId]) => html`
											<li class="reactor" title=${"User ID: #" + reactorId}>
												${intIdNames.has(reactorId)
													? intIdNames.get(reactorId)
													: "#" + reactorId}
											</li>`)}
									</ul>
								</div>
							</details>
						</li>`
				})}
			</ul>
		`
	}
		
	render() {
		return html`
			${this.#renderReply()}
			${this.#renderName()}
			<span>${unsafeHTML(this.#formatMessage(this.content))}</span>
			${this.#renderReactions()}
			${this.#renderActions()}`
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