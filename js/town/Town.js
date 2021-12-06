import * as Building from './Building.js';
import Grass from './buildings/Grass.js';
import Hut from './buildings/Hut.js';
import Mine from './buildings/Mine.js';
import Rock from './buildings/Rock.js';
import Water from './buildings/Water.js';

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
            tile31: 0,
            tile32: 0,
            tile33: 0,
            tile34: 0,
            tile35: 0,
            tile36: 0,
            tile37: 0,
            tile38: 0,
            tile39: 0,
            tile40: 0,
            tile41: 0,
            tile42: 0,
            tile43: 0,
            tile44: 0,
            tile45: 0,
            tile46: 0,
            tile47: 0,
            tile48: 0,
            tile49: 0,
            tile50: 0,
            tile51: 0,
            tile52: 0,
            tile53: 0,
            tile54: 0,
            tile55: 0,
            tile56: 0,
            tile57: 0,
            tile58: 0,
            tile59: 0,
            tile60: 0,
            tile61: 0,
            tile62: 0,
            tile63: 0,
            tile64: 0,
            tile65: 0,
            tile66: 0,
            tile67: 0,
            tile68: 0,
            tile69: 0,
            tile70: 0,
            tile71: 0,
            tile72: 0,
            tile73: 0,
            tile74: 0,
            tile75: 0,
            tile76: 0,
            tile77: 0,
            tile78: 0,
        }
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Water: new Water("water", "a patch of water", 0, '../../../src/water.png'),
            Rock: new Rock("Rock", "a patch of rock", 0, '../../../src/rock.png'),
            Hut: new Hut("Hut", "a small hut", 4, '../../../src/smallHut.png', 100),
            Mine: new Mine("Mine", "a mine", 10, '../../../src/mine.png', 1000),
        }

        this.buildSound = new Audio('music\sounds\buildSound.mp3');
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
                this.buildSound.play();
            }else if(this.tiles[id] == 1){
                alert("There is already a hut on this land");
            }else if (this.tiles[id] == 2){
                alert("There is water here");
            }
            else if (this.tiles[id] == 3){
                alert("You cannot build a hut here");
            }
            else if (this.tiles[id] == 4){
                alert("There is already a mine here");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }

    buyMine(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Mine.cost){
            if(this.tiles[id] < 1){
                alert("you need to build a mine in a mountain");
            }else if(this.tiles[id] == 1){
                alert("There is already a hut on this land");
            }else if (this.tiles[id] == 2){
                alert("There is water here");
            }
            else if (this.tiles[id] == 3){
                console.log(document.getElementById(id).src);
                familiar.addMaxLimit(this.Buildings.Mine.capacity);
                inventory.useWood(this.Buildings.Mine.cost);
                document.getElementById(id).src = String(this.Buildings.Mine.imgsrc);
                this.tiles[id] = 4;
                this.buildSound.play();
            }
            else if (this.tiles[id] == 4){
                alert("There is already a mine here");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }



    getTiles(){
        return this.tiles;
    }

    newTileMap(document){
        for (var name in this.tiles){
            var n = this.getRandomInt(1, 100);
            if (n > 1 && n < 50){
                this.tiles[name] = 0;
            }
            if (n > 50 && n < 75){
                this.tiles[name] = 2;
            }
            if (n > 75 && n < 100){
                this.tiles[name] = 3;
            }
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTileImages(document){
        for (var name in this.tiles){
            if(this.tiles[name] < 1){
                document.getElementById(name).src = String(this.Buildings.Grass.imgsrc);
            }
            if (this.tiles[name] == 1){
                document.getElementById(name).src = String(this.Buildings.Hut.imgsrc);
            }
            if (this.tiles[name] == 2){
                document.getElementById(name).src = String(this.Buildings.Water.imgsrc);
            }
            if (this.tiles[name] == 3){
                document.getElementById(name).src = String(this.Buildings.Rock.imgsrc);
            }
            if (this.tiles[name] == 4){
                document.getElementById(name).src = String(this.Buildings.Mine.imgsrc);
            }
        }
    }

    update(document){
        this.updateTileImages(document);
        
    }

    updateTen(inv){
        this.Buildings.Mine.updateTen(inv);
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}