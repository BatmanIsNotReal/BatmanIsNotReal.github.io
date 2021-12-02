

export default class Familiar{
    constructor(ammount, cost, foodGather, foodGatherGain, bloodGather, bloodGatherGain, woodGather, woodGatherGain, notWorking){
        this.ammount = ammount;
        this.cost = cost;
        this.foodGather = foodGather;
        this.foodGatherGain = foodGatherGain;
        this.bloodGather = bloodGather;
        this.bloodGatherGain = bloodGatherGain;
        this.woodGather = woodGather;
        this.woodGatherGain = woodGatherGain;
        this.notWorking = notWorking;
        this.fireGuard = 0;
        this.maxLimit = 4;
    }

    //Getters
    getNotWorking(){
        return this.notWorking;
    }

    getHumanFoodGather(){
        return this.foodGather;
    }

    getBloodGather(){
        return this.bloodGather;
    }

    getWoodGather(){
        return this.woodGather;
    }

    getCost(){
        return this.cost;
    }

    getMaxLimit(){
        return this.maxLimit;
    }

    //Adders
    addFamiliar(){
        this.ammount = this.ammount + 1;
        this.notWorking = this.notWorking + 1;
    }

    addMaxLimit(ammount){
        this.maxLimit = this.maxLimit + ammount;
    }

    addGather(n){
        if (this.notWorking >= 1){
            if (n == 'humanFoodGather'){
                this.foodGather++;
                this.notWorking--;
            }else if (n == 'bloodGather'){
                this.bloodGather++;
                this.notWorking--;
            }else if (n == 'woodGather'){
                this.woodGather++;
                this.notWorking--;
            }else if (n == 'fireGuard'){
                this.fireGuard++;
                this.notWorking--;
            }
        }
    }

    removeGather(n){
        if (n == 'humanFoodGather'){
            if (this.foodGather >= 1){
                this.foodGather--;
                this.notWorking++;
            }
        }else if (n == 'bloodGather'){
            if (this.bloodGather >= 1){
                this.bloodGather--;
                this.notWorking++;
            }
        }else if (n == 'woodGather'){
            if (this.woodGather >= 1){
                this.woodGather--;
                this.notWorking++;
            }
        }else if(n == 'fireGuard'){
            if (this.fireGuard >= 1){
                this.fireGuard--;
                this.notWorking++;
            }
        }
    }

    adopt(house, inventory){
        if (house.xp >= this.cost){
            this.addFamiliar();
            house.useXp(this.cost);
            inventory.getHumanFoodPerRound(this);
        }
    }


    //Loop actions
    eat(inventory){
        if (inventory.items.humanFood >= 1){
            inventory.useHumanFood(this.ammount);
        }else{
            alert("You ran out of human food, and a familiar has died");
            this.ammount--;
        }
    }

    addWoodToFire(inv, house){
        if (inv.items.wood >= 1){
            house.addWoodToFire(inv, this.fireGuard);
        }
    }

    // gatherFood(inventory){
    //     inventory.newHumanFoodPerRound = (this.foodGather * this.foodGatherGain);
    // }

    // gatherBlood(inventory){
    //     inventory.newBloodPerRound = (this.bloodGather * this.bloodGatherGain);
    //}

    //Misc

    update(Inv){
        this.eat(Inv);
        this.getMaxLimit();
    }

    updateMin(house, inv){
        this.addWoodToFire(inv, house);
    }
}