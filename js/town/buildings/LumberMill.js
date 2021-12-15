import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";

export default class LumberMill{
    constructor(name, description, capacity, imgsrc, cost, workersRequired){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
        this.workersRequired = workersRequired;
        this.gain = 1;
    }

    checkForLoot(inv, document, updatebox){
        for (let i = 0; i < this.ammount; i++){
            var chance = this.getRandomInt(0, 10);
            console.log(chance);
            if (chance < 5){
                var ammount = this.getRandomInt(10*this.gain, 30*this.gain);
                updatebox.townUpdatesAdd("Your lumber mill produced " + ammount + " wood.", document);
                inv.addWood(ammount);
            }
        }
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