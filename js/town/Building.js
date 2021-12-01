import Grass from "./buildings/Grass";
import Hut from "./buildings/Hut";

export default class Building{
    constructor(name, description, capacity, imgsrc){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.imgsrc = imgsrc;

    }

    update(document, id){
        document.getElementById(id).src = "../../src/grass.png";
    }

}