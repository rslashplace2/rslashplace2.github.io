/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
function html(strings, ...values) {
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
        copyStatusSpan.textContent = translate("copiedToClipboard")
        this.appendChild(copyStatusSpan)

        this.addEventListener("click", (event) => {
            const source = this.getAttribute("src")
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
    static votedPath = "<path clip-rule=\"evenodd\" d=\"M8.44857 0.401443C8.3347 0.273284 8.17146 0.199951 8.00002 0.199951C7.82859 0.199951 7.66534 0.273284 7.55148 0.401443L0.351479 8.50544C0.194568 8.68206 0.155902 8.93431 0.252709 9.14981C0.349516 9.36532 0.563774 9.50395 0.800023 9.50395H4.20002V15C4.20002 15.3313 4.46865 15.6 4.80002 15.6H11.2C11.5314 15.6 11.8 15.3313 11.8 15V9.50395H15.2C15.4363 9.50395 15.6505 9.36532 15.7473 9.14981C15.8441 8.93431 15.8055 8.68206 15.6486 8.50544L8.44857 0.401443Z\" fill-rule=\"evenodd\"></path>"
    static unvotedPath = "<path clip-rule=\"evenodd\" d=\"m8 .200001c.17143 0 .33468.073332.44854.201491l7.19996 8.103998c.157.17662.1956.42887.0988.64437-.0968.21551-.3111.35414-.5473.35414h-3.4v5.496c0 .3314-.2686.6-.6.6h-6.4c-.33137 0-.6-.2686-.6-.6v-5.496h-3.4c-.236249 0-.450507-.13863-.547314-.35414-.096807-.2155-.058141-.46775.09877-.64437l7.200004-8.103998c.11386-.128159.27711-.201491.44854-.201491zm-5.86433 8.103999h2.66433c.33137 0 .6.26863.6.6v5.496h5.2v-5.496c0-.33137.2686-.6.6-.6h2.6643l-5.8643-6.60063\" fill-rule=\"evenodd\"></path>"
    #upSvg
    #voteCountEl
    #downSvg
    #voted = "none"
    #upvotes = null
    #downvotes = null

    constructor() {
        super()
        this.#upSvg = this.#createArrowSvg()
        this.#voteCountEl = document.createElement("div")
        this.#voteCountEl.textContent = this.votes
        this.#downSvg = this.#createArrowSvg()
        this.#downSvg.style.transform = "rotate(180deg)"
        
        // TODO: Implement
        this.#upSvg.onclick = function() {
            alert("You must be logged in to upvote a post!")
        }
        this.#downSvg.onclick = function() {
            alert("You must be logged in to downvote a post!")
        }
    }

    get votes() {
        return (this.#upvotes !== null && this.#downvotes !== null) ? this.#upvotes - this.#downvotes : "..."
    }
    set voted(value) {
        this.#voted = value
        this.#refresh()
    }
    get voted() {
        return this.#voted
    }
    set upvotes(value) {
        this.#upvotes = value
        this.#refresh()
    }
    get upvotes() {
        return this.#upvotes
    }
    set downvotes(value) {
        this.#downvotes = value
        this.#refresh()
    }
    get downvotes() {
        return this.#downvotes
    }
    static get observedAttributes() {
        return [ "upvotes", "downvotes", "voted" ]
    }

    #createArrowSvg() {
        const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        arrowSvg.innerHTML = RplaceVotes.unvotedPath
        arrowSvg.setAttribute("height", "24")
        arrowSvg.setAttribute("width", "24")
        arrowSvg.setAttribute("viewBox", "0 0 16 16")
        return arrowSvg
    }

    #refresh() {
        const upSelected = this.#voted === "up"
        const downSelected = this.#voted === "down"
    
        this.#upSvg.innerHTML = upSelected ? RplaceVotes.votedPath : RplaceVotes.unvotedPath
        this.#downSvg.innerHTML = downSelected ? RplaceVotes.votedPath : RplaceVotes.unvotedPath
    
        this.#upSvg.classList.toggle("voted", upSelected)
        this.#downSvg.classList.toggle("voted", downSelected)
    
        this.#voteCountEl.textContent = this.votes
    }

    connectedCallback() {
        this.appendChild(this.#upSvg)
        this.appendChild(this.#voteCountEl)
        this.appendChild(this.#downSvg)
        this.#refresh()
    }
}
customElements.define("r-votes", RplaceVotes)

const fuzzyNumberFormat = new Intl.NumberFormat(navigator.language, { notation: "compact" })
// TODO: Implement this in complex components like RplacePost to this to avoid getter/setter hell
function reactify(object) {
    const listeners = new Map()

    function notifyListeners(property, newValue, oldValue) {
        if (listeners.has(property)) {
            listeners.get(property).forEach(listener => listener(newValue, oldValue))
        }
    }

    const proxy = new Proxy(object, {
        set(target, property, value) {
            const oldValue = target[property]
            target[property] = value
            notifyListeners(property, value, oldValue)
            return true
        }
    })
    proxy.subscribe = function(property, listener) {
        if (!listeners.has(property)) {
            listeners.set(property, new Set())
        }
        listeners.get(property).add(listener)
    }
    proxy.unsubscribe = function(property, listener) {
        if (listeners.has(property)) {
            listeners.get(property).delete(listener)
        }
    }
    return proxy
}

class RplaceUserTooltip extends HTMLElement {
    #connectionSource
    #connected

    constructor() {
        super()
        this.#connected = false
        this.#connectionSource = new PublicPromise()
    }

    connectedCallback() {
        if (this.#connected) {
            return
        }
        this.innerHTML = html`
            <div class="user-tooltip-header">
                <img src="images/rplace.png" width="32">
                <h2 id="userName">...</h2>
            </div>
            <span id="userDate">...</span>
            <hr>
            <div class="user-tooltip-grid">
                <h1 id="userInfo1">?</h1>
                <h1 id="userInfo2">?</h1>
                <span id="userInfo1Description">...</span>
                <span id="userInfo2Description">...</span>
            </div>`
        this.#connectionSource.resolve()
        this.#connected = true
    }

    async fromAccount(profile) {
        await this.#connectionSource.promise
        this.querySelector("#userName").textContent = profile.chatName
        this.querySelector("#userDate").textContent = "Joined on " + new Date(profile.creationDate).toLocaleString()
        this.querySelector("#userInfo1").textContent = fuzzyNumberFormat.format(profile.pixelsPlaced)
        this.querySelector("#userInfo1Description").textContent = "Pixels placed"
        this.querySelector("#userInfo2").textContent = profile.badges.length
        this.querySelector("#userInfo2Description").textContent = "User badges"
    }

    async fromCanvasUser(canvasUser) {
        await this.#connectionSource.promise
        this.querySelector("#userName").textContent = canvasUser.chatName || "#" + canvasUser.userIntId
        this.querySelector("#userDate").textContent = "Last joined " + new Date(canvasUser.lastJoined).toLocaleString()
        this.querySelector("#userInfo1").textContent = fuzzyNumberFormat.format(canvasUser.pixelsPlaced)
        this.querySelector("#userInfo1Description").textContent = "Pixels placed"
        let playTime = canvasUser.playTimeSeconds
        let playTimeUnit = "Seconds played"
        if (playTime > 3600) {
            playTime /= 3600
            playTimeUnit = "Hours played"
        }
        if (playTime > 60) {
            playTime = Math.floor(playTime / 60)
            playTimeUnit = "Minutes played"
        }
        this.querySelector("#userInfo2").textContent = fuzzyNumberFormat.format(playTime)
        this.querySelector("#userInfo2Description").textContent = playTimeUnit
    }
}
customElements.define("r-user-tooltip", RplaceUserTooltip)

class RplaceCloseIcon extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.innerHTML = html`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="active">
                <path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
            </svg>`
        this.tabIndex = 0
        this.addEventListener("keydown", function(event) {
            if (event.key == "Enter" || event.key == " ") {
                this.click()
                console.log(this)
            }
        })
    }
}
customElements.define("r-close-icon", RplaceCloseIcon)


