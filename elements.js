/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
function html(strings, ...values) {
    return strings.reduce((result, string, i) => {
        const value = values[i] !== undefined ? values[i] : ""
        return result + string + value
    }, "")
}
function css(strings, ...values) {
    return strings.reduce((result, string, i) => {
        const value = values[i] !== undefined ? values[i] : ""
        return result + string + value
    }, "")
}

class RplaceSpoiler extends HTMLElement {
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
customElements.define("r-spoiler", RplaceSpoiler)

class RplacePostCopy extends HTMLElement {
    constructor() {
        super()
    }
    static get observedAttributes() {
        return ["src"]
    }
    connectedCallback() {
        const clipbardSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        clipbardSvg.innerHTML = html`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="30" height="30" opacity="0.6">
                <path d="M9 43.95q-1.2 0-2.1-.9-.9-.9-.9-2.1V10.8h3v30.15h23.7v3Zm6-6q-1.2 0-2.1-.9-.9-.9-.9-2.1v-28q0-1.2.9-2.1.9-.9 2.1-.9h22q1.2 0 2.1.9.9.9.9 2.1v28q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h22v-28H15v28Zm0 0v-28 28Z"/>
            </svg>
        `
        this.appendChild(clipbardSvg)
        const copyStatusSpan = document.createElement("span")
        copyStatusSpan.style.opacity = 0
        copyStatusSpan.textContent = translate("copiedToClipboard")
        this.appendChild(copyStatusSpan)

        this.addEventListener("click", (event) => {
            const source = this.getAnimations("src")
            event.stopPropagation()
            navigator.clipboard.writeText(source)
            copyStatusSpan.animate([
                { opacity: 1 },
                { scale: 1.1 }
            ], { duration: 1000, iterations: 1, })
        })
    }
}
customElements.define("r-clipboard-copy", RplacePostCopy)

class RplaceVotes extends HTMLElement {
    static votedSvg = html`
        <svg height="24" viewBox="0 0 16 16" width="24" xmlns="http://www.w3.org/2000/svg" style="fill: #ff4500;">
            <path clip-rule="evenodd" d="M8.44857 0.401443C8.3347 0.273284 8.17146 0.199951 8.00002 0.199951C7.82859 0.199951 7.66534 0.273284 7.55148 0.401443L0.351479 8.50544C0.194568 8.68206 0.155902 8.93431 0.252709 9.14981C0.349516 9.36532 0.563774 9.50395 0.800023 9.50395H4.20002V15C4.20002 15.3313 4.46865 15.6 4.80002 15.6H11.2C11.5314 15.6 11.8 15.3313 11.8 15V9.50395H15.2C15.4363 9.50395 15.6505 9.36532 15.7473 9.14981C15.8441 8.93431 15.8055 8.68206 15.6486 8.50544L8.44857 0.401443Z" fill-rule="evenodd"></path>
        </svg>
        `
    static unvotedSvg = html`
        <svg height="24" viewBox="0 0 16 16" width="24" xmlns="http://www.w3.org/2000/svg">
            <path clip-rule="evenodd" d="m8 .200001c.17143 0 .33468.073332.44854.201491l7.19996 8.103998c.157.17662.1956.42887.0988.64437-.0968.21551-.3111.35414-.5473.35414h-3.4v5.496c0 .3314-.2686.6-.6.6h-6.4c-.33137 0-.6-.2686-.6-.6v-5.496h-3.4c-.236249 0-.450507-.13863-.547314-.35414-.096807-.2155-.058141-.46775.09877-.64437l7.200004-8.103998c.11386-.128159.27711-.201491.44854-.201491zm-5.86433 8.103999h2.66433c.33137 0 .6.26863.6.6v5.496h5.2v-5.496c0-.33137.2686-.6.6-.6h2.6643l-5.8643-6.60063" fill-rule="evenodd"></path>
        </svg>
        `
    #voted = "none"
    #votes = 0

    constructor() {
        super()
    }
    set voted(value) {
        this.#voted = value
        this.#refresh()
    }
    set votes(value) {
        this.#votes = value
        this.#refresh()
    }

    static get observedAttributes() {
        return [ "votes", "voted" ]
    }

    attributeChangedCallback() {
        this.#refresh()
    }
    
    #refresh() {
        this.upSvg.innerHTML = RplaceVotes.unvotedSvg
        this.downSvg.innerHTML = RplaceVotes.unvotedSvg
        if (this.#voted == "up") {
            this.upSvg.innerHTML = RplaceVotes.votedSvg
        }
        else if (this.#voted == "down") {
            this.downSvg.innerHTML = RplaceVotes.votedSvg
        }
        this.voteCount.textContent = this.#votes ?? "..."
    }

    connectedCallback() {
        this.upSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        this.upSvg.innerHTML = RplaceVotes.unvotedSvg
        this.appendChild(this.upSvg)
        this.voteCount = document.createElement("div")
        this.voteCount.textContent = this.#votes || "..."
        this.appendChild(this.voteCount)
        this.downSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        this.downSvg.style.transform = "rotate(180deg);"
        this.downSvg.innerHTML = RplaceVotes.unvotedSvg
        this.appendChild(this.downSvg)
        this.#refresh()
    }
}
customElements.define("r-votes", RplaceVotes)

class RplacePost extends HTMLElement {
    constructor() {
        super()
    }
    static get observedAttributes() {
        return [ "title", "description" ]
    }
    connectedCallback() {
        this.innerHTML = html`
            <div class="post">
                <r-votes onclick="event.stopPropagation()"></r-votes>
                <div class="body">
                    <div class="header">
                        <img src="images/rplace.png">
                        <div>
                            <div>Main Canvas</div>
                            <span>1000x1000 (cooldown: 3.5s)</span>
                            <r-clipboard-copy src="https:\/\/rplace.live/?server=wss:\/\/server.rplace.live:443&amp;board=https:\/\/raw.githubusercontent.com/rplacetk/canvas1/main/place" title="Copy canvas link"></r-clipboard-copy>
                        </div>
                    </div>
                </div>
            </div>
        `
    }
}
customElements.define("r-post", RplacePost)

class RplaceCloseIcon extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.innerHTML = html`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="active">
                <path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
            </svg>`
    }
}
customElements.define("r-close-icon", RplaceCloseIcon)