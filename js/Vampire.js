export default class Vampire{
    constructor(ammount, cost, gain, influence){
        this.ammount = ammount;
        this.cost = cost;
        this.gain = gain;
        this.influence = influence;
    }

    //Getters
    getAmmount(){
        return this.ammount;
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
        if (inventory.items.blood >= this.cost){
            this.ammount++;
            inventory.useBlood(this.cost);
            account.addBloodPerRoundGain(this.gain);
            account.addInfluence(this.influence);
        }

    }

    addInfluence(gain){
        this.influence = this.influence + gain;
    }

    //Buying vampire - maybe

}