class RplacePostContents extends HTMLElement {
    #contentUrls
    #connectionSource
    #dialogEl
    #dialogImgEl
    #dialogReferenceEl
    #contentsAlbumEl

    constructor() {
        super()
        this.#connectionSource = new PublicPromise()
        this.#contentUrls = []
        const dialogEl = document.createElement("dialog")
        dialogEl.className = "reddit-modal"
        const dialogHeaderEl = document.createElement("div")
        dialogHeaderEl.className = "dialog-header"
        dialogEl.appendChild(dialogHeaderEl)
        const dialogTitleEl = document.createElement("h4")
        dialogTitleEl.textContent = "Viewing image "
        dialogHeaderEl.appendChild(dialogTitleEl)
        this.#dialogReferenceEl = document.createElement("a")
        dialogHeaderEl.appendChild(this.#dialogReferenceEl)
        const dialogCloseEl = document.createElement("r-close-icon")
        dialogCloseEl.onclick = function() {
            dialogEl.close()
        }
        dialogHeaderEl.appendChild(dialogCloseEl)
        dialogEl.appendChild(dialogHeaderEl)
        this.#dialogImgEl = document.createElement("img")
        dialogEl.appendChild(this.#dialogImgEl)
        this.#dialogEl = dialogEl

        this.#contentsAlbumEl = document.createElement("div")
    }

    static get observedAttributes() {
        return [ "contenturls" ]
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "images" && oldValue !== newValue) {
            this.contentUrls = JSON.parse(newValue)
            this.#refresh()
        }
    }

    set contentUrls(value) {
        this.#contentUrls = value
        this.#refresh()
    }
    get contentUrls() {
        return this.#contentUrls
    }

    connectedCallback() {
        this.appendChild(this.#dialogEl)
        this.appendChild(this.#contentsAlbumEl)
        this.#connectionSource.resolve()
        this.#refresh()
    }

    async #refresh() {
        await this.#connectionSource.promise
        const container = this.#contentsAlbumEl
        for (const imageEl of container.children) {
            container.removeChild(imageEl)
        }
        container.className = "contents-album"

        switch (this.#contentUrls.length) {
            case 1:
                container.style.gridTemplateColumns = "1fr"
                container.style.gridTemplateRows = "1fr"
                break
            case 2:
                container.style.gridTemplateColumns = "1fr 1fr"
                container.style.gridTemplateRows = "1fr"
                break
            case 3:
                container.style.gridTemplateColumns = "1fr 1fr"
                container.style.gridTemplateRows = "1fr 1fr"
                break
            case 4:
                container.style.gridTemplateColumns = "1fr 1fr"
                container.style.gridTemplateRows = "1fr 1fr"
                break
        }

        this.#contentUrls.forEach((contentUrl, index) => {
            const imageEl = document.createElement("img")
            imageEl.src = contentUrl
            if (this.#contentUrls.length === 3 && index === 2) {
                imageEl.style.gridColumn = "1 / span 2"
            }
            container.appendChild(imageEl)
            // TODO: Do with getter/setter
            const dialogReferenceEl = this.#dialogReferenceEl
            const dialogImgEl = this.#dialogImgEl
            const dialogEl = this.#dialogEl
            imageEl.onclick = function() {
                dialogReferenceEl.textContent = "(Download original)"
                dialogReferenceEl.href = contentUrl
                dialogImgEl.src = contentUrl
                dialogEl.showModal()
            }
        })
    }
}
customElements.define("r-post-contents", RplacePostContents)

