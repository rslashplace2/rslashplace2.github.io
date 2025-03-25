// Show game popup
function isTodayAugust21st() {
    const now = new Date()
    return now.getMonth() === 7 && now.getDate() === 21 // August is month 7 (zero-based)
}

function getNextAugust21st() {
	const now = new Date()
	const year = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() > 21) 
		? now.getFullYear() + 1 
		: now.getFullYear()

	const august21st = new Date(year, 7, 21) // Month is zero-based (7 = August)
	return Math.floor(august21st.getTime() / 1000) // Convert to Unix timestamp
}

function enableAugust21() {
	const eventDate = isTodayAugust21st() ? Date.now() : getNextAugust21st()
	const popup = document.getElementById("popup")
	popup.showModal()

	setInterval(() => {
		august21PopupTimer.textContent = ` (${toCountdownString(eventDate)})`
	}, 1000)

	startCountDown(eventDate, false).then((async) => {
		august21PopupTimer.style.display = "none"

		// TODO: Reimplement on game release
		august21PopupLabel.style.display = "none"
		august21PopupButton.style.display = "flex"
	})	
}
