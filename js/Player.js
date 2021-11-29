export default class Player{
    constructor(vName, hName){
        this.vampireName = vName;
        this.houseName = hName;
        this.playedBefore = 0;
        this.vampiresAmmount = 0;
        this.influence = 0;
        this.bloodPerRoundGain = 0;
    }

    //Getters
    getInfluence(){
        return this.influence;
    }

    getPlayedBefore(){
        return this.playedBefore;
    }

    getVampiresAmmount(){
        return this.vampiresAmmount;
    }

    getBloodPerRoundGain(){
        return this.bloodPerRoundGain;
    }

    getVampireName(){
        return this.vampireName;
    }

    getHouseName(){
        return this.houseName;
    }

    //adders
    addInfluence(gain){
        this.influence = Math.round(this.influence + gain);
    }

    addBloodPerRoundGain(gain){
        this.bloodPerRoundGain = this.bloodPerRoundGain + gain);
    }

}