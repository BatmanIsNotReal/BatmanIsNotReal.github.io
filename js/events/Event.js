export default class Event{
    constructor(header, text, optionOne, optionTwo, conOne, conTwo){
        this.header = header;
        this.text = text;
        this.optionOne = optionOne;
        this.optionTwo = optionTwo;
        this.conOne = conOne;
        this.conTwo = conTwo;
        this.conOneText = "";
        this.conTwoText = "";
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }
}