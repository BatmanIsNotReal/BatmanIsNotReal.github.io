// Zoom the map with the mouse wheel (and the +/- buttons).
// The tile size lives in the CSS variable --tile-size; the zoom keeps the spot
// under the mouse where it is, and is remembered between visits.
const STORAGE_KEY = "vampireMapTileSize";

export default class MapZoom{
    constructor(scrollBox, { size = 64, min = 16, max = 128, step = 1.15, storageKey = STORAGE_KEY } = {}){
        this.box = scrollBox;
        this.min = min;
        this.max = max;
        this.step = step;
        this.storageKey = storageKey; // null: do not remember the zoom
        this.size = this.readSaved(size);
        this.apply(this.size);
        this.box.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
    }

    readSaved(fallback){
        try {
            if (!this.storageKey) return fallback;
            const value = Number(localStorage.getItem(this.storageKey));
            if (value >= this.min && value <= this.max) return value;
        } catch { /* storage not available: use the default */ }
        return fallback;
    }

    apply(size){
        this.size = size;
        this.box.style.setProperty("--tile-size", size + "px");
    }

    // Changes the zoom; (x, y) is the point in the scroll box that should stay put.
    zoomTo(newSize, x = this.box.clientWidth / 2, y = this.box.clientHeight / 2){
        newSize = Math.round(Math.min(this.max, Math.max(this.min, newSize)));
        if (newSize === this.size) return;
        const ratio = newSize / this.size;
        const mapX = this.box.scrollLeft + x;
        const mapY = this.box.scrollTop + y;
        this.apply(newSize);
        this.box.scrollLeft = mapX * ratio - x;
        this.box.scrollTop = mapY * ratio - y;
        try { if (this.storageKey) localStorage.setItem(this.storageKey, String(newSize)); } catch { /* ignore */ }
    }

    zoomBy(factor, x, y){
        this.zoomTo(this.size * factor, x, y);
    }

    onWheel(event){
        event.preventDefault(); // zoom instead of scrolling the map
        const rect = this.box.getBoundingClientRect();
        const factor = event.deltaY < 0 ? this.step : 1 / this.step;
        this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
    }
}
