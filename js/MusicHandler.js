export default class MusicHandler{
    constructor(){
       

        this.buyVampire = new Audio('music\sounds\strigoiBought.mp3');
    }

    

    playBuyVamp(){
        this.buyVampire.play();
    }


}