class RplacePost extends HTMLElement {
    account
    canvasUser
    post
    #coverImageUrl
    #title
    #description
    #connectionSource
    #hidden
    #showAuthor
    #authorName
    #authorImageUrl
    #creationDate
    #showAuthorTooltip
    
    #authorImageEl
    #votesEl
    #coverImageEl
    #hiddenEl
    #showVotes
    #authorNameEl
    #authorNameSpanEl
    #authorTooltipEl
    #creationDateEl
    #authorContainerEl
    #contentsEl
    #showContents

    constructor() {
        super()
        this.#votesEl = document.createElement("r-votes")
        this.#coverImageEl = document.createElement("img")
        this.#coverImageEl.className = "cover-image"
        this.#hiddenEl = document.createElement("button")
        this.#hiddenEl.className = "hider"
        this.#hiddenEl.textContent = "Post contains sensitive content. Click to show"
        const _this = this
        this.#hiddenEl.onclick = function() {
            _this.hidden = false
        }

        this.#authorContainerEl = document.createElement("div")
        this.#authorContainerEl.className = "author-container"

        this.#authorImageEl = document.createElement("img")
        this.#authorImageEl.src = "images/rplace.png"
        this.#authorImageEl.className = "author-image"
        this.#authorImageEl.width = "28"
        this.#authorImageEl.height = "28"
        this.#authorContainerEl.appendChild(this.#authorImageEl)

