import {Building} from '../Building.js';

export default class Hut extends Building{
    constructor(name, description, capacity, imgsrc, cost){
        super(name, description, capacity);
        this.ammount = 0;
        this.cost = cost;
        this.imgsrc = imgsrc; 
    }

    getTest(){
        alert("yes");
    }
}