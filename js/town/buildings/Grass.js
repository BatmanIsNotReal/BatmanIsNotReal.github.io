import Building from "../Building.js";

export default class Grass{
    constructor(name, description, capacity, imgsrc){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.imgsrc = imgsrc; 
        
    }

    getTest(){
        alert("yes");
    }
}