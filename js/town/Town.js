import * as Building from './Building.js';
import Grass from './buildings/Grass.js';

export default class Town{
    constructor(townSize, xpRates, townImages, buildings){
        this.townSize = townSize;
        this.gridSize = 100; //10x10
        this.gridData = new Array(this.gridSize);
        this.newDiv = new Array(this.gridSize);
        this.buildings = new Building();
    }

    newGrid(){
        for (i = 0; i < this.gridSize; i++){
            this.gridData[i] = new Building[Grass];
        }
    }

}