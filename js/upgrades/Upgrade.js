import Farm from "../town/buildings/Farm.js";
import IronAxe from "./tools/ironAxe.js";
import IronHoe from "./tools/IronHoe.js";
import IronPick from "./tools/IronPick.js";

export default class Upgrade{
    constructor(){
        this.tools = {
            ironHoe: new IronHoe(50, 10, 0),
            ironAxe: new IronAxe(100, 10, 0),
            ironPick: new IronPick(200, 10, 0),
        };

    }

    buyIronHoe(inv, updatebox, farm){
        if (inv.getIronAmmount() >= this.tools.ironHoe.cost){
            inv.useIron(this.tools.ironHoe.cost);
            this.tools.ironHoe.ammount++;
            farm.gain = [(farm.gain[0]+(farm.gain[0]/100*this.tools.ironHoe.gainPercent)), (farm.gain[1]/100*this.tools.ironHoe.gainPercent)];
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron hoe. Your farms are more efficient.", document);
        }
    }

    buyIronAxe(inv, updatebox, lumbermill){
        if (inv.getIronAmmount() >= this.tools.ironAxe.cost){
            inv.useIron(this.tools.ironAxe.cost);
            this.tools.ironAxe.ammount++;
            lumbermill.gain = [(lumbermill.gain[0]+(lumbermill.gain[0]/100*this.tools.ironAxe.gainPercent)), (lumbermill.gain[1]/100*this.tools.ironAxe.gainPercent)];
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron axe. Your farms are more efficient.", document);
        }
    }

    buyIronPick(inv, updatebox, mine){
        if (inv.getIronAmmount() >= this.tools.ironPick.cost){
            inv.useIron(this.tools.ironPick.cost);
            this.tools.ironPick.ammount++;
            mine.gain = [(mine.gain[0]+(mine.gain[0]/100*this.tools.ironPick.gainPercent)), (mine.gain[1]/100*this.tools.ironPick.gainPercent)];
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron pick. Your farms are more efficient.", document);
        }
    }
}