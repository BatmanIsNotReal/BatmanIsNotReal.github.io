import Event from "./Event.js";

// Random events. They start gentle and get harsher with the player's level:
//   witch:     takes 1% of every kind of storage at level 1, 2% at level 5, 3.3% at level 10, 5.8% at level 20
//              (at most 6%) when she escapes your search, and half as much again if you ignore her
//   rebel:     1 familiar lost at levels 1-2 when ignored, one more for every 3 levels (more if the search fails)
//   sirens:    1 familiar lost at level 1, one more for every 2 levels
//   A single event never takes more than half of the familiars (and at least 1).
// Killing the witch pays 3% of one kind of storage (at least 10 per level).
const WITCH_MAX_PERCENT = 6;
const witchPercent = (level) => Math.min(WITCH_MAX_PERCENT, 1 + 0.25 * (level - 1));
const WITCH_IGNORED_FACTOR = 1.5;
const WITCH_STASH_PERCENT = 3;

const ITEM_NAMES = {blood: "blood", humanFood: "human food", wood: "wood", iron: "iron", bronze: "bronze", gold: "gold"};

// Takes `percent`% of every kind of storage. Returns e.g. "12 wood, 3 iron" (or "nothing of value").
function takePercent(inventory, percent){
    const parts = [];
    for (const [kind, name] of Object.entries(ITEM_NAMES)){
        const taken = Math.floor(inventory.items[kind] * percent / 100);
        if (taken > 0){
            inventory.items[kind] -= taken;
            parts.push(taken + " " + name);
        }
    }
    return parts.length ? parts.join(", ") : "nothing of value";
}

// Takes familiars and returns a sentence about it. One event never takes more than
// half of the familiars (at least 1), however high the level is.
function loseFamiliars(familiars, count){
    const cap = Math.max(1, Math.ceil(familiars.ammount / 2));
    const lost = familiars.loseFamiliars(Math.min(count, cap));
    if (lost === 0) return "You had no familiars to lose.";
    return "You lost " + lost + (lost === 1 ? " familiar." : " familiars.");
}

export default class EventHandler{
    // inventory, familiars and house are what the events can take from (and house.level sets how much)
    // onEvent: called when an event pops up (the game plays a sound with it)
    constructor(inventory, familiars, house, onEvent = () => {}){
        this.onEvent = onEvent;
        this.inventory = inventory;
        this.familiars = familiars;
        this.house = house;
        this.events = {
            1: new Event("witches about", "a witch has been spotted roaming around the storage.", "SEARCH", "IGNORE",
                function conOne(game){
                    if (this.getRandomInt(0, 100) < 50){
                        // her stash is worth more at higher levels
                        const kinds = ["blood", "humanFood", "wood"];
                        const kind = kinds[this.getRandomInt(0, kinds.length)];
                        const reward = Math.max(10 * game.level, Math.floor(game.inventory.items[kind] * WITCH_STASH_PERCENT / 100));
                        game.inventory.items[kind] += reward;
                        this.conOneText = "you found and killed the witch. In her hut you find " + reward + " " + ITEM_NAMES[kind] + ".";
                    }else{
                        const taken = takePercent(game.inventory, witchPercent(game.level));
                        this.conOneText = "you found nothing. The witch thief escaped with stolen goods: " + taken + ".";
                    }
                },
                function conTwo(game){
                    const taken = takePercent(game.inventory, witchPercent(game.level) * WITCH_IGNORED_FACTOR);
                    this.conTwoText = "You ignore the witch, and she helps herself to your storage: " + taken + ".";
                }),
            2: new Event("rebel familiar", "a familiar has decided to rebel against you.", "MAKE AN EXAMPLE OF HIM", "LET IT PASS",
                function conOne(game){
                    if (this.getRandomInt(0, 100) < 50){
                        this.conOneText = "you hung the familiar by the neck. The others fall in line. " + loseFamiliars(game.familiars, 1);
                    }else{
                        const count = 2 + Math.floor(game.level / 3);
                        this.conOneText = "the rebel escaped, and some others followed him into the night. " + loseFamiliars(game.familiars, count);
                    }
                },
                function conTwo(game){
                    const count = 1 + Math.floor(game.level / 3);
                    this.conTwoText = "You let the rebel be. The unrest spreads, and some familiars leave. " + loseFamiliars(game.familiars, count);
                }),
            3: new Event("sirens", "a group of sirens have emerged from the waters. Some of your familiars have disappeared.", "SEARCH FOR THE SIRENS", "LET IT PASS",
                function conOne(game){
                    if (this.getRandomInt(0, 100) < 50){
                        this.conOneText = "you found the sirens and retrieved your familiars.";
                    }else{
                        this.conOneText = "you found nothing. The familiars are lost. " + loseFamiliars(game.familiars, 1 + Math.floor(game.level / 2));
                    }
                },
                function conTwo(game){
                    this.conTwoText = "You ignore it, and the familiars are lost. " + loseFamiliars(game.familiars, 1 + Math.floor(game.level / 2));
                }),
        }
    }

    // What an event gets to work with
    get game(){
        return { inventory: this.inventory, familiars: this.familiars, level: this.house.level };
    }

    getRandomEvent(){
        const container = document.getElementById("inner-content-event");
        removeAllChildren(container);
        
        const modaleventbox = document.getElementById("modal-event");

        modaleventbox.style.display = "block";
        this.onEvent();


        // getRandomInt leaves out its upper limit, so +1 or the last event could never be drawn
        let rand = this.getRandomInt(1, Object.keys(this.events).length + 1);
        
        
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
            this.events[rand].conOne(this.game);
            modaleventbox.style.display = "none"
            this.messageBox(this.events[rand].conOneText);
        });
        optionTwo.addEventListener("click", () => {
            this.events[rand].conTwo(this.game);
            modaleventbox.style.display = "none";
            this.messageBox(this.events[rand].conTwoText);
        });
        
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