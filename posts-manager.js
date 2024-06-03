/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
// This script runs on posts.html
/** Like PublicPromise, but limits to only one task being able to await it */
class PublicPromiseSingle {
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

class PostElArray {
    items
    constructor() {
        this.items = []
    }

    orderedInsert(postEl, comparisonFn) {
        let insertIndex = this.items.findIndex(existingItem => existingItem.post.id === postEl.post?.id)
        if (insertIndex >= 0) {
            this.items[insertIndex] = postEl
        }
        else {
            insertIndex = this.items.findIndex(existingItem => comparisonFn(postEl, existingItem) < 0)
            if (insertIndex === -1) {
                this.items.push(postEl)
                insertIndex = this.items.length - 1
            }
            else {
                this.items.splice(insertIndex, 0, postEl)
            }
        }
        return insertIndex
    }

    delete(postEl) {
      this.items = this.items.filter(existingItem => existingItem.post.id !== postEl.post?.id)
    }

    includes(postEl) {
      return this.items.some(existingItem => existingItem.post.id === postEl.post?.id)
    }

    getById(id) {
        return this.items.find(postEl => postEl.post?.id === id)
    }

    clear() {
        this.items.length = 0
    }
}

let topUpvotes = 0
let topDate = new Date(0)
let bottomUpvotes = 0xFFFFFFFF
let bottomDate = new Date()

const postEls = new PostElArray()
const contentsBaseLength = contents.childNodes.length
const postLimit = 16
const postLoadCooldown = 1000
let postFinishedLastLoad = null
let filter = postsSortSelect.value // "upvotes" | "date" 
let hideSensitive = !!postsHideSensitive.checked

function insertElementAtIndex(parentElement, newElement, index) {
    const referenceElement = parentElement.childNodes[index]
    if (referenceElement) {
        parentElement.insertBefore(newElement, referenceElement)
    }
    else {
        parentElement.appendChild(newElement)
    }
}

async function finishPostLoadWithCd() {
    await new Promise(resolve => setTimeout(resolve, postLoadCooldown))
    postFinishedLastLoad.resolve()
}
async function tryLoadPosts(queryName, queryValue) {
    if (postFinishedLastLoad !== null) {
        if (postFinishedLastLoad.locked) {
            return false
        }    
        await postFinishedLastLoad.acquireAwaitPromise()
    }
    postFinishedLastLoad = new PublicPromiseSingle()

    const postsUrl = `${localStorage.auth || DEFAULT_AUTH}/posts/?${queryName}=${
        queryValue}&limit=${postLimit}`
    const res = await fetch(postsUrl)
    if (!res.ok) {
        console.error(`Failed to load top posts, status ${res.status} ${res.statusText}:`, await res.json())
        await finishPostLoadWithCd()
        return false
    }
    const postsObject = await res.json()
    for (const post of postsObject.posts) {
        if (postEls.includes(post)) {
            // Update the post with new data
            const postEl = postEls.getById(post.id)
            postEl.fromPost(post)
        }
        else {
            const postEl = document.createElement("r-post")
            postEl.fromPost(post)
            if (hideSensitive && post.hasSensitiveContent) {
                postEl.hidden = true
            }
            const postDate = new Date(post.creationDate)
            let comparisonFn = null
            switch (queryName) {
                case "beforeDate": {
                    comparisonFn = (a, b) => new Date(b.post.creationDate) - new Date(a.post.creationDate)
                    if (postDate < bottomDate) {
                        bottomDate = postDate
                    }
                    break
                }
                case "sinceDate": {
                    comparisonFn = (a, b) => new Date(a.post.creationDate) - new Date(b.post.creationDate)
                    if (postDate > topDate) {
                        topDate = postDate
                    }
                    break
                }
                case "beforeUpvotes": {
                    comparisonFn = (a, b) => b.post.upvotes - a.post.upvotes
                    if (post.upvotes < bottomUpvotes) {
                        bottomUpvotes = post.upvotes
                    }
                    break
                }
                case "sinceUpvotes": {
                    comparisonFn = (a, b) => a.post.upvotes - b.post.upvotes
                    if (post.upvotes > topUpvotes) {
                        topUpvotes = post.upvotes
                    }
                    break
                }
                default: {
                    await finishPostLoadWithCd()
                    return false
                }
            }
            const insertIndex = postEls.orderedInsert(postEl, comparisonFn)
            insertElementAtIndex(contents, postEl, contentsBaseLength + insertIndex)
        }
    }

    await finishPostLoadWithCd()
    return true
}

// "date" - Most recent / "upvotes" - highest upvotes
async function tryLoadTopPosts() {
    if (filter == "date") {
        await tryLoadPosts("sinceDate", topDate.toISOString())
    }
    else if (filter == "upvotes") {
        await tryLoadPosts("sinceUpvotes", topUpvotes)
    }
}
// "date" - Most old, "votes" - lowest upvotes
async function tryLoadBottomPosts() {
    if (filter == "date") {
        await tryLoadPosts("beforeDate", bottomDate.toISOString())
    }
    else if (filter == "upvotes") {
        await tryLoadPosts("beforeUpvotes", bottomUpvotes)
    }
}
function clearPosts() {
    for (const postEl of postEls.items) {
        if (contents.contains(postEl)) {
            contents.removeChild(postEl)
        }
    }
    postEls.clear()
    bottomUpvotes = 0xFFFFFFF
    bottomDate = new Date()
}
postsSortSelect.addEventListener("change", function() {
    filter = postsSortSelect.value
    clearPosts()
    tryLoadBottomPosts()
})
postsHideSensitive.addEventListener("change", function() {
    hideSensitive = !!postsHideSensitive.checked
    if (hideSensitive) {
        for (const postEl of postEls.items) {
            postEl.hidden = postEl.post.hasSensitiveContent
        }
    }
    else {
        for (const postEl of postEls.items) {
            postEl.hidden = false
        }    
    }
})
