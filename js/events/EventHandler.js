import Event from "./Event.js";

export default class EventHandler{
    constructor(){
        this.events = {
            1: new Event("witches about", "a witch has been spotted roaming around the storage.", "SEARCH", "IGNORE",),
            2: new Event("rebel familiar", "a familiar has decided to rebel against you.", "MAKE AN EXAMPLE OF HIM", "LET IT PASS",),
        }
    }

    getRandomEvent(document){
        let len = Object.keys(this.events).length;
        console.log(len);
        let event = this.events[this.getRandomInt(1, Object.keys(this.events).length)].text;
        console.log("event happened");
        alert(event);
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }
}