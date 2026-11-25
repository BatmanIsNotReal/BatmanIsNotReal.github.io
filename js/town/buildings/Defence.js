// A defence building (watch tower, guard outpost, fort). What it does in a war is worked out in js/raids/.
export default class Defence{
    constructor(name, description, imgsrc, cost, workersRequired, tileType){
        this.name = name;
        this.description = description;
        this.capacity = 0;                 // no room for familiars
        this.imgsrc = imgsrc;
        this.cost = cost;                  // { wood, iron, bronze, gold }
        this.workersRequired = workersRequired; // the familiars that man it
        this.tileType = tileType;
        this.ammount = 0;
    }
}
