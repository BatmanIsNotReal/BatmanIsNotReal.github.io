export default class Timers{
    constructor(){
        this.resetTime = 10;
    }

    countDownTenSec(){
        if (this.resetTime > 0){
            this.resetTime--;
        }else{
            this.resetTime = 10;
        }
    }
}