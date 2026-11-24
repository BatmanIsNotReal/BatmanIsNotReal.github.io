import { outputMultiplier } from "../BuildingUpgrades.js";
import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";
import formatNumber from "../../formatNumber.js";

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
    // One line for all farms together, not one per farm
    checkForLoot(inv, document, updatebox, levels = []){
        let total = 0;
        for (let i = 0; i < this.ammount; i++){
            const gain = this.gain * outputMultiplier(levels[i] || 0);
            var chance = this.getRandomInt(0, 10);
            if (chance < 5){
                total += this.getRandomInt(10*gain, 30*gain);
            }
        }
        if (total > 0){
            inv.addHumanFood(total);
            updatebox.townUpdatesAdd((this.ammount === 1 ? "Your farm" : "Your " + this.ammount + " farms") + " produced " + formatNumber(total) + " human food.", document);
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