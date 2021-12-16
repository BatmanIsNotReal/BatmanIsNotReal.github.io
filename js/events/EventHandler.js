import Event from "./Event.js";

export default class EventHandler{
    constructor(){
        this.events = {
            1: new Event("witches about", "a witch has been spotted roaming around the storage.", "SEARCH", "IGNORE", 
                function conOne(){
                    if (this.getRandomInt(0, 100) < 50){
                        this.conOneText = "you found and killed the witch";
                    }else{
                        this.conOneText = "you found nothing. The witch thief is gone";
                    }
                },
                function conTwo(){
                    this.conTwoText = "You ignore the witch, and loose some stuff";
                }),
            2: new Event("rebel familiar", "a familiar has decided to rebel against you.", "MAKE AN EXAMPLE OF HIM", "LET IT PASS",function conOne(){
                if (this.getRandomInt(0, 100) < 50){
                    this.conOneText = "you hung the familiar by the neck.";
                }else{
                    this.conOneText = "the familiar has escaped. Hopefully he got a scare.";
                }
            },
            function conTwo(){
                this.conTwoText = "You let the familiar be. It's harmless anyway.";
            }),
            3: new Event("sirens", "a group of sirens have emerged from the waters. Three of your familiars have dissapeared.", "SEARCH FOR THE SIRENS", "LET IT PASS",function conOne(){
                if (this.getRandomInt(0, 100) < 50){
                    this.conOneText = "you found the sirens and retrieved your familiars.";
                }else{
                    this.conOneText = "you found nothing. The familiars are lost";
                }
            },
            function conTwo(){
                this.conTwoText = "You ignore it, and loose some familiars";
            }),
        }
    }

    getRandomEvent(){
        const container = document.getElementById("inner-content-event");
        removeAllChildren(container);
        
        const modaleventbox = document.getElementById("modal-event");

        modaleventbox.style.display = "block";


        let len = Object.keys(this.events).length;
        console.log(len);
        let rand = this.getRandomInt(1, Object.keys(this.events).length);
        console.log(rand);
        
        
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

        optionOne.addEventListener("click", () => {
            this.events[rand].conOne();
            modaleventbox.style.display = "none"
            this.messageBox(this.events[rand].conOneText);
        });
        optionTwo.addEventListener("click", () => {
            this.events[rand].conTwo();
            modaleventbox.style.display = "none";
            this.messageBox(this.events[rand].conTwoText);
        });
        console.log("event happened");
        
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min);
    }

    messageBox(msg){
        const container = document.getElementById("inner-content-event");
        removeAllChildren(container);
        
        const modaleventbox = document.getElementById("modal-event");
        modaleventbox.style.display = "block";
        const text = document.createElement("p");
        const button = document.createElement("button");
        text.innerHTML = msg;
        button.innerHTML = "close";

        container.appendChild(text);
        container.appendChild(button);

        button.addEventListener("click", () => {
            modaleventbox.style.display = "none";
        });

    }
}


function removeAllChildren(element) {
    while (element.children.length > 0) {
        element.removeChild(element.children[element.children.length - 1]);
    }
}