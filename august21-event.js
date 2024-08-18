// Show game popup
const eventDate = 1724238000000
const popup = document.getElementById("popup")
popup.showModal()

setInterval(() => {
    august21PopupTimer.textContent = ` (${toCountdownString(eventDate)})`
}, 1000)

startCountDown(eventDate, false).then((async) => {
    august21PopupLabel.style.display = "none"
    august21PopupButton.style.display = "flex"
})

function startAugust21Event() {
    return
}
