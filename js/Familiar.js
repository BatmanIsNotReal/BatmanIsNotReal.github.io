export default class Familiar{
    constructor(ammount, cost, foodGather, foodGatherGain, bloodGather, bloodGatherGain, notWorking){
        this.ammount = ammount;
        this.cost = cost;
        this.foodGather = foodGather;
        this.foodGatherGain = foodGatherGain;
        this.bloodGather = bloodGather;
        this.bloodGatherGain = bloodGatherGain;
        this.notWorking = notWorking;
    }

    //Getters
    getNotWorking(){
        return this.notWorking;
    }

    getHumanFoodGather(){
        return this.foodGather;
    }

    //Adders
    addFamiliar(){
        this.ammount = this.ammount + 1;
        this.notWorking = this.notWorking + 1;
    }

    addHumanFoodGather(n){
        if(n > 0){
			this.foodGather = this.foodGather + (n);
			this.notWorking = this.notWorking - n;
		}
		if(n < 0){
			this.foodGather = this.foodGather + n;
			this.notWorking = this.notWorking - n;
		}
    }

    addBloodGather(n){
        if(n > 0){
			this.bloodGather = this.bloodGather + (n);
			this.notWorking = this.notWorking - n;
		}
		if(n < 0){
			this.bloodGather = this.bloodGather + n;
			this.notWorking = this.notWorking - n;
		}
    }

    //Misc
    adopt(house, inventory, document){
        if (house.xp >= this.cost){
            this.addFamiliar();
            house.useXp(this.cost);
            inventory.getHumanFoodPerRound();
            document.getElementById("humanFoodCount").innerHTML = inventory.items.humanFood;
        }
        document.getElementById("newHumanFoodPerRound").innerHTML = inventory.newHumanFoodPerRound;
    }

    gatherHumanFood(inventory){
        inventory.items.humanFood = inventory.items.humanFood + inventory.newHumanFoodPerRound;
    }

    gatherBloodVictim(inventory){
        inventory.addBlood(this.bloodGather * 2);
    }

    eat(inventory){
        if (inventory.items.humanFood >= 1){
            inventory.items.humanFood = inventory.items.humanFood - this.ammount;
        }
    }

    update(Inv){
        this.gatherHumanFood(Inv);
        this.gatherBloodVictim(Inv);
        this.eat(Inv);
    }
}