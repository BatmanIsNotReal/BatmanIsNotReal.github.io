// The Blood Temple: a place of worship to thy master.
// Every round each temple has a 10% chance to start a blessing that boosts the
// influence the house gains by 25% for 3 rounds. The master asks for a sacrifice:
// 20% of the player's blood is consumed each time a blessing starts.
export default class BloodTemple{
    constructor(name, description, capacity, imgsrc, cost, workersRequired){
        this.name = name;
        this.description = description;
        this.capacity = capacity;
        this.ammount = 0;
        this.cost = cost;                    // { wood, iron, bronze, gold }
        this.imgsrc = imgsrc;
        this.workersRequired = workersRequired;
        this.blessingChance = 0.10;          // per temple, per round
        this.blessingBoost = 1.25;           // +25% influence
        this.blessingRounds = 3;
        this.blessingRoundsLeft = 0;
        this.bloodSacrifice = 0.20;          // share of the player's blood consumed by a blessing
    }

    // Runs once per round, before the influence of that round is counted.
    // Returns the influence multiplier for this round (1 when there is no blessing).
    updateTen(document, updatebox, inventory){
        if (this.ammount < 1){
            this.blessingRoundsLeft = 0;
            return 1;
        }
        if (this.blessingRoundsLeft < 1){
            for (let i = 0; i < this.ammount; i++){
                if (Math.random() < this.blessingChance){
                    this.blessingRoundsLeft = this.blessingRounds;
                    const sacrificed = Math.floor(inventory.items.blood * this.bloodSacrifice);
                    inventory.useBlood(sacrificed);
                    updatebox.townUpdatesAdd("Your master smiles upon the Blood Temple! Influence gain +25% for " + this.blessingRounds + " rounds. The temple consumed " + sacrificed + " blood (20%).", document);
                    break;
                }
            }
        }
        if (this.blessingRoundsLeft < 1) return 1;

        this.blessingRoundsLeft--;
        if (this.blessingRoundsLeft === 0){
            updatebox.townUpdatesAdd("The blessing of the Blood Temple has faded.", document);
        }
        return this.blessingBoost;
    }
}