        this.#authorNameEl = document.createElement("a")
        this.#authorNameEl.className = "author-name"
        this.#authorNameEl.href = ""
        this.#authorNameEl.onclick = function(e) {
            e.stopPropagation()
            e.preventDefault()
        }
        this.#authorNameEl.onmouseenter = function() {
            _this.showAuthorTooltip = true
        }
        this.#authorContainerEl.appendChild(this.#authorNameEl)

        this.#authorNameSpanEl = document.createElement("span")
        this.#authorNameEl.appendChild(this.#authorNameSpanEl)

        const authorTooltipEl = document.createElement("r-user-tooltip")
        authorTooltipEl.onmouseleave = function() {
            _this.showAuthorTooltip = false
        }
        this.#authorNameEl.onmouseleave = function() {
            setTimeout(() => {
                if (!authorTooltipEl.matches(":hover")) {
                    _this.showAuthorTooltip = false
                }
            }, 200)
        }
        this.#authorTooltipEl = authorTooltipEl
        
        const authorSeparator = document.createElement("span")
        authorSeparator.textContent = "·"
        this.#authorContainerEl.appendChild(authorSeparator)

        this.#creationDateEl = document.createElement("span")
        this.#creationDateEl.className = "creation-date"
        this.#authorContainerEl.appendChild(this.#creationDateEl)

        this.#contentsEl = document.createElement("r-post-contents")
        this.#showContents = false
        this.#connectionSource = new PublicPromise()
    }

    set showAuthorTooltip(value) {
        this.#showAuthorTooltip = value
        this.#onShowAuthorTooltipChanged()
    }
    get showAuthorTooltip() {
        return this.#showAuthorTooltip
    }
    async #onShowAuthorTooltipChanged() {
        if (this.#showAuthorTooltip) {
            if (!this.#authorNameEl.contains(this.#authorTooltipEl)) {
                this.#authorNameEl.appendChild(this.#authorTooltipEl)
            }
        }
        else if (this.#authorNameEl.contains(this.#authorTooltipEl)) {
            this.#authorNameEl.removeChild(this.#authorTooltipEl)
        }
    }

    set creationDate(value) {
        this.#creationDate = value
        this.#onCreationDateChanged()
    }
    get creationDate() {
        return this.#creationDate
    }
    async #onCreationDateChanged() {
        await this.#connectionSource.promise
        this.#creationDateEl.textContent = this.#creationDate.toLocaleString()
    }

    set authorName(value) {
        this.#authorName = value
        this.#onAuthorNameChanged()
    }
    get authorName() {
        return this.#authorName
    }
    async #onAuthorNameChanged() {
        await this.#connectionSource.promise
        this.#authorNameSpanEl.textContent = "Posted by " + this.#authorName
    }

    set authorImageUrl(value) {
        this.#authorImageUrl = value
        this.#onAuthorImageUrlChanged()
    }
    get authorImageUrl() {
        return this.#authorImageUrl
    }
    async #onAuthorImageUrlChanged() {
        await this.#connectionSource.promise
        this.#authorImageEl.src = this.#authorImageUrl || "images/rplace.png"
    }

    set showAuthor(value) {
        this.#showAuthor = value
        this.#onShowAuthorChanged()
    }
    get showAuthor() {
        return this.#showAuthor
    }
    async #onShowAuthorChanged() {
        await this.#connectionSource.promise
        const header = this.querySelector("#header")
        if (this.#showAuthor) {
            if (!header.contains(this.#authorContainerEl)) {
                header.prepend(this.#authorContainerEl)
            }
        }
        else if (header.contains(this.#authorContainerEl)) {
            header.removeChild(this.#authorContainerEl)
        }
    }

    set hidden(value) {
        this.#hidden = value
        this.#onHiddenChanged()
    }
    get hidden() {
        return this.#hidden
    }
    async #onHiddenChanged() {
        await this.#connectionSource.promise
        if (this.#hidden) {
            if (!this.contains(this.#hiddenEl)) {
                this.appendChild(this.#hiddenEl)
            }
        }
        else if (this.contains(this.#hiddenEl)) {
            this.removeChild(this.#hiddenEl)
        }
    }

    set coverImageUrl(value) {
        this.#coverImageUrl = value
        this.#onCoverImageUrlChanged()
    }
    get coverImageUrl() {
        return this.#coverImageUrl
    }
    async #onCoverImageUrlChanged() {
        await this.#connectionSource.promise
        if (this.#coverImageUrl) {
            if (!this.contains(this.#coverImageEl)) {
                this.insertBefore(this.#coverImageEl, this.querySelector("#body"))
            }
            this.#coverImageEl.src = this.#coverImageUrl
        }
        else if (this.contains(this.#coverImageEl)) {
            this.removeChild(this.#coverImageEl)
        }
    }

    set showVotes(value) {
        this.#showVotes = value
        this.#onShowVotesChanged()
    }
    get showVotes() {
        return this.#showVotes
    }
    async #onShowVotesChanged() {
        await this.#connectionSource.promise
        if (this.#showVotes) {
            if (!this.contains(this.#votesEl)) {
                this.prepend(this.#votesEl)
            }
        }
        else if (this.contains(this.#votesEl)) {
            this.removeChild(this.#votesEl)
        }
    }

    set title(value) {
        this.#title = value
        this.#onTitleChanged()
    }
    get title() {
        return this.#title
    }
    async #onTitleChanged() {
        await this.#connectionSource.promise
        this.querySelector("#title").textContent = this.#title
    }

    set description(value) {
        this.#description = value
        this.#onDescriptionChanged()
    }
    get description() {
        return this.#description
    }
    async #onDescriptionChanged() {
        await this.#connectionSource.promise
        let descriptionText = this.#description
        descriptionText = sanitise(descriptionText)
        descriptionText = markdownParse(descriptionText)
        this.querySelector("#description").innerHTML = descriptionText
    }

    set showContents(value) {
        this.#showContents = value
        this.#onShowContentsChanged()
    }
    get showContents() {
        return this.#showContents
    }
    async #onShowContentsChanged() {
        await this.#connectionSource.promise
        const main = this.querySelector("#main")
        if (this.#showContents) {
            if (!main.contains(this.#contentsEl)) {
                main.append(this.#contentsEl)
            }
        }
        else if (main.contains(this.#contentsEl)) {
            main.removeChild(this.#contentsEl)
        }
    }

    static get observedAttributes() {
        return [ "title", "description", "novotes", "coverimageurl", "hidden" ]
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        await this.#connectionSource.promise
        if (newValue == oldValue) {
            return
        }
        if (name == "title") {
            this.title = newValue
        }
        else if (name == "description") {
            this.description = newValue
        }
        else if (name == "novotes") {
            this.showVotes = newValue === "false"
        }
        else if (name == "coverimageurl") {
            this.coverImageUrl = newValue
        }
        else if (name == "hidden") {
            this.hidden = true
        }
    }

    connectedCallback() {
        this.innerHTML = html`
            <div id="body" class="body">
                <div id="header" class="header">
                </div>
                <div id="main" class="main">
                    <div id="title" class="title"></div>
                    <p id="description" class="description"></p>
                </div>
            </div>`
        this.#connectionSource.resolve()
        this.showVotes = true
        this.coverImageUrl = null
    }

    async fromPost(fromPost) {
        this.post = fromPost
        this.title = fromPost.title
        this.description = fromPost.description
        this.#votesEl.upvotes = fromPost.upvotes
        this.#votesEl.downvotes = fromPost.downvotes
        if (fromPost.accountId) {
            const res = await fetch(`${localStorage.auth || DEFAULT_AUTH}/profiles/${fromPost.accountId}`)
            if (!res.ok) {
                console.error(`Could not load account profile ${res.status} ${res.statusText}:`, await res.json())
                return
            }
            const profileObject = await res.json()
            this.account = profileObject
            this.authorName = profileObject.username
            this.authorImageUrl = "images/rplace.png"
            this.#authorTooltipEl.fromAccount(profileObject)
            this.showAuthor = true
        }
        else if (fromPost.canvasUserId) {
            const res = await fetch(`${localStorage.auth || DEFAULT_AUTH}/instances/users/${fromPost.canvasUserId}`)
            const canvasUserObject = await res.json()
            this.canvasUser = canvasUserObject
            this.authorName = canvasUserObject.chatName || "#" + canvasUserObject.userIntId
            this.authorImageUrl = "images/rplace.png"
            this.#authorTooltipEl.fromCanvasUser(canvasUserObject)
            this.showAuthor = true
        }
        this.creationDate = new Date(fromPost.creationDate)
        const contentUrls = []
        for (const content of fromPost.contents) {
            contentUrls.push(`${localStorage.auth || DEFAULT_AUTH}/posts/contents/${content.id}`)
        }
        if (contentUrls.length > 0) {
            this.#contentsEl.contentUrls = contentUrls
            this.showContents = true
        }
    }
}
customElements.define("r-post", RplacePost)

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
        this.#deleteButton.innerHTML = html`
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

class CreatePostContentsPreview extends HTMLElement {
    contents
    maxContents
    #uploadLabel
    #elementItems
    #contentsContainer

    constructor() {
        super()
        this.maxContents = 4
        this.#elementItems = new Map()
        this.contents = new Set()
        this.#uploadLabel = document.createElement("span")
        this.#uploadLabel.textContent = "Content upload:"
        this.#contentsContainer = document.createElement("div")
    }

    addContent(file) {
        if (this.contents.size >= this.maxContents) {
            return
        }
        this.contents.add(file)
        if (this.#elementItems.size == 0) {
            this.insertBefore(this.#uploadLabel, this.#contentsContainer)
            this.style.height = "72px"
        }
        const itemEl = document.createElement("r-create-post-content")
        this.#contentsContainer.appendChild(itemEl)
        itemEl.setFile(file)
        const _this = this
        itemEl.ondelete = function(e) {
            _this.deleteContent(e.target.file)
        }
        this.#elementItems.set(file, itemEl)
    }

    deleteContent(file) {
        if (!this.contents.delete(file)) {
            return
        }

        if (this.#elementItems.size == 1) {
            this.style.height = "36px"
            this.removeChild(this.#uploadLabel)
        }
        const itemEl = this.#elementItems.get(file)
        if (itemEl) {
            this.#contentsContainer.removeChild(itemEl)
            this.#elementItems.delete(file)
        }
    }

    clearContents() {
        this.contents.clear()
        this.#elementItems.clear()
        for (const item of this.#contentsContainer.children) {
            this.#contentsContainer.removeChild(item)    
        }
    }

    connectedCallback() {
        this.appendChild(this.#contentsContainer)
    }
}
customElements.define("r-post-contents-preview", CreatePostContentsPreview)