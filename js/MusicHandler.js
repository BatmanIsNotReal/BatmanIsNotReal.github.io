export default class MusicHandler{
    constructor(){
        this.backgroundMusic = new Audio('music\bgMusic.mp3');
        this.backgroundMusic.loop = true;

        this.buyVampire = new Audio('music\sounds\buildSound.mp3');
    }

    playBackgroundMusic(){
        this.backgroundMusic.play();
    }

    playBuildSound(){
        this.buyVampire.play();
    }


}
