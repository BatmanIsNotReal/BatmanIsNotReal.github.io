// Every vampire you own makes the next one of the same kind 10% more expensive.
// This keeps the late game from running away: without it blood income doubles every few minutes forever.
// (Change this one number to make the game faster (lower) or slower (higher).)
export const VAMPIRE_PRICE_GROWTH = 1.10;

export default class Vampire{
    // cost: blood price of the first one
    // extraCost: optional { iron, bronze, gold } the first one also costs (the stronger vampires need mined resources too)
    constructor(ammount, cost, gain, influence, extraCost = {}){
        this.ammount = ammount;
        this.baseCost = cost;
        this.baseExtraCost = { iron: 0, bronze: 0, gold: 0, ...extraCost };
        this.gain = gain;
        this.influence = influence;
    }

    //Getters
    getAmmount(){
        return this.ammount;
    }

    // The price follows from how many you own (so it is also right after loading a save)
    scaledPrice(base){
        return Math.ceil(Number((base * Math.pow(VAMPIRE_PRICE_GROWTH, this.ammount)).toFixed(6)));
    }

    // Blood price of the next one
    get cost(){
        return this.scaledPrice(this.baseCost);
    }

    getCost(){
        return this.cost;
    }

    // Everything the next one costs: { blood, iron, bronze, gold }
    getPrices(){
        const extra = this.baseExtraCost;
        return {
            blood: this.cost,
            iron: this.scaledPrice(extra.iron),
            bronze: this.scaledPrice(extra.bronze),
            gold: this.scaledPrice(extra.gold),
        };
    }

    canAfford(inventory){
        const price = this.getPrices();
        return Object.keys(price).every((kind) => inventory.items[kind] >= price[kind]);
    }

    getGain(){
        return this.gain;
    }

    getInfluence(){
        return this.influence;
    }

    //Adders
    addVampire(inventory, account){
        const price = this.getPrices(); // the prices before this one is added
        if (this.canAfford(inventory)){
            this.ammount++;
            inventory.useBlood(price.blood);
            inventory.useIron(price.iron);
            inventory.useBronze(price.bronze);
            inventory.useGold(price.gold);
            account.addBloodPerRoundGain(this.gain);
            account.addInfluence(this.influence);
            return true;
        }
        return false;

    }

    addInfluence(gain){
        this.influence = this.influence + gain;
    }

    //Buying vampire - maybe

}