const eventCountdown = document.getElementById("eventCountdown")
const posel = document.getElementById("posel")
const body = document.body

body.setAttribute("eventphase", "0")

let eventCD = 0
function countDown(){
    setTimeout(() => {
        body.setAttribute("eventphase", "1")
    
        setTimeout(() => {
            body.setAttribute("eventphase", "2")
    
        }, 6000)
    }, 500)    
}

countDown()
setTimeout(startEvent, 8000)

function startEvent() {
    body.setAttribute("eventphase", "3")
}
