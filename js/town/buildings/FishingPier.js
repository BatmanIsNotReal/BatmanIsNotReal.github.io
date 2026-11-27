import Defence from "./Defence.js";
import { outputMultiplier } from "../BuildingUpgrades.js";
import formatNumber from "../../formatNumber.js";

// A fishing pier on a big lake or sea: human food, like a farm but from the water.
// Every round each working pier has a chance to bring in a catch.
export default class FishingPier extends Defence{
    constructor(name, description, imgsrc, cost, workersRequired, tileType){
        super(name, description, imgsrc, cost, workersRequired, tileType);
        this.gain = 1;
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    // levels: the upgrade level of each working pier. One line for all piers together.
    updateTen(inv, document, updatebox, levels = []){
        let total = 0;
        for (let i = 0; i < this.ammount; i++){
            const gain = this.gain * outputMultiplier(levels[i] || 0);
            if (this.getRandomInt(0, 100) < 55) total += this.getRandomInt(12 * gain, 33 * gain);
        }
        if (total > 0){
            inv.addHumanFood(total);
            updatebox.townUpdatesAdd((this.ammount === 1 ? "Your fishing pier" : "Your " + this.ammount + " fishing piers") + " landed " + formatNumber(total) + " human food.", document);
        }
    }
}
