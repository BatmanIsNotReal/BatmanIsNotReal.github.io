export default class HousePar{
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
    }

    //Getters
    xpReturnDisplay(){
        return String(xp + "/" + xpNext);
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
    updateXP(){
        this.xp = (this.xp + Account.influence) + 1;
		if(this.xp >= this.xpNext){
			this.currentSize = this.currentSize + 1;
			this.xpNext = this.xpRates[this.currentSize];
			this.currentHouse = this.houseSize[this.currentSize];
		}
    }

    updateImage(document){
        document.getElementById("house").src = String(this.houseImages[this.currentSize]);
    }

    updateFire(document){
        this.fire.percent = this.fire.percent - this.fire.getRate();
		if (this.fire.percent == 10){
			alert("The fire is running out!");
		}
		document.getElementById("#fireProgressBar").style.width = this.fire.percent + "%";
    }

    update(){
        this.getXP();
        this.updateImage();
    }
}