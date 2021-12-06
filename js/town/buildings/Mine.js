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

    checkForLoot(inv){
        var chance = this.getRandomInt(0, 1000);
        console.log(chance);
        if (chance <= 300){
            //your miners discovered an ore of iron
            alert("Your miners have found iron!");
            inv.addIron(this.getRandomInt(10, 100));
        }
        if (chance <= 100){
            //your miners discovered a branch of bronze
            alert("Your miners have found bronze!");
            inv.addBronze(this.getRandomInt(5, 25));
        }
        if (chance <=25){
            //your miners discovered a branch of gold
            alert("Your miners have found gold!");
            inv.addGold(this.getRandomInt(2, 20));
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(inv){
        checkForLoot(inv);
    }
}