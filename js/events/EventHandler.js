import Event from "./Event.js";

export default class EventHandler{
    constructor(){
        this.events = {
            1: new Event("witches about", "a witch has been spotted roaming around the storage.", "SEARCH", "IGNORE",),
        }
    }

    getRandomEvent(document){
        var event = this.events[this.getRandomInt(0, Object.keys(this.events).length)];
        console.log("event happened");
        alert(event.text);
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }
}