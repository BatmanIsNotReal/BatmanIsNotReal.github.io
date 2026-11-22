import * as Building from './Building.js';
import Farm from './buildings/Farm.js';
import Grass from './terrain/Grass.js';
import Hut from './buildings/Hut.js';
import Mine from './buildings/Mine.js';
import Rock from './terrain/Rock.js';
import Water from './terrain/Water.js';
import Forest from './terrain/Forest.js';
import LumberMill from './buildings/LumberMill.js';
import BloodTemple from './buildings/BloodTemple.js';

export default class Town{
    constructor(townSize, xpRates){
        this.townSize = townSize;
        this.xpRates = xpRates;
        this.mapWidth = 80;
        this.mapHeight = 20;
        this.tileSize = 64; // width and height of one map tile, in pixels
        this.tiles = {
        }
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Water: new Water("water", "a patch of water", 0, '../../../src/water.png'),
            Rock: new Rock("Rock", "a patch of rock", 0, '../../../src/rock.png'),
            Forest: new Forest("Forest", "a forest", 0, '../../../src/forest.png'),
            Hut: new Hut("Hut", "a small hut", 4, '../../../src/smallHut.png', 100),
            Mine: new Mine("Mine", "a mine", 10, '../../../src/mine.png', 1000, 10),
            Farm: new Farm("Farm", "a farm for human food", 5, '../../../src/farm.png', 500, 5),
            LumberMill: new LumberMill("Lumber Mill", "a lumber mill for wood", 5, '../../../src/lumbermill.png', 600, 5),
            BloodTemple: new BloodTemple("Blood Temple", "A place of worship to thy master", 0, '../../../src/bloodtemple.png', {wood: 10000, iron: 15000, bronze: 5000, gold: 1000}, 40),
        }

