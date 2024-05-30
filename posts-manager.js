/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck

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
    posts
    constructor() {
        this.posts = []
    }

    orderedInsert(postEl, comparisonFn) {
        let insertIndex = this.posts.findIndex(existingItem => existingItem.id === postEl.post?.id)
        if (insertIndex >= 0) {
            this.posts[insertIndex] = postEl
        }
        else {
            insertIndex = this.posts.findIndex(existingItem => comparisonFn(postEl, existingItem) < 0)
            if (insertIndex === -1) {
                this.posts.push(postEl)
                insertIndex = this.posts.length - 1
            }
            else {
                this.posts.splice(insertIndex, 0, postEl)
            }
        }
        return insertIndex
    }

    delete(postEl) {
      this.posts = this.posts.filter(existingItem => existingItem.id !== postEl.post?.id)
    }

    includes(postEl) {
      return this.posts.some(existingItem => existingItem.id === postEl.post?.id)
    }

    getById(id) {
        return this.posts.find(postEl => postEl.post?.id === id)
    }

    clear() {
        this.posts.length = 0
    }
}

const postEls = new PostElArray()
let bottomUpvotes = 0xFFFFFFFF
let bottomDate = new Date()

const contentsBaseLength = contents.childNodes.length
const postLimit = 16
const postLoadCooldown = 1000
let postFinishedLastLoad = null
let filter = postsSortSelect.value // "upvotes" | "date" 
let hideSensitive = !!postsHideSensitive.checked

// TODO: This whole class is hacky but kinda works
function insertElementAtIndex(parentElement, newElement, index) {
    const referenceElement = parentElement.childNodes[index]
    if (referenceElement) {
        parentElement.insertBefore(newElement, referenceElement)
    }
    else {
        parentElement.appendChild(newElement)
    }
}

// "date" - Most recent / "upvotes" - highest upvotes
async function tryLoadTopPosts() {
    const oldBottomDate = bottomDate
    const oldBottomUpvotes = bottomUpvotes
    if (filter == "date") {
        bottomDate = new Date()
    }
    else if (filter == "upvotes") {
        bottomUpvotes = 0xFFFFFFF
    }
    await tryLoadBottomPosts()
    for (const postEl of postEls) {
        if (filter == "date") {
            const postDate = new Date(postEl.post.creationDate)
            if (postDate < bottomDate) {
                bottomDate = postDate
            }
        }
        else if (filter == "upvotes" && postEl.post.upvotes < bottomUpvotes) {
            bottomUpvotes = postEl.post.upvotes
        }
    }
    bottomDate = oldBottomDate
    bottomUpvotes = oldBottomUpvotes
}
function clearPosts() {
    for (const postEl of postEls.posts) {
        if (contents.contains(postEl)) {
            contents.removeChild(postEl)
        }
    }
    postEls.clear()
    bottomUpvotes = 0xFFFFFFF
    bottomDate = new Date()
}
async function finishPostLoadWithCd() {
    await new Promise(resolve => setTimeout(resolve, postLoadCooldown))
    postFinishedLastLoad.resolve()
}
function shouldLoadPosts() {
    return more.scrollTopMax - more.scrollTop < 256
}
// "date" - Most old, "votes" - lowest upvotes
async function tryLoadBottomPosts() {
    if (shouldLoadPosts() && !postFinishedLastLoad?.locked) {
        if (postFinishedLastLoad !== null) {
            await postFinishedLastLoad.acquireAwaitPromise()
            if (!shouldLoadPosts()) {
                return
            }
        }
        postFinishedLastLoad = new PublicPromiseSingle()

        let postsUrl = null
        if (filter == "date") {
            postsUrl = `${localStorage.auth || DEFAULT_AUTH}/posts/?beforeDate=${
                bottomDate.toISOString()}&limit=${postLimit}`
        }
        else if (filter == "upvotes") {
            postsUrl = `${localStorage.auth || DEFAULT_AUTH}/posts/?beforeUpvotes=${
                bottomUpvotes}&limit=${postLimit}`
        }
        if (postsUrl == null) {
            await finishPostLoadWithCd()
            return
        }

        const res = await fetch(postsUrl)
        if (!res.ok) {
            console.error(`Failed to load posts, status ${res.status} ${res.statusText}:`, await res.json())
            await finishPostLoadWithCd()
            return
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
                let comparisonFn = null
                if (filter == "date") {
                    comparisonFn = (a, b) => new Date(b.post.creationDate) - new Date(a.post.creationDate)
                }
                else if (filter == "upvotes") {
                    comparisonFn = (a, b) => b.post.upvotes - a.post.upvotes
                }
                const insertIndex = postEls.orderedInsert(postEl, comparisonFn)
                insertElementAtIndex(contents, postEl, contentsBaseLength + insertIndex)
            }

            if (filter == "date") {
                const postDate = new Date(post.creationDate)
                if (postDate < bottomDate) {
                    bottomDate = postDate
                }
            }
            else if (filter == "upvotes") {
                if (post.upvotes < bottomUpvotes) {
                    bottomUpvotes = post.upvotes
                }
            }
        }
        await finishPostLoadWithCd()
    }
}
postsSortSelect.addEventListener("change", function() {
    filter = postsSortSelect.value
    clearPosts()
    tryLoadBottomPosts()
})
postsHideSensitive.addEventListener("change", function() {
    hideSensitive = !!postsHideSensitive.checked
    if (hideSensitive) {
        for (const postEl of postEls.posts) {
            postEl.hidden = postEl.post.hasSensitiveContent
        }
    }
    else {
        for (const postEl of postEls.posts) {
            postEl.hidden = false
        }    
    }
})
more.addEventListener("scroll", tryLoadBottomPosts)
