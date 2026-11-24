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
import { UPGRADABLE, MAX_LEVEL, HUT_ROOM_PER_LEVEL, costFor, effectText } from './BuildingUpgrades.js';

const DEMOLISH_REFUND = 0.7; // share of the building price you get back

export default class Town{
    constructor(townSize, xpRates){
        this.townSize = townSize;
        this.xpRates = xpRates;
        this.mapWidth = 80;
        this.mapHeight = 40;
        this.tileSize = 64; // width and height of one map tile, in pixels
        this.tiles = {
        }
        this.tileLevels = {}; // upgrade level of the buildings: tile id -> 1..10 (no entry = level 0)
        this.Buildings ={
            Grass: new Grass("grass", "a patch of grass", 0, '../../../src/grass.png'),
            Water: new Water("water", "a patch of water", 0, '../../../src/water.png'),
            Rock: new Rock("Rock", "a patch of rock", 0, '../../../src/rock.png'),
            Cave: new Rock("Cave", "an entrance to the underground", 0, '../../../src/cave.png'),
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

    // Natural-looking terrain for a new map: smooth noise makes big lakes, mountain ranges and
    // forests instead of single random tiles. The shares stay the same as before: about 17% water,
    // 9% mountains and 22% forest, the rest is grass for buildings.
    newTileMap(document){
        this.tileLevels = {};
        const width = this.mapWidth;
        const height = this.mapHeight;
        const count = width * height;

        const height_ = this.smoothNoise(width, height);   // low = water, high = mountains
        const wetness = this.smoothNoise(width, height);   // high = forest

        // Where the thresholds lie follows from the shares, so every map has similar amounts
        const WATER = 0.17, ROCK = 0.09, FOREST = 0.22;
        const order = (values) => values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((pair) => pair[1]);
        const byHeight = order(height_);

        const type = new Array(count).fill(0);
        for (let i = 0; i < Math.round(count * WATER); i++) type[byHeight[i]] = 2;                 // lakes in the lowest ground
        for (let i = 0; i < Math.round(count * ROCK); i++) type[byHeight[count - 1 - i]] = 3;      // mountains on the highest

        const dry = order(wetness).reverse().filter((i) => type[i] === 0);                         // wettest grass first
        for (let i = 0; i < Math.round(count * FOREST) && i < dry.length; i++) type[dry[i]] = 6;

        // Tidy up: a tile surrounded by something else joins its surroundings (no single stray tiles)
        for (let pass = 0; pass < 2; pass++){
            const next = type.slice();
            for (let y = 0; y < height; y++){
                for (let x = 0; x < width; x++){
                    const around = {};
                    let neighbours = 0;
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const t = type[ny * width + nx];
                        around[t] = (around[t] || 0) + 1;
                        neighbours++;
                    }
                    const me = type[y * width + x];
                    if ((around[me] || 0) === 0 && neighbours > 2){
                        next[y * width + x] = Number(Object.keys(around).sort((a, b) => around[b] - around[a])[0]);
                    }
                }
            }
            for (let i = 0; i < count; i++) type[i] = next[i];
        }

        for (let i = 0; i < count; i++) this.tiles["tile" + i] = type[i];
    }

    // Smooth random landscape: random values on a coarse grid, blended together at three
    // sizes (big shapes plus finer detail). Returns one number per tile, row by row.
    smoothNoise(width, height){
        const layers = [{ size: 10, weight: 1 }, { size: 5, weight: 0.5 }, { size: 2.5, weight: 0.25 }];
        const values = new Array(width * height).fill(0);
        for (const { size, weight } of layers){
            const gridW = Math.ceil(width / size) + 2;
            const gridH = Math.ceil(height / size) + 2;
            const grid = Array.from({ length: gridW * gridH }, () => Math.random());
            const smooth = (t) => t * t * (3 - 2 * t);
            for (let y = 0; y < height; y++){
                for (let x = 0; x < width; x++){
                    const gx = x / size, gy = y / size;
                    const x0 = Math.floor(gx), y0 = Math.floor(gy);
                    const tx = smooth(gx - x0), ty = smooth(gy - y0);
                    const at = (cx, cy) => grid[cy * gridW + cx];
                    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
                    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
                    values[y * width + x] += (top * (1 - ty) + bottom * ty) * weight;
                }
            }
        }
        return values;
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
            9: B.Cave,
        }[type]?.imgsrc;
    }

