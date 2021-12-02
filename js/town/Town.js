import * as Building from './Building.js';
import Grass from './buildings/Grass.js';
import Hut from './buildings/Hut.js';

export default class Town{
    constructor(townSize, xpRates){
        this.townSize = townSize;
        this.xpRates = xpRates;
        this.tiles = {
            tile1: 0,
            tile2: 0,
            tile3: 0,
            tile4: 0,
            tile5: 0,
            tile6: 0,
            tile7: 0,
            tile8: 0,
            tile9: 0,
            tile10: 0,
            tile11: 0,
            tile12: 0,
            tile13: 0,
            tile14: 0,
            tile15: 0,
            tile16: 0,
            tile17: 0,
            tile18: 0,
            tile19: 0,
            tile20: 0,
            tile21: 0,
            tile22: 0,
            tile23: 0,
            tile24: 0,
            tile25: 0,
            tile26: 0,
            tile27: 0,
            tile28: 0,
            tile29: 0,
            tile30: 0,
        }
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Hut: new Hut("Hut", "a small hut", 4, '../../../src/smallHut.png', 100),
        }
    }

    buyHut(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Hut.cost){
            if(this.tiles[id] < 1){
                console.log(document.getElementById(id).src);
                console.log(String(this.Buildings.Grass.imgsrc));
                familiar.addMaxLimit(this.Buildings.Hut.capacity);
                inventory.useWood(this.Buildings.Hut.cost);
                document.getElementById(id).src = String(this.Buildings.Hut.imgsrc);
                this.tiles[id] = 1;
            }else{
                alert("There is already a hut on this land");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }

    getTiles(){
        return this.tiles;
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}