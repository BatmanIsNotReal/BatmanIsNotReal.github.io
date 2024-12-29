export default class MusicHandler{
    constructor(){
       

        this.buyVampire = new Audio('https://github.com/BatmanIsNotReal/BatmanIsNotReal.github.io/blob/e667297a116dc6971f72c825c29d008549b62549/music/sounds/strigoiBought.mp3');
    }

    

    playBuyVamp(){
        this.buyVampire.play();
    }


}