        this.buildSound = new Audio('music/sounds/buildSound.mp3');
    }

    buyHut(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Hut.cost){
            if(this.tiles[id] < 1){
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
            else if (this.tiles[id] == 6){
                alert("There is a forest here");
            }
            else if (this.tiles[id] == 7){
                alert("There is already a lumber mill here");
            }
                else if (this.tiles[id] == 8){
                    alert("There is already a blood temple here");
                }
        }else{
            alert("You dont have enough wood!");
        }
    }

    buyMine(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Mine.cost){
            if (familiar.getNotWorking() >= this.Buildings.Mine.workersRequired){
                if(this.tiles[id] < 1){
                    alert("you need to build a mine in a mountain");
                }else if(this.tiles[id] == 1){
                    alert("There is already a hut on this land");
                }else if (this.tiles[id] == 2){
                    alert("There is water here");
                }
                else if (this.tiles[id] == 3){
                    this.Buildings.Mine.ammount++;
                    familiar.addMaxLimit(this.Buildings.Mine.capacity);
                    familiar.notWorking = familiar.notWorking - this.Buildings.Mine.workersRequired;
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
                else if (this.tiles[id] == 6){
                    alert("There is a forest here");
                }
                else if (this.tiles[id] == 7){
                    alert("There is already a lumber mill here");
                }
                else if (this.tiles[id] == 8){
                    alert("There is already a blood temple here");
                }
            }else{
                alert("you dont have enough familiars.");
            }
        }else{
             alert("You dont have enough wood!");
        }
    }

    buyFarm(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.Farm.cost){
            if (familiar.getNotWorking() >= this.Buildings.Farm.workersRequired){
                if(this.tiles[id] < 1){
                    this.Buildings.Farm.ammount++;
                    familiar.addMaxLimit(this.Buildings.Farm.capacity);
                    familiar.notWorking = familiar.notWorking - this.Buildings.Farm.workersRequired;
                    inventory.useWood(this.Buildings.Farm.cost);
                    document.getElementById(id).src = String(this.Buildings.Farm.imgsrc);
                    this.tiles[id] = 5;
                }else if(this.tiles[id] == 1){
                    alert("There is already a hut on this land");
                }else if (this.tiles[id] == 2){
                    alert("There is water here");
                }
                else if (this.tiles[id] == 3){
                    alert("There is rock here");
                }
                else if (this.tiles[id] == 4){
                    alert("There is already a mine here");
                }
                else if (this.tiles[id] == 5){
                    alert("there is already a farm here");
                }
                else if (this.tiles[id] == 6){
                    alert("There is a forest here");
                }
                else if (this.tiles[id] == 7){
                    alert("There is already a lumber mill here");
                }
                else if (this.tiles[id] == 8){
                    alert("There is already a blood temple here");
                }
            }
            else{
                alert("you dont have enough familiars.");
            }
        }else{
            alert("You dont have enough wood!");
        }
    }

    buyLumberMill(inventory, familiar, document, id){
        if (inventory.items.wood >= this.Buildings.LumberMill.cost){
            if (familiar.getNotWorking() >= this.Buildings.LumberMill.workersRequired){
                if(this.tiles[id] < 1){
                    alert("This is not grassland");
                }else if(this.tiles[id] == 1){
                    alert("There is already a hut on this land");
                }else if (this.tiles[id] == 2){
                    alert("There is water here");
                }
                else if (this.tiles[id] == 3){
                    alert("There is rock here");
                }
                else if (this.tiles[id] == 4){
                    alert("There is already a mine here");
                }
                else if (this.tiles[id] == 5){
                    alert("there is already a farm here");
                }
                else if (this.tiles[id] == 6){
                    this.Buildings.LumberMill.ammount++;
                    familiar.addMaxLimit(this.Buildings.LumberMill.capacity);
                    familiar.notWorking = familiar.notWorking - this.Buildings.LumberMill.workersRequired;
                    inventory.useWood(this.Buildings.LumberMill.cost);
                    document.getElementById(id).src = String(this.Buildings.LumberMill.imgsrc);
                    this.tiles[id] = 7;
                }
                else if (this.tiles[id] == 7){
                    alert("There is already a lumber mill here");
                }
                else if (this.tiles[id] == 8){
                    alert("There is already a blood temple here");
                }
            }else{
                alert("you dont have enough familiars.");
            }
        }else{
             alert("You dont have enough wood!");
        }
    }



    // The temple is built on grassland and costs wood, iron, bronze and gold.
    buyBloodTemple(inventory, familiar, document, id){
        const temple = this.Buildings.BloodTemple;
        const cost = temple.cost;
        const missing = [];
        for (const [item, price] of Object.entries(cost)){
            if (inventory.items[item] < price) missing.push(item);
        }
        if (missing.length){
            alert("You dont have enough " + missing.join(", ") + "!");
            return;
        }
        if (familiar.getNotWorking() < temple.workersRequired){
            alert("you dont have enough familiars.");
            return;
        }
        const tile = this.tiles[id];
        if (tile < 1){
            temple.ammount++;
            familiar.addMaxLimit(temple.capacity);
            familiar.notWorking = familiar.notWorking - temple.workersRequired;
            for (const [item, price] of Object.entries(cost)) inventory.items[item] -= price;
            document.getElementById(id).src = String(temple.imgsrc);
            this.tiles[id] = 8;
            return;
        }
        alert({
            1: "There is already a hut on this land",
            2: "There is water here",
            3: "There is rock here",
            4: "There is already a mine here",
            5: "There is already a farm here",
            6: "There is a forest here",
            7: "There is already a lumber mill here",
            8: "There is already a blood temple here",
        }[tile] || "You can only build a blood temple on grassland");
    }

    //getTiles(){
      //  return this.tiles;
    //}

    createTiles(document){
        let table = document.getElementById("map");
        let current = 0;
        for (let a = 0; a < this.mapHeight; a++){
            let t = document.createElement('tr');
            table.appendChild(t);
            for (let i = 0; i < this.mapWidth; i++){
                let g = document.createElement('td');
                g.setAttribute("width", this.tileSize);
                g.setAttribute("height", this.tileSize);
                let id = "tile"+current;
                this.tiles["tile"+current] = 0;
                current++;
                t.appendChild(g);
                let image = document.createElement('img');
                image.setAttribute("id", id);
                image.setAttribute("width", this.tileSize);
                image.setAttribute("height", this.tileSize);
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
            //Water
            if (n > 50 && n < 70){
                this.tiles[name] = 2;
            }
            //Rock
            if (n > 70 && n < 80){
                this.tiles[name] = 3;
            }
            //Forest
            if (n > 80 && n < 100){
                this.tiles[name] = 6;
            }

            
        }
        
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    // Which picture belongs to which tile type
    tileImage(type){
        const B = this.Buildings;
        if (type < 1) return B.Grass.imgsrc;
        return {
            1: B.Hut,
            2: B.Water,
            3: B.Rock,
            4: B.Mine,
            5: B.Farm,
            6: B.Forest,
            7: B.LumberMill,
            8: B.BloodTemple,
        }[type]?.imgsrc;
    }

    updateTileImages(document){
        for (let name in this.tiles){
            const src = this.tileImage(this.tiles[name]);
            const image = document.getElementById(name);
            if (src && image.getAttribute("src") !== String(src)) image.src = String(src);
        }
    }

    // Puts a saved map onto the current map. Works when the map size has changed since
    // the save was made: every saved tile keeps its row and column, and tiles that did
    // not exist before keep the random terrain that is already there.
    // savedWidth: how many tiles wide the saved map was (the old map was 40 wide).
    loadTiles(saved, savedWidth = 40){
        if (!saved || typeof saved !== "object" || !(savedWidth > 0)) return;
        for (const [name, type] of Object.entries(saved)){
            const match = /^tile(\d+)$/.exec(name);
            if (!match || !Number.isInteger(type) || type < 0 || type > 8) continue;
            const index = Number(match[1]);
            const row = Math.floor(index / savedWidth);
            const col = index % savedWidth;
            if (row >= this.mapHeight || col >= this.mapWidth) continue;
            this.tiles["tile" + (row * this.mapWidth + col)] = type;
        }
    }

    update(document){
        this.updateTileImages(document);

        
    }

    updateTen(inv, document, updatebox, familiar){
        this.Buildings.Hut.updateTen(familiar, updatebox);
        this.Buildings.Mine.updateTen(inv, document, updatebox);
        this.Buildings.Farm.updateTen(inv, document, updatebox);
        this.Buildings.LumberMill.updateTen(inv, document, updatebox);
    }

    // Influence multiplier of this round (the Blood Temple's blessing).
    // Call once per round, before the house counts the influence.
    // A new blessing consumes part of the player's blood (inventory).
    influenceMultiplier(document, updatebox, inventory){
        return this.Buildings.BloodTemple.updateTen(document, updatebox, inventory);
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}