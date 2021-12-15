import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";

export default class Blacksmith{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
        this.workers = 0;
    }

    



    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(inv, document, updatebox){
        this.checkForLoot(inv, document, updatebox);
    }
}