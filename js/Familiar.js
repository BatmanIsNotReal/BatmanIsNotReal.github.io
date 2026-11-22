

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
        }
    }

    adopt(house, inventory, updatebox, document){
        if (house.xp >= this.cost){
            if (this.ammount < this.maxLimit){
                this.addFamiliar();
                house.useXp(this.cost);
                inventory.getHumanFoodPerRound(this);
                updatebox.townUpdatesAdd("You've adopted a familiar. \n It can do much hard labour, but remember to feed it.", document);
            }
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
}