import * as Building from './Building.js';
import Grass from './buildings/Grass.js';

export default class Town{
    constructor(townSize, xpRates, townImages, buildings){
        this.townSize = townSize;
        this.gridSize = 100; //10x10
        this.gridData = new Array(gridSize);
    }

    newGrid(){
        for (i = 0; i < this.gridSize; i++){
            this.gridData[i] = new Building[Grass];
        }
    }

}