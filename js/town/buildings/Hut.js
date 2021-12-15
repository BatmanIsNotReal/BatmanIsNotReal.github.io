import Building from "../Building.js";

export default class Hut{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
    }

    checkNewChild(familiar, updatebox){
        for (let i = 0; i < this.ammount; i++){
            let n = this.getRandomInt(0, 100);
            if (n < 2){
                if (familiar.ammount < familiar.maxLimit){
                    familiar.addFamiliar();
                    updatebox.townUpdatesAdd("A human child has been born. It will be in your service.", document);
                }
            }
        }
    }


    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    updateTen(familiar, updatebox){
        this.checkNewChild(familiar, updatebox);
    }

}