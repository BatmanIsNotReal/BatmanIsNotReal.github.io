import {Building} from '../Building.js';

export default class Grass extends Building{
    constructor(name, description, capacity, imgsrc){
        super(name, description, capacity);
        this.name = "grass";
        this.description = "grass";
        this.capacity = 0;
        this.imgsrc = '../../../src/grass.png'; 
    }
}