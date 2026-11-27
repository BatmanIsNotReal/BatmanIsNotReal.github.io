import Building from "../Building.js";

export default class Hut{
    constructor(name, description, capacity, imgsrc, cost){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
        this.birthPercent = 2; // chance per round that a child is born
    }

    // One line for all children born this round
    checkNewChild(familiar, updatebox){
        let born = 0;
        for (let i = 0; i < this.ammount; i++){
            let n = this.getRandomInt(0, 100);
            if (n < this.birthPercent){
                if (familiar.ammount < familiar.maxLimit){
                    familiar.addFamiliar();
                    born++;
                }
            }
        }
        if (born > 0){
            updatebox.townUpdatesAdd(born === 1 ? "A human child has been born. It will be in your service."
                : born + " human children have been born. They will be in your service.", document);
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