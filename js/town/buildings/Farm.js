import Building from "../Building.js";
import updateBox from "../updateBox/updatesBox.js";

export default class Farm{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
        this.workers = 0;
    }

    checkForLoot(inv, document, updatebox){
        for (let i = 0; i < this.ammount; i++){
            var chance = this.getRandomInt(0, 1);
            console.log(chance);
            if (chance < 1){
                //no food
                var ammount = this.getRandomInt(10, 30);
                updatebox.townUpdatesAdd("Your farmers have produced " + ammount + " of human food.", document);
                inv.addHumanFood(ammount);
            }
        }
    }



    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(inv, document, updatebox){

    }
}