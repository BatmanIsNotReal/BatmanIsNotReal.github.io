import Familiar from './Familiar';

export default class Inventory{
    constructor(){
        this.items = {
            blood: 10,
            humanFood: 10,
            wood: 10,
        }
        this.newHumanFoodPerRound = 0;
        this.newBloodPerRound = 0;
    }

    //Getters
    getHumanFoodPerRound(foodGather, foodGatherGain){
        var n = (foodGather * foodGatherGain);
        this.newHumanFoodPerRound = n;
        return n;
    }

    getBloodPerRound(bloodGather, bloodGatherGain, bloodPerRoundGain){
        var n = (bloodGather * bloodGatherGain) + bloodPerRoundGain;
        this.newBloodPerRound = n;
        return n;
    }

    getNewHumanFoodPerRound(){
        return this.newHumanFoodPerRound;
    }

    getNewBloodPerRound(){
        return this.newBloodPerRound;
    }

    getBloodAmmount(){
        this.items.blood = Math.floor(this.items.blood);
        return this.items.blood;
    }

    getHumanFoodAmmount(){
        return this.items.humanFood;
    }

    getWoodAmmount(){
        return this.items.wood;
    }

    //Adders
    addBloodPerRound(gain){
        this.newBloodPerRound = this.newBloodPerRound + gain;
    }

    addBlood(ammount){
        this.items.blood = this.items.blood + ammount;
    }

    //Use/consume
    useBlood(ammount){
        this.items.blood = this.items.blood - ammount;
    }

    useHumanFood(ammount){
        this.items.humanFood = this.items.humanFood - ammount;
    }

    useWood(ammount){
        this.items.wood = this.items.wood - ammount;
    }

    

    //Updates
    updateBlood(){
        this.addBlood(this.newBloodPerRound);
    }

    updateOne(){
        this.getBloodAmmount();
        this.getBloodPerRound();
        this.getHumanFoodPerRound();
    }

    updateTen(){
        this.updateBlood();
    }
}