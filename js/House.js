export default class HousePar {
    constructor(houseSize, xpRates, houseImages){
        this.houseImages = houseImages;
        this.houseSize = houseSize;
        this.xpRates = xpRates;
        this.xp = 0;        // influence: progress towards the next level
        this.level = 1;
        this.applyLevel(1);
    }

    // Influence needed to get from `level` to the next level.
    // Levels 1-5 use the gaps between the original house milestones
    // (1000, 9000, 40000, 150000, 800000: the same total as before), and every
    // level after that needs 50% more than the one before.
    levelRequirement(level){
        const rates = this.xpRates;
        if (level < rates.length){
            return rates[level] - rates[level - 1];
        }
        const last = rates[rates.length - 1] - rates[rates.length - 2];
        return Math.round(last * Math.pow(1.5, level - rates.length + 1));
    }

    // Sets everything that follows from the level (also used when loading a save).
    applyLevel(level){
        this.level = level;
        this.currentSize = Math.min(level - 1, this.houseSize.length - 1);
        this.currentHouse = this.houseSize[this.currentSize];
        this.xpNext = this.levelRequirement(level);
    }

    fire = {
        percent: 100,
        getRate: () =>{
            return (this.currentSize * 2) + 1;
        },
        getPercent: () =>{
            this.percent = 100 * (this.currentSize + 1);
        }
    }

    //Getters
    xpReturnDisplay(){
        return String(this.xp + "/" + this.xpNext);
    }

    getCurrentHouse(){
        return this.currentHouse = this.houseSize[this.currentSize];
    }

    //Add
    addXp(account){
        this.xp = this.xp + account.influence;
    }

    //Use
    useXp(ammount){
        this.xp = this.xp - ammount;
    }

    //Updates
    // Returns the new level when the player levels up, otherwise null.
    updateXP(account){
        this.xp = (this.xp + account.influence) + 1;
        if (this.xp < this.xpNext) return null;

        const oldSize = this.currentSize;
        this.xp = 0; // influence starts again from 0 at every new level
        this.applyLevel(this.level + 1);
        if (this.currentSize !== oldSize) this.fire.getPercent(); // bigger house: fire is refilled
        return this.level;
    }

    updateImage(){
        return String(this.houseImages[this.currentSize]);
    }


    updateFire(document){
        this.fire.percent = this.fire.percent - this.fire.getRate();
        if(this.fire.percent < 1){
            this.fire.percent = 0;
        }
		if (this.fire.percent == 10){
			alert("The fire is running out!");
		}
		document.getElementById("fireProgressBar").style.width = this.fire.percent + "%";
    }

    updateFireImage(document){
        document.getElementById("fireProgressBar").style.width = this.fire.percent + "%";
    }

    //Maintenance - house
    addWoodToFire(inventory, ammount){
        if (inventory.getWoodAmmount() >= 1){
            this.fire.getPercent();
            this.fire.percent = this.fire.percent + (25 * ammount);
            inventory.useWood(ammount);
            if (this.fire.percent > 99){
                this.fire.percent = 100;
            }
        }
    }

    updateOne(document){
        this.xpReturnDisplay();
        this.updateFireImage(document);
    }

    // Returns the new level when the player levels up, otherwise null.
    updateTen(account, document){
        this.updateImage();
        this.updateFire(document);
        return this.updateXP(account);
    }
}