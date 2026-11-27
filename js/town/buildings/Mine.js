import { outputMultiplier } from "../BuildingUpgrades.js";
import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";
import formatNumber from "../../formatNumber.js";

export default class Mine{
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

    displayMenu(){
        var header = "MINE";

    }

    // levels: the upgrade level of each building of this kind (see BuildingUpgrades.js)
    // One line for all mines together: "Your 12 mines found 340 iron, 45 bronze and 6 gold."
    checkForLoot(inv, document, updatebox, levels = []){
        let iron = 0, stone = 0, bronze = 0, gold = 0;
        for (let i = 0; i < this.ammount; i++){
            const gain = this.gain * outputMultiplier(levels[i] || 0);
            var chance = this.getRandomInt(0, 1000);
            if (chance <= 300){
                //your miners discovered an ore of iron
                iron += this.getRandomInt(10*gain, 30*gain);
            }
            if (chance >= 700 && chance <= 950){
                //your miners cut a block of stone
                stone += this.getRandomInt(6*gain, 20*gain);
            }
            if (chance <= 100){
                //your miners discovered a branch of bronze
                bronze += this.getRandomInt(5*gain, 20*gain);
            }
            if (chance <=25){
                //your miners discovered a branch of gold
                gold += this.getRandomInt(2*gain, 12*gain);
            }
        }
        const found = [];
        if (iron > 0){ inv.addIron(iron); found.push(formatNumber(iron) + " iron"); }
        if (stone > 0){ inv.addStone(stone); found.push(formatNumber(stone) + " stone"); }
        if (bronze > 0){ inv.addBronze(bronze); found.push(formatNumber(bronze) + " bronze"); }
        if (gold > 0){ inv.addGold(gold); found.push(formatNumber(gold) + " gold"); }
        if (found.length){
            const list = found.length > 1 ? found.slice(0, -1).join(", ") + " and " + found[found.length - 1] : found[0];
            updatebox.townUpdatesAdd((this.ammount === 1 ? "Your mine" : "Your " + this.ammount + " mines") + " yielded " + list + ".", document);
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