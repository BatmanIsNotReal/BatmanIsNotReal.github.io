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

    checkForLoot(inv, document){
        for (let i = 0; i < this.ammount; i++){
            var chance = this.getRandomInt(0, 1000);
            console.log(chance);
            if (chance <= 300){
                //your miners discovered an ore of iron
                var ammount = this.getRandomInt(10, 100);
                this.townUpdatesAdd("Your miners have found " + ammount + " nodes of iron.");
                inv.addIron(ammount);
            }
            if (chance <= 100){
                //your miners discovered a branch of bronze
                var ammount = this.getRandomInt(5, 25);
                this.townUpdatesAdd("Your miners have found " + ammount + " nodes of bronze.");
                inv.addBronze(ammount);
            }
            if (chance <=25){
                //your miners discovered a branch of gold
                var ammount = this.getRandomInt(2, 20);
                this.townUpdatesAdd("Your miners have found " + ammount + " nuggets of gold.");
                inv.addGold(ammount);
            }
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    townUpdatesAdd(textnode, document){
        var node = document.createElement("LI");
        var textNode = document.createTextNode(textnode);
        node.appendChild(textNode);
        document.getElementById("townUpdates").appendChild(node);
    }

    updateTen(inv, document){
        this.checkForLoot(inv, document);
    }
}