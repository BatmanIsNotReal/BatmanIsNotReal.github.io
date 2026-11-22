import Farm from "../town/buildings/Farm.js";
import IronAxe from "./tools/ironAxe.js";
import IronHoe from "./tools/IronHoe.js";
import IronPick from "./tools/IronPick.js";

// Every upgrade you buy makes the next one of the same kind 10% more expensive.
const PRICE_GROWTH = 1.1;

export default class Upgrade{
    constructor(){
        this.tools = {
            ironHoe: new IronHoe(50, 10, 0),
            ironAxe: new IronAxe(100, 10, 0),
            ironPick: new IronPick(200, 10, 0),
        };

        // The price follows from how many have been bought (so it is also right after loading a save)
        for (const tool of Object.values(this.tools)){
            const basePrice = tool.cost;
            Object.defineProperty(tool, "cost", {
                get: () => Math.ceil(Number((basePrice * Math.pow(PRICE_GROWTH, tool.ammount)).toFixed(6))), // toFixed: 50*1.1 is 55.00000000000001
                enumerable: true,
            });
        }

    }

    buyIronHoe(inv, updatebox, farm){
        if (inv.getIronAmmount() >= this.tools.ironHoe.cost){
            inv.useIron(this.tools.ironHoe.cost);
            this.tools.ironHoe.ammount++;
            farm.gain = (farm.gain+(farm.gain/100*this.tools.ironHoe.gainPercent));
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron hoe. Your farms are more efficient.", document);
        }
    }

    buyIronAxe(inv, updatebox, lumbermill){
        if (inv.getIronAmmount() >= this.tools.ironAxe.cost){
            inv.useIron(this.tools.ironAxe.cost);
            this.tools.ironAxe.ammount++;
            lumbermill.gain = (lumbermill.gain+(lumbermill.gain/100*this.tools.ironAxe.gainPercent));
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron axe. Your lumber mills are more efficient.", document);
        }
    }

    buyIronPick(inv, updatebox, mine){
        if (inv.getIronAmmount() >= this.tools.ironPick.cost){
            inv.useIron(this.tools.ironPick.cost);
            this.tools.ironPick.ammount++;
            mine.gain = (mine.gain+(mine.gain/100*this.tools.ironPick.gainPercent));
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron pick. Your mines are more efficient.", document);
        }
    }
}