    updateTileImages(document){
        for (let name in this.tiles){
            const src = this.tileImage(this.tiles[name]);
            const image = document.getElementById(name);
            if (src && image.getAttribute("src") !== String(src)) image.src = String(src);
            // the level badge on upgraded buildings (drawn by CSS from data-level)
            const cell = image.parentElement;
            const level = String(this.tileLevels[name] || 0);
            if (cell && (cell.dataset.level || "0") !== level){
                if (level === "0") delete cell.dataset.level;
                else cell.dataset.level = level;
            }
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
            if (!match || !Number.isInteger(type) || type < 0 || type > 9) continue;
            const index = Number(match[1]);
            const row = Math.floor(index / savedWidth);
            const col = index % savedWidth;
            if (row >= this.mapHeight || col >= this.mapWidth) continue;
            this.tiles["tile" + (row * this.mapWidth + col)] = type;
        }
    }

    // ---------- Upgrading buildings ----------

    // The upgradable building on a tile ("Farm", "Mine", ...), or null
    // The entrance to the underground (tile type 9): every map has exactly one. Maps made before
    // the cave existed get it on a bare rock tile, preferably one next to open ground.
    ensureCave(document){
        const width = this.mapWidth, height = this.mapHeight, count = width * height;
        const caves = [];
        for (let i = 0; i < count; i++) if (this.tiles["tile" + i] === 9) caves.push(i);
        let spot = caves[0];
        for (const extra of caves.slice(1)) this.tiles["tile" + extra] = 3;
        if (spot === undefined){
            const open = (i) => i >= 0 && i < count && this.tiles["tile" + i] === 0;
            const rocks = [];
            for (let i = 0; i < count; i++){
                if (this.tiles["tile" + i] !== 3) continue;
                const x = i % width;
                const near = (x > 0 && open(i - 1)) || (x < width - 1 && open(i + 1)) || open(i - width) || open(i + width);
                rocks.push({ i, near, d: Math.abs(x - width / 2) + Math.abs(Math.floor(i / width) - height / 2) });
            }
            rocks.sort((a, b) => (b.near - a.near) || (a.d - b.d));
            spot = rocks.length ? rocks[0].i : Math.floor(count / 2) + Math.floor(width / 2);
            this.tiles["tile" + spot] = 9;
            delete this.tileLevels["tile" + spot];
        }
        if (document) this.updateTileImages(document);
        return spot;
    }

    upgradeKey(tileId){
        return UPGRADABLE[this.tiles[tileId]] || null;
    }

    levelOf(tileId){
        return this.tileLevels[tileId] || 0;
    }

    // The levels of all buildings of one tile type, in map order
    levelsOf(type){
        const levels = [];
        for (const id in this.tiles){
            if (this.tiles[id] === type) levels.push(this.tileLevels[id] || 0);
        }
        return levels;
    }

    // Everything the upgrade menu shows about a tile
    upgradeInfo(tileId, inventory, familiar){
        const key = this.upgradeKey(tileId);
        if (!key) return null;
        const level = this.levelOf(tileId);
        const atMax = level >= MAX_LEVEL;
        const info = {
            tileId, key, level, max: MAX_LEVEL, atMax,
            name: this.Buildings[key].name,
            now: effectText(key, level),
            next: atMax ? null : effectText(key, level + 1),
            costs: [], canAfford: false,
        };
        if (atMax) return info;

        const price = costFor(key, level);
        const have = {
            wood: inventory.items.wood, iron: inventory.items.iron, bronze: inventory.items.bronze,
            gold: inventory.items.gold, blood: inventory.items.blood, familiars: familiar.getNotWorking(),
        };
        const labels = { wood: "wood", iron: "iron", bronze: "bronze", gold: "gold", blood: "blood", familiars: "free familiars" };
        for (const kind of Object.keys(labels)){
            if (price[kind] > 0) info.costs.push({ kind, label: labels[kind], need: price[kind], have: have[kind], short: have[kind] < price[kind] });
        }
        info.canAfford = info.costs.every((cost) => !cost.short);
        return info;
    }

    // Buys the next level. Returns { ok, message }.
    upgradeTile(tileId, inventory, familiar, updatebox, document){
        const info = this.upgradeInfo(tileId, inventory, familiar);
        if (!info) return { ok: false, message: "There is nothing to upgrade here." };
        if (info.atMax) return { ok: false, message: "This building is fully upgraded." };
        if (!info.canAfford){
            const missing = info.costs.filter((cost) => cost.short).map((cost) => cost.label);
            return { ok: false, message: "You do not have enough " + missing.join(", ") + "." };
        }
        const price = {};
        for (const cost of info.costs) price[cost.kind] = cost.need;
        inventory.useWood(price.wood || 0);
        inventory.useIron(price.iron || 0);
        inventory.useBronze(price.bronze || 0);
        inventory.useGold(price.gold || 0);
        inventory.useBlood(price.blood || 0);
        familiar.notWorking -= price.familiars || 0; // these familiars now work on the upgrade
        const level = info.level + 1;
        this.tileLevels[tileId] = level;
        if (info.key === "Hut") familiar.addMaxLimit(HUT_ROOM_PER_LEVEL);
        if (updatebox) updatebox.townUpdatesAdd("Your " + info.name.toLowerCase() + " was upgraded to level " + level + ".", document);
        return { ok: true, message: info.name + " upgraded to level " + level + "." };
    }

    // ---------- Demolishing buildings ----------
    // Demolishing gives back 70% of the building's price (not of the upgrades). The workers and the
    // familiars that were busy upgrading become free again, and the room the building gave is gone.
    // A mine leaves bare rock and a lumber mill leaves forest, as that is what they were built on.
    demolishInfo(tileId, familiar){
        const key = this.upgradeKey(tileId);
        if (!key) return null;
        const building = this.Buildings[key];
        const level = this.levelOf(tileId);
        const price = typeof building.cost === "object" ? building.cost : { wood: building.cost };
        const refunds = [];
        for (const kind of Object.keys(price)){
            const amount = Math.floor(price[kind] * DEMOLISH_REFUND);
            if (amount > 0) refunds.push({ kind, label: kind, amount });
        }
        let upgradeFamiliars = 0;
        for (let i = 0; i < level; i++) upgradeFamiliars += costFor(key, i).familiars;
        const freed = (building.workersRequired || 0) + upgradeFamiliars;
        const room = (building.capacity || 0) + (key === "Hut" ? level * HUT_ROOM_PER_LEVEL : 0);
        const roomAfter = familiar.getMaxLimit() - room;
        const info = {
            tileId, key, name: building.name, level, refunds, freed, room, roomAfter,
            leaves: { Mine: 3, LumberMill: 6 }[key] ?? 0,
            blocked: null,
        };
        if (roomAfter < familiar.ammount){
            info.blocked = "You have " + familiar.ammount + " familiars, but without this building there would be room for only "
                + roomAfter + ". Free up room first.";
        }
        return info;
    }

    // Returns { ok, message }
    demolishTile(tileId, inventory, familiar, updatebox, document){
        const info = this.demolishInfo(tileId, familiar);
        if (!info) return { ok: false, message: "There is nothing to demolish here." };
        if (info.blocked) return { ok: false, message: info.blocked };
        for (const refund of info.refunds) inventory.items[refund.kind] += refund.amount;
        familiar.notWorking += info.freed;
        familiar.addMaxLimit(-info.room);
        this.Buildings[info.key].ammount = Math.max(0, this.Buildings[info.key].ammount - 1);
        delete this.tileLevels[tileId];
        this.tiles[tileId] = info.leaves;
        this.updateTileImages(document);
        const back = info.refunds.map((refund) => refund.amount + " " + refund.label).join(", ");
        const message = "You demolished your " + info.name.toLowerCase() + (back ? " and recovered " + back + "." : ".");
        if (updatebox) updatebox.townUpdatesAdd(message, document);
        return { ok: true, message };
    }

    // Puts saved levels onto the map (same row/column handling as loadTiles)
    loadTileLevels(saved, savedWidth = 40){
        this.tileLevels = {};
        if (!saved || typeof saved !== "object" || !(savedWidth > 0)) return;
        for (const [name, level] of Object.entries(saved)){
            const match = /^tile(\d+)$/.exec(name);
            if (!match || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) continue;
            const index = Number(match[1]);
            const row = Math.floor(index / savedWidth);
            const col = index % savedWidth;
            if (row >= this.mapHeight || col >= this.mapWidth) continue;
            const id = "tile" + (row * this.mapWidth + col);
            if (this.upgradeKey(id)) this.tileLevels[id] = level;
        }
    }

    update(document){
        this.updateTileImages(document);

        
    }

    updateTen(inv, document, updatebox, familiar){
        this.Buildings.Hut.updateTen(familiar, updatebox);
        this.Buildings.Mine.updateTen(inv, document, updatebox, this.levelsOf(4));
        this.Buildings.Farm.updateTen(inv, document, updatebox, this.levelsOf(5));
        this.Buildings.LumberMill.updateTen(inv, document, updatebox, this.levelsOf(7));
    }

    // Influence multiplier of this round (the Blood Temple's blessing).
    // Call once per round, before the house counts the influence.
    // A new blessing consumes part of the player's blood (inventory).
    influenceMultiplier(document, updatebox, inventory){
        return this.Buildings.BloodTemple.updateTen(document, updatebox, inventory, this.levelsOf(8));
    }

    // newGrid(document){
    //     for (i = 0; i < this.gridSize; i++){
    //         document.getElementById("tile1").src = ;
            
    //     }
    // }

}