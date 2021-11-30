

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

    

    update(Inv){
        this.gatherHumanFood(Inv);
        this.gatherBloodVictim(Inv);
        this.eat(Inv);
    }
}