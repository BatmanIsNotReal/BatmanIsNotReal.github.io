import Hut from "./Hut.js";

// A stone block of flats: room for many familiars on one tile, and more children than a hut.
// It costs stone, and stone to keep up.
export default class Tenement extends Hut{
    constructor(name, description, capacity, imgsrc, cost){
        super(name, description, capacity, imgsrc, cost);
        this.tileType = 23;
        this.workersRequired = 0;
        this.birthPercent = 6; // a hut has 2
    }
}
