import { LitElement, html, unsafeHTML } from "./lit.all.min.js"

class Spoiler extends HTMLElement {
	constructor() {
		super()
		this.addEventListener("click", () => {
			this.show()
		})
	}
	show() {
		this.removeAttribute("hidden")
	}
	static get observedAttributes() {
		return ["hidden"]
	}
}
customElements.define("r-spoiler", Spoiler)

class PostCopy extends HTMLElement {
	constructor() {
		super()
	}
	static get observedAttributes() {
		return ["href"]
	}
	async connectedCallback() {
		const clipbardSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		clipbardSvg.setAttribute("viewBox", "0 0 48 48")
		clipbardSvg.setAttribute("width", "30")
		clipbardSvg.setAttribute("height", "30")
		clipbardSvg.setAttribute("opacity", "0.6")
		clipbardSvg.innerHTML = "<path d=\"M9 43.95q-1.2 0-2.1-.9-.9-.9-.9-2.1V10.8h3v30.15h23.7v3Zm6-6q-1.2 0-2.1-.9-.9-.9-.9-2.1v-28q0-1.2.9-2.1.9-.9 2.1-.9h22q1.2 0 2.1.9.9.9.9 2.1v28q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h22v-28H15v28Zm0 0v-28 28Z\"/>"
		this.appendChild(clipbardSvg)
		const copyStatusSpan = document.createElement("span")
		copyStatusSpan.className = "copy-status"
		// TODO: Use CSS
		copyStatusSpan.style.opacity = 0
		copyStatusSpan.style.position = "absolute"
		copyStatusSpan.textContent = await translate("copiedToClipboard")
		this.appendChild(copyStatusSpan)

		this.addEventListener("click", (event) => {
			const source = this.getAttribute("href")
			event.stopPropagation()
			navigator.clipboard.writeText(source)
			copyStatusSpan.animate([
				{ opacity: 1 },
				{ scale: 1.1 }
			], { duration: 1000, iterations: 1, })
		})
	}
}
customElements.define("r-clipboard-copy", PostCopy)

class CloseIcon extends HTMLElement {
	constructor() {
		super()
	}

	connectedCallback() {
		this.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="active">
				<path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
			</svg>`
		this.tabIndex = 0
		this.addEventListener("keydown", function(event) {
			if (event.key == "Enter" || event.key == " ") {
				this.click()
			}
		})
	}
}
customElements.define("r-close-icon", CloseIcon)

class EmojiPanel extends LitElement {
	#onEmojiSelection = null

	constructor() {
		super()
	}

	connectedCallback() {
		super.connectedCallback()
		this.classList.add("context-menu")
	}

	set onemojiselection(handler) {
		if (this.#onEmojiSelection) {
			this.removeEventListener("emojiselection", this.#onEmojiSelection)
		}
		if (typeof handler === "function") {
			this.#onEmojiSelection = handler
			this.addEventListener("emojiselection", handler)
		}
	}

	get onemojiselection() {
		return this.#onEmojiSelection
	}

	// @ts-expect-error Remove shadow DOM by using element itself as the shadowroot
	createRenderRoot() {
		return this
	}	

	/**
	 * @param {Map<any, any>} changedProperties
	 */
	willUpdate(changedProperties) {
		if (changedProperties.has("class")) {
			this.classList.add("context-menu")
		}
	}

	render() {
		const values = []
		return html`
			<div class="emojis-header">
				<h3>Select an emoji:</h3>
				<r-close-icon @click=${this.#notifyClose}></r-close-icon>
			</div>
			<div class="emojis-body">
				<ul class="emojis-container">
					${EMOJIS.entries().map(([emojiKey, value]) => {
							let entry = null
							if (!values.includes(value)) {
								entry = html`<li title=${emojiKey}>
										<button type="button" @click=${() => this.#notifySelection(emojiKey, value)}>${value}</button>
									</li>`
							}
							values.push(value)
							return entry
						}
					)}
				</ul>
				<hr>
				<h4>Custom emojis:</h4>
				<ul class="emojis-container">
					${CUSTOM_EMOJIS.entries().map(([emojiKey, value]) =>
						html`<li title=${emojiKey}>
								<button type="button" @click=${() => this.#notifySelection(emojiKey, value)}>${unsafeHTML(value)}</button>
							</li>`
					)}
				</ul>
			</div>`
	}

	#notifyClose() {
		const event = new CustomEvent("close", {
			bubbles: true,
			composed: true
		})
		this.dispatchEvent(event)
	}

	#notifySelection(key, value) {
		const event = new CustomEvent("emojiselection", {
			detail: { key, value },
			bubbles: true,
			composed: true
		})
		this.dispatchEvent(event)
	}
}
customElements.define("r-emoji-panel", EmojiPanel)