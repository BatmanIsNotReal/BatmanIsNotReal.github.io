export default class MusicHandler{
    constructor(){
        this.backgroundMusic = new Audio('music\bgMusic.mp3');
        this.backgroundMusic.loop = true;
    }

    playBackgroundMusic(){
        this.backgroundMusic.play();
    }
}
