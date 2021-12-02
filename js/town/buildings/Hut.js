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

    getTest(){
        alert("yes");
    }
}