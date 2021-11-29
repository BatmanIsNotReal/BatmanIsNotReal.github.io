(function loadMouseTracker () {
    window.addEventListener("mousemove", (event) => {
        document.documentElement.style.setProperty("--cursorX", `${event.clientX}px`);
        document.documentElement.style.setProperty("--cursorY", `${event.clientY}px`);
    })
}());