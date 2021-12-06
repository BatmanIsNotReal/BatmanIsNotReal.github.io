export default class HousePar {
    constructor(houseSize, xpRates, houseImages){
        this.houseImages = houseImages;
        this.houseSize = houseSize;
        this.xpRates = xpRates;
        this.xp = 0;
        this.currentSize = 0;
        this.xpNext = xpRates[this.currentSize + 1];
        this.currentHouse = houseSize[this.currentSize];
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
    updateXP(account){
        this.xp = (this.xp + account.influence) + 1;
		if(this.xp >= this.xpNext){
			this.currentSize = this.currentSize + 1;
			this.xpNext = this.xpRates[this.currentSize + 1];
			this.currentHouse = this.houseSize[this.currentSize];
            this.fire.getPercent();
		}
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
		document.getElementById("#fireProgressBar").style.width = this.fire.percent + "%";
    }

    updateFireImage(document){
        document.getElementById("#fireProgressBar").style.width = this.fire.percent + "%";
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

    updateTen(account, document){
        this.updateImage();
        this.updateFire(document);
        this.updateXP(account);
    }
}