export default class Timers{
    constructor(){
        this.resetTime = 9;
    }

    countDownTenSec(){
        if (this.resetTime > 0){
            this.resetTime--;
        }else{
            this.resetTime = 9;
        }
    }
}