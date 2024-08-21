// Show game popup
const eventDate = 1724238000000
const popup = document.getElementById("popup")
popup.showModal()

setInterval(() => {
    august21PopupTimer.textContent = ` (${toCountdownString(eventDate)})`
}, 1000)

startCountDown(eventDate, false).then((async) => {
    august21PopupTimer.style.display = "none"
    // TODO: Reimplement on game release
    //august21PopupLabel.style.display = "none"
    //august21PopupButton.style.display = "flex"
    enableAugust21Event()
})

async function enableAugust21Event() {
    const forceTheme = "goldplace.live" // goldplace.live (August 21st 2024)
    forceTheme(forceTheme)

}

// TODO: Temporary
//enableAugust21Event()
