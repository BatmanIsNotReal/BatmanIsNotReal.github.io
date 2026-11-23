import { outputMultiplier } from "../BuildingUpgrades.js";
import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";

export default class Farm{
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

    // levels: the upgrade level of each building of this kind (see BuildingUpgrades.js)
    checkForLoot(inv, document, updatebox, levels = []){
        for (let i = 0; i < this.ammount; i++){
            const gain = this.gain * outputMultiplier(levels[i] || 0);
            var chance = this.getRandomInt(0, 10);
            if (chance < 5){
                //no food
                var ammount = this.getRandomInt(10*gain, 30*gain);
                updatebox.townUpdatesAdd("Your farmers have produced " + ammount + " of human food.", document);
                inv.addHumanFood(ammount);
            }
        }
    }



    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(inv, document, updatebox, levels = []){
        this.checkForLoot(inv, document, updatebox, levels);
    }
}