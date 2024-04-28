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
