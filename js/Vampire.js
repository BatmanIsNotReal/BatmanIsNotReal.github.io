// Every vampire you own makes the next one of the same kind 10% more expensive.
// This keeps the late game from running away: without it blood income doubles every few minutes forever.
// (Change this one number to make the game faster (lower) or slower (higher).)
export const VAMPIRE_PRICE_GROWTH = 1.10;

export default class Vampire{
    constructor(ammount, cost, gain, influence){
        this.ammount = ammount;
        this.baseCost = cost;   // the price of the first one
        this.gain = gain;
        this.influence = influence;
    }

    //Getters
    getAmmount(){
        return this.ammount;
    }

    // The price follows from how many you own (so it is also right after loading a save)
    get cost(){
        return Math.ceil(Number((this.baseCost * Math.pow(VAMPIRE_PRICE_GROWTH, this.ammount)).toFixed(6)));
    }

    getCost(){
        return this.cost;
    }

    getGain(){
        return this.gain;
    }

    getInfluence(){
        return this.influence;
    }

    //Adders
    addVampire(inventory, account){
        const price = this.cost; // the price before this one is added
        if (inventory.items.blood >= price){
            this.ammount++;
            inventory.useBlood(price);
            account.addBloodPerRoundGain(this.gain);
            account.addInfluence(this.influence);
        }

    }

    addInfluence(gain){
        this.influence = this.influence + gain;
    }

    //Buying vampire - maybe

}