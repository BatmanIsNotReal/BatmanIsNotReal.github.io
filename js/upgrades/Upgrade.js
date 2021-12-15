import Farm from "../town/buildings/Farm";
import IronAxe from "./tools/ironAxe";
import IronHoe from "./tools/IronHoe";
import IronPick from "./tools/IronPick";

export default class Upgrade{
    constructor(){
        this.tools = {
            ironHoe: new IronHoe(50, 10, 0),
            ironAxe: new IronAxe(100, 10, 0),
            ironPick: new IronPick(200, 10, 0),
        };

    }

    buyIronHoe(inv, updatebox){
        if (inv.items.getIronAmmount() >= this.tools.ironHoe.cost){
            inv.useIron(this.tools.ironHoe.cost);
            this.tools.ironHoe.ammount++;
            Farm.gain = [(Farm.gain[0]+(Farm.gain[0]/100*this.tools.ironHoe.gainPercent)), (Farm.gain[1]/100*this.tools.ironHoe.gainPercent)];
            updatebox.townUpdatesAdd("Your blacksmith has produced an iron hoe. Your farms are more efficient.", document);
        }
    }
}