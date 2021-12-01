import Familiar from './Familiar.js';

export default class Inventory{
    constructor(){
        this.items = {
            blood: 10,
            humanFood: 10,
            wood: 10,
        }
        this.newHumanFoodPerRound = 0;
        this.newBloodPerRound = 0;
        this.newWoodPerRound = 0;
    }

    //Getters
    getHumanFoodPerRound(familiar){
        var n = (familiar.foodGather * familiar.foodGatherGain);
        this.newHumanFoodPerRound = n;
        return n;
    }

    getWoodPerRound(familiar){
        var n = (familiar.woodGather * familiar.woodGatherGain);
        this.newWoodPerRound = n;
        return n;
    }

    getBloodPerRound(familiar, account){
        var n = (familiar.bloodGather * familiar.bloodGatherGain) + account.bloodPerRoundGain;
        this.newBloodPerRound = n;
        return n;
    }

    getNewHumanFoodPerRound(){
        return this.newHumanFoodPerRound;
    }

    getNewBloodPerRound(){
        return this.newBloodPerRound;
    }

    getNewWoodPerRound(){
        return this.newWoodPerRound;
    }

    getBloodAmmount(){
        return Math.floor(this.items.blood);
    }

    getHumanFoodAmmount(){
        return this.items.humanFood;
    }

    getWoodAmmount(){
        return this.items.wood;
    }

    //Adders

    addBlood(ammount){
        this.items.blood = this.items.blood + ammount;
    }

    addHumanFood(ammount){
        this.items.humanFood = this.items.humanFood + ammount;
    }

    addWood(ammount){
        this.items.wood = this.items.wood + ammount;
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
    updateItems(){
        this.addBlood(this.newBloodPerRound);
        this.addHumanFood(this.newHumanFoodPerRound);
        this.addWood(this.newWoodPerRound);
    }

    updateOne(Familiar, account){
        this.getBloodAmmount();
        this.getBloodPerRound(Familiar, account);
        this.getHumanFoodPerRound(Familiar);
        this.getWoodPerRound(Familiar);
    }

    updateTen(){
        this.updateItems();
    }
}