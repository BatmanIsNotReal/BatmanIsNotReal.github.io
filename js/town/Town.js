import * as Building from './Building.js';
import Farm from './buildings/Farm.js';
import Grass from './terrain/Grass.js';
import Hut from './buildings/Hut.js';
import Mine from './buildings/Mine.js';
import Rock from './terrain/Rock.js';
import Water from './terrain/Water.js';

export default class Town{
    constructor(townSize, xpRates){
        this.townSize = townSize;
        this.xpRates = xpRates;
        this.tiles = {
        }
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Water: new Water("water", "a patch of water", 0, '../../../src/water.png'),
            Rock: new Rock("Rock", "a patch of rock", 0, '../../../src/rock.png'),
            Hut: new Hut("Hut", "a small hut", 4, '../../../src/smallHut.png', 100),
            Mine: new Mine("Mine", "a mine", 10, '../../../src/mine.png', 1000),
            Farm: new Farm("Farm", "a farm for human food", 5, '../../../src/farm.jpg', 500),
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
                this.Buildings.Hut.ammount++;
                document.getElementById(id).src = String(this.Buildings.Hut.imgsrc);
                this.tiles[id] = 1;
                
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
            else if (this.tiles[id] == 5){
                alert("There is already a farm here");
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
                this.Buildings.Mine.ammount++;
                console.log(document.getElementById(id).src);
                familiar.addMaxLimit(this.Buildings.Mine.capacity);
                inventory.useWood(this.Buildings.Mine.cost);
                document.getElementById(id).src = String(this.Buildings.Mine.imgsrc);
                this.tiles[id] = 4;
                
            }
            else if (this.tiles[id] == 4){
                alert("There is already a mine here");
            }
            else if (this.tiles[id] == 5){
                alert("There is already a farm here");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }

    buyFarm(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Farm.cost){
            if(this.tiles[id] < 1){
                this.Buildings.Farm.ammount++;
                console.log(document.getElementById(id).src);
                familiar.addMaxLimit(this.Buildings.Farm.capacity);
                inventory.useWood(this.Buildings.Farm.cost);
                document.getElementById(id).src = String(this.Buildings.Farm.imgsrc);
                this.tiles[id] = 5;
            }else if(this.tiles[id] == 1){
                alert("There is already a hut on this land");
            }else if (this.tiles[id] == 2){
                alert("There is water here");
            }
            else if (this.tiles[id] == 3){
                alert("There is already a mine here");
                
            }
            else if (this.tiles[id] == 4){
                alert("There is already a mine here");
            }
            else if (this.tiles[id] == 5){
                alert("there is already a farm here");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }



    //getTiles(){
      //  return this.tiles;
    //}

    createTiles(document){
        let table = document.getElementById("map");
        let current = 0;
        for (let a = 0; a < 10; a++){
            let t = document.createElement('tr');
            table.appendChild(t);
            for (let i = 0; i < 10; i++){
                let g = document.createElement('td');
                let id = "tile"+current;
                this.tiles["tile"+current] = 0;
                current++;
                table.appendChild(g);
                console.log(id);
                let image = document.createElement('img');
                image.setAttribute("id", id);
                image.setAttribute("width", 64);
                image.setAttribute("height", 64);
                image.setAttribute("class", "tile");
                g.appendChild(image);
            }
        }
    }

    newTileMap(document){
        for (let name in this.tiles){
            let n = this.getRandomInt(1, 100);
            if (n > 1 && n < 50){
                this.tiles[name] = 0;
            }
            if (n > 50 && n < 75){
                this.tiles[name] = 2;
            }
            if (n > 75 && n < 100){
                this.tiles[name] = 3;
            }
            console.log(this.tiles[name] + "newtilemap");
        }
        
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTileImages(document){
        for (let name in this.tiles){
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
            if (this.tiles[name] == 5){
                document.getElementById(name).src = String(this.Buildings.Farm.imgsrc);
            }
        }
        
    }

    update(document){
        this.updateTileImages(document);
        
    }

    updateTen(inv, document, updatebox){
        this.Buildings.Mine.updateTen(inv, document, updatebox);
        this.Buildings.Farm.updateTen(inv, document, updatebox);
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}