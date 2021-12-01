import Grass from "./buildings/Grass";

export default class Building{
    constructor(name, description, capacity, imgsrc){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.imgsrc = imgsrc;

        this.grass = new Grass();
    }

    update(document, id){
        document.getElementById(id).src = "../../src/grass.png";
    }

}