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
    addVampire(){
        this.ammount++;
    }

    addInfluence(gain){
        this.influence = this.influence + gain;
    }

    //Buying vampire - maybe

}