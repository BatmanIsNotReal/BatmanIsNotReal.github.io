import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";

export default class Mine{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
        this.workers = 0;
    }

    displayMenu(){
        var header = "MINE";

    }

    checkForLoot(inv, document, updatebox){
        for (let i = 0; i < this.ammount; i++){
            var chance = this.getRandomInt(0, 1000);
            console.log(chance);
            if (chance <= 300){
                //your miners discovered an ore of iron
                var ammount = this.getRandomInt(10, 30);
                updatebox.townUpdatesAdd("Your miners have found " + ammount + " nodes of iron.", document);
                inv.addIron(ammount);
            }
            if (chance <= 100){
                //your miners discovered a branch of bronze
                var ammount = this.getRandomInt(5, 20);
                updatebox.townUpdatesAdd("Your miners have found " + ammount + " nodes of bronze.", document);
                inv.addBronze(ammount);
            }
            if (chance <=25){
                //your miners discovered a branch of gold
                var ammount = this.getRandomInt(2, 12);
                updatebox.townUpdatesAdd("Your miners have found " + ammount + " nodes of gold.", document);
                inv.addGold(ammount);
            }
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }


    updateTen(inv, document, updatebox){
        this.checkForLoot(inv, document, updatebox);
    }
}