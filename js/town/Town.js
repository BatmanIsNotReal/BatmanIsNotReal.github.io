import * as Building from './Building.js';
import Grass from './buildings/Grass.js';
import Hut from './buildings/Hut.js';

export default class Town{
    constructor(townSize, xpRates){
        this.townSize = townSize;
        this.xpRates = xpRates;
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Hut: new Hut("Hut", "a small hut", 4, '../../../src/smallHut.jpg', 100),
        }
    }

    buyHut(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Hut.cost){
            familiar.addMaxLimit(this.Buildings.Hut.capacity);
            inventory.useWood(this.Buildings.Hut.cost);
            document.getElementById(id).src = String(this.Buildings.Hut.imgsrc);
        }
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}