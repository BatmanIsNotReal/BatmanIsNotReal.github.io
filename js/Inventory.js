import Familiar from './Familiar.js';

export default class Inventory{
    constructor(){
        this.items = {
            blood: 10,
            humanFood: 10,
            wood: 30,
            iron: 0,
            stone: 0,
            bronze: 0,
            gold: 0,
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

    getIronAmmount(){
        return this.items.iron;
    }

    getBronzeAmmount(){
        return this.items.bronze;
    }

    getGoldAmmount(){
        return this.items.gold;
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

    addIron(ammount){
        this.items.iron = this.items.iron + ammount;
    }

    addStone(ammount){
        this.items.stone = this.items.stone + ammount;
    }

    getStoneAmmount(){
        return this.items.stone;
    }

    addBronze(ammount){
        this.items.bronze = this.items.bronze + ammount;
    }

    addGold(ammount){
        this.items.gold = this.items.gold + ammount;
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

    useIron(ammount){
        this.items.iron = this.items.iron - ammount;
    }

    useBronze(ammount){
        this.items.bronze = this.items.bronze - ammount;
    }

    useGold(ammount){
        this.items.gold = this.items.gold - ammount;
    }

    // Takes `ammount` single items, each from a random kind of storage (never below 0).
    useRandomItems(ammount){
        const names = Object.keys(this.items);
        for (let i = 0; i < ammount; i++){
            const name = names[this.getRandomInt(0, names.length)];
            this.items[name] = Math.max(0, this.items[name] - 1);
        }
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

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }
}