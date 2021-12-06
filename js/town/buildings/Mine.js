import Building from "../Building.js";

export default class Mine{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
    }

    displayMenu(){
        var header = "MINE";

    }

    checkForLoot(inv, town){
        var chance = this.getRandomInt(0, 1000);
        if (chance <= 300){
            //your miners discovered an ore of iron
            
        }
        if (chance <= 100){
            //your miners discovered a branch of bronze
        }
        if (chance <=25){
            //your miners discovered a branch of gold
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(){
        checkForLoot();
    }
}