import Event from "./Event.js";

export default class EventHandler{
    constructor(){
        this.events = {
            1: new Event("witches about", "a witch has been spotted roaming around the storage.", "SEARCH", "IGNORE", 
                function conOne(){
                    if (this.getRandomInt(0, 100) < 50){
                        alert("you found and killed the witch");
                    }else{
                        alert("you found nothing. The witch thief is gone");
                    }
                },
                function conTwo(){
                    alert("You ignore the witch, and loose some stuff");
                }),
            2: new Event("rebel familiar", "a familiar has decided to rebel against you.", "MAKE AN EXAMPLE OF HIM", "LET IT PASS",),
            3: new Event("sirens", "a group of sirens have emerged from the waters. Three of your familiars have dissapeared.", "MAKE AN EXAMPLE OF HIM", "LET IT PASS",),
        }
    }

    getRandomEvent(){
        const container = document.getElementById("modal-event");
        removeAllChildren(container);
        
        let len = Object.keys(this.events).length;
        console.log(len);
        let rand = this.getRandomInt(1, Object.keys(this.events).length);
        console.log(rand);
        
        const container = document.getElementById("modal-event");
        const header = document.createElement("h3");
        header.innerHTML = this.events[rand].header;

        const text = document.createElement("p");
        text.innerHTML = this.events[rand].text;

        const optionOne = document.createElement("button");
        optionOne.innerHTML = this.events[rand].optionOne;

        const optionTwo = document.createElement("button");
        optionTwo.innerHTML = this.events[rand].optionTwo;

        container.appendChild(header);
        container.appendChild(text);
        container.appendChild(optionOne);
        container.appendChild(optionTwo);

        optionOne.addEventListener("click", () => {this.events[rand].conOne();});
        optionTwo.addEventListener("click", () => {this.events[rand].conTwo();});

        console.log("event happened");
        
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }
}


function removeAllChildren(element) {
    while (element.children.length > 0) {
        element.removeChild(element.children[element.children.length - 1]);
    }
}