import Player from './js/Player.js';
import Inventory from './js/Inventory.js';
import Vampire from './js/Vampire.js';
import Familiar from './js/Familiar.js';
import HousePar from './js/House.js';
import Timers from './js/Timers.js';
import Town from './js/town/Town.js';
import UpdateBox from './js/town/updateBox/updatesBox.js';
import Upgrade from './js/upgrades/Upgrade.js';
import EventHandler from './js/events/EventHandler.js';
import MusicHandler from './js/MusicHandler.js';
import Chat from './js/chat/Chat.js';
import PlayerSync from './js/playerSync.js';
import Leaderboard from './js/leaderboard/Leaderboard.js';
import { CHAT_API_URL, PLAYER_API_URL, LEADERBOARD_API_URL } from './js/chat/chatConfig.js';

//Init data
const houseSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];
const xpRates = [0, 1000, 10000, 50000, 200000, 1000000];
const houseImages = ["src/smallHut.png", "src/house2.png"];

//game basics - inventory, player 
let Inv = new Inventory();
const Account = new Player("", "");
let signedUp = false; // true once the player has chosen their names
let myTown = new Town(houseSize, xpRates);
const Upgrades = new Upgrade();

let updateBox = new UpdateBox(10, 0);

let eventHandler = new EventHandler(Inv);

let musicHandler = new MusicHandler(document.getElementById("backgroundMusic"), document.getElementById("muteButton"));
musicHandler.start();







//vampires vars
let Mosquito = new Vampire(0, 10, 0.1, 0.1);
let VampireRat = new Vampire(0, 20, 0.3, 0.3);
let VampireBat = new Vampire(0, 30, 0.6, 0.6);
let BloodHound = new Vampire(0, 100, 2, 0.8);
let VampireSlave = new Vampire(0, 400, 10, 1);
let NightWalker = new Vampire(0, 1000, 30, 5);
let Badabook = new Vampire(0, 3000, 100, 8);
let Draugr = new Vampire(0, 10000, 350, 12);
let Strigoi = new Vampire(0, 30000, 700, 18);

let Overloard = new Vampire(0, 1000000, 3000, 40);


const vampireTypes = {
    "mosquito": Mosquito,
    "vampireRat": VampireRat,
	"vampireBat": VampireBat,
    "bloodHound": BloodHound,
    "vampireSlave": VampireSlave,
    "nightWalker": NightWalker,
	"badabook": Badabook,
	"draugr": Draugr,
	"strigoi": Strigoi,
	"overloard": Overloard,
}

//Map
myTown.createTiles(document);

//familiar vars
let Familiars = new Familiar(0, 500, 0, 2, 0, 2, 0, 2, 0);

//Timers
const Timer = new Timers();

//house 
let House = new HousePar(houseSize, xpRates, houseImages);

var modal = document.getElementById("myModal");
var span = document.getElementById("close");
let currentTile = "";
const drinkBloodButton = document.getElementById("drinkBlood");
const buyVampireButtons = document.getElementsByClassName("buy-vamp-button");
const adoptFamiliarButton = document.getElementById("adoptFamiliar");
const addGatherButtons = document.getElementsByClassName("add-gather-button");
const removeGatherButtons = document.getElementsByClassName("remove-gather-button");

const buyBuildingButtons = document.getElementsByClassName("buy-building-button");

const buyUpgradeButtons = document.getElementsByClassName("buy-upgrade-button");

const tiles = document.getElementsByClassName("tile");


const addWoodButton = document.getElementById("addWoodFire");

const restartButton = document.getElementById("restart");

//buy vampire check
for (let i = 0; i < buyVampireButtons.length; i++) {
	buyVampireButtons[i].addEventListener("click", (event) => {
		vampireTypes[event.currentTarget.id].addVampire(Inv, Account);
		musicHandler.playBuyVamp();
	})
}

// open modal box
for (let i = 0; i < tiles.length; i++){
	tiles[i].addEventListener("click", () => {currentTile = tiles[i].id; modal.style.display = "block"});
}
span.addEventListener("click", () => {modal.style.display = "none"});
window.addEventListener("click", (event) => {if (event.target == modal){modal.style.display = "none"}});

//buy buildings check
const buildingActions = {
	buyHut: (id) => myTown.buyHut(Inv, Familiars, document, currentTile, id),
	buyMine: (id) => myTown.buyMine(Inv, Familiars, document, currentTile, id),
	buyFarm: (id) => myTown.buyFarm(Inv, Familiars, document, currentTile, id),
	buyLumberMill: (id) => myTown.buyLumberMill(Inv, Familiars, document, currentTile, id),
};

for (const button of buyBuildingButtons){
	button.addEventListener("click", (event) => {
		const id = event.currentTarget.id;
		if (!buildingActions[id]) return;
		buildingActions[id](id);
		modal.style.display = "none";
	})
}

//Buy upgrades check
const upgradeActions = {
	ironHoe: () => Upgrades.buyIronHoe(Inv, updateBox, myTown.Buildings.Farm),
	ironAxe: () => Upgrades.buyIronAxe(Inv, updateBox, myTown.Buildings.LumberMill),
	ironPick: () => Upgrades.buyIronPick(Inv, updateBox, myTown.Buildings.Mine),
};

for (const button of buyUpgradeButtons){
	button.addEventListener("click", (event) => {
		const action = upgradeActions[event.currentTarget.id];
		if (action) action();
	})
}

addWoodButton.addEventListener("click", () => {House.addWoodToFire(Inv, 1);})

drinkBloodButton.addEventListener("click", () => { document.getElementById("bloodCount").innerHTML = Math.floor(++Inv.items.blood); })

adoptFamiliarButton.addEventListener("click", () => { Familiars.adopt(House, Inv, updateBox, document); })

for (const button of addGatherButtons){
	button.addEventListener("click", (event) => Familiars.addGather(event.currentTarget.dataset.gather));
}
for (const button of removeGatherButtons){
	button.addEventListener("click", (event) => Familiars.removeGather(event.currentTarget.dataset.gather));
}
restartButton.addEventListener("click", () => {
	if (confirm("Delete your save and start a new game?")) deleteSave();
})

//Chat (a broken chat must never stop the game from starting)
let chat = null;
try {
	chat = new Chat(CHAT_API_URL);
	chat.start();
} catch (error) {
	console.error("Chat could not start:", error);
}

//Player file (names and stats are also kept on the server)
const playerSync = new PlayerSync(PLAYER_API_URL);

//Leaderboard
try {
	new Leaderboard(LEADERBOARD_API_URL, () => Account.vampireName).start();
} catch (error) {
	console.error("Leaderboard could not start:", error);
}

//random number getter
 function getRandomInt(min, max){
 	min = Math.ceil(min);
 	max = Math.floor(max);
 	return Math.floor(Math.random() * (max - min) + min);
 }

//update displayed values
function displayUpdate(){
	

	document.getElementById("familiarNotWorking").innerHTML = Familiars.getNotWorking();
	document.getElementById("familiarAmmount").innerHTML = Familiars.ammount;

	//inventory
	document.getElementById("humanFoodCount").innerHTML = Inv.getHumanFoodAmmount();
	document.getElementById("bloodCount").innerHTML = Inv.getBloodAmmount();
	document.getElementById("woodCount").innerHTML = Inv.getWoodAmmount();
	document.getElementById("ironCount").innerHTML = Inv.getIronAmmount();
	document.getElementById("bronzeCount").innerHTML = Inv.getBronzeAmmount();
	document.getElementById("goldCount").innerHTML = Inv.getGoldAmmount();
	
	document.getElementById("familiarCost").innerHTML = Familiars.getCost();
	
	document.getElementById("levelStat").innerHTML = House.level;
	document.getElementById("xpReturnDisplayStat").innerHTML = House.xpReturnDisplay();
	
	//gathering
	document.getElementById("humanFoodGather").innerHTML = Familiars.getHumanFoodGather();
	document.getElementById("newHumanFoodPerRound").innerHTML = Inv.getNewHumanFoodPerRound(Familiars);
	document.getElementById("newHumanFoodPerRoundStat").innerHTML = Inv.getNewHumanFoodPerRound();
	
	document.getElementById("bloodVictimGather").innerHTML = Familiars.getBloodGather();
	document.getElementById("newBloodPerRound").innerHTML = Inv.getBloodPerRound(Familiars, Account);
	document.getElementById("newBloodPerRoundStat").innerHTML = Inv.getNewBloodPerRound();
	
	document.getElementById("woodGather").innerHTML = Familiars.getWoodGather();
	document.getElementById("newWoodPerRound").innerHTML = Inv.getWoodPerRound(Familiars);
	document.getElementById("newWoodPerRoundStat").innerHTML = Inv.getNewWoodPerRound();

	document.getElementById("fireGuard").innerHTML = Familiars.fireGuard;
	
	for (const [id, vampire] of Object.entries(vampireTypes)){
		document.getElementById(id + "Count").innerHTML = vampire.getAmmount();
		document.getElementById(id + "Cost").innerHTML = vampire.getCost();
	}
	
	document.getElementById("fireLeft").innerHTML = House.fire.percent;
	
	document.getElementById("familiarLimit").innerHTML = Familiars.maxLimit;

	document.getElementById("buildingHutCost").innerHTML = myTown.Buildings.Hut.cost;
	document.getElementById("buildingMineCost").innerHTML = myTown.Buildings.Mine.cost;
	document.getElementById("buildingFarmCost").innerHTML = myTown.Buildings.Farm.cost;
	document.getElementById("buildingLumberMillCost").innerHTML = myTown.Buildings.LumberMill.cost;

	document.getElementById("buildingFarmFamiliarsRequired").innerHTML = myTown.Buildings.Farm.workersRequired;
	document.getElementById("buildingMineFamiliarsRequired").innerHTML = myTown.Buildings.Mine.workersRequired;
	document.getElementById("buildingLumberMillFamiliarsRequired").innerHTML = myTown.Buildings.LumberMill.workersRequired;

	document.getElementById("ironHoeCost").innerHTML = Upgrades.tools.ironHoe.cost;
	document.getElementById("ironAxeCost").innerHTML = Upgrades.tools.ironAxe.cost;
	document.getElementById("ironPickCost").innerHTML = Upgrades.tools.ironPick.cost;

	document.getElementById("ironHoeAmmount").innerHTML = Upgrades.tools.ironHoe.ammount;
	document.getElementById("ironAxeAmmount").innerHTML = Upgrades.tools.ironAxe.ammount;
	document.getElementById("ironPickAmmount").innerHTML = Upgrades.tools.ironPick.ammount;

	myTown.updateTileImages(document);

	//Timers
	document.getElementById("tenSecTimer").innerHTML = Timer.resetTime;
}




//GAME LOOP
//every second
window.setInterval(function(){
	//Timers
	Timer.countDownTenSec();
	
	displayUpdate();
	
	//Familiars

	//Inventory
	Inv.updateOne(Familiars, Account);

	//House
	House.updateOne(document);

	//Player

	//Vampire

	//map
	

	
	
}, 1000);

//every 10 seconds
window.setInterval(function(){

	//Familiars
	Familiars.update(Inv, House);

	//Inventory
	Inv.updateTen();

	//House
	const newLevel = House.updateTen(Account, document);
	if (newLevel) announceLevelUp(newLevel);

	//Player

	//Vampire

	//Town
	myTown.updateTen(Inv, document, updateBox, Familiars);
	//save
	save();
}, 10000);

//every minute
window.setInterval(function(){
	//Event handler - every minute has a 10% chance of triggering an event
	if (getRandomInt(0, 100) < 10){
		eventHandler.getRandomEvent(document);
	}
	//Familiars
	Familiars.updateMin(House, Inv);
	//Inventory

	//House

	//Player

	//Vampire

	//Events
	

}, 60000)


//SIGN-UP (new players choose a vampire name and a settlement name)
const overlay = document.getElementById("overlay");
const signUpForm = document.getElementById("signUpForm");
const signUpError = document.getElementById("signUpError");
const signUpButton = signUpForm.querySelector("button[type=submit]");

function cleanName(value){
	const text = value
		.replace(/[​-‏⁠﻿­]/g, "")
		.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return Array.from(text).slice(0, 20).join("");
}

function showSignUp(message = ""){
	signUpError.textContent = message;
	signUpForm.vName.value = Account.vampireName;
	signUpForm.hName.value = Account.houseName;
	overlay.style.display = "flex";
	signUpForm.vName.focus();
}

signUpForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	const vampireName = cleanName(signUpForm.vName.value);
	const settlementName = cleanName(signUpForm.hName.value);
	if (vampireName === "") { signUpError.textContent = "Your vampire needs a name."; return; }
	if (settlementName === "") { signUpError.textContent = "Your settlement needs a name."; return; }

	// Ask the server: it refuses a vampire name that another player already has.
	signUpButton.disabled = true;
	signUpError.textContent = "Checking the name…";
	const result = await playerSync.save(playerProfile({ vampireName, houseName: settlementName }));
	signUpButton.disabled = false;

	if (!result.ok && !result.offline){
		signUpError.textContent = result.error || "Could not save your name. Please try again.";
		return;
	}
	// (If the server could not be reached the game still starts. The name is checked
	// again on the next autosave, and the pop-up comes back if it turns out to be taken.)

	Account.vampireName = vampireName;
	Account.houseName = settlementName;
	signedUp = true;
	overlay.style.display = "none";
	chat?.lockName(vampireName);
	updateBox.townUpdatesAdd("-- " + vampireName + " founds " + settlementName + " --", document);
	save();
})


//SAVE / LOAD
//One list describes everything that is saved: key in the save -> [how to read it, how to set it]
const field = (target, property) => [() => target[property], (value) => { target[property] = value; }];

const saveFields = {
	bloodAmmount: field(Inv.items, "blood"),
	humanFoodAmmount: field(Inv.items, "humanFood"),
	woodAmmount: field(Inv.items, "wood"),
	ironAmmount: field(Inv.items, "iron"),
	bronzeAmmount: field(Inv.items, "bronze"),
	goldAmmount: field(Inv.items, "gold"),

	hutAmmount: field(myTown.Buildings.Hut, "ammount"),
	mineAmmount: field(myTown.Buildings.Mine, "ammount"),
	farmAmmount: field(myTown.Buildings.Farm, "ammount"),
	lumberMillAmmount: field(myTown.Buildings.LumberMill, "ammount"),
	mineGain: field(myTown.Buildings.Mine, "gain"),
	farmGain: field(myTown.Buildings.Farm, "gain"),
	lumberMillGain: field(myTown.Buildings.LumberMill, "gain"),

	ironHoeAmmount: field(Upgrades.tools.ironHoe, "ammount"),
	ironAxeAmmount: field(Upgrades.tools.ironAxe, "ammount"),
	ironPickAmmount: field(Upgrades.tools.ironPick, "ammount"),

	vampiresAmmount: field(Account, "vampiresAmmount"),
	mosquitoAmmount: field(Mosquito, "ammount"),
	vampireRatAmmount: field(VampireRat, "ammount"),
	vampireBatAmmount: field(VampireBat, "ammount"),
	bloodHoundAmmount: field(BloodHound, "ammount"),
	vampireSlaveAmmount: field(VampireSlave, "ammount"),
	nightWalkerAmmount: field(NightWalker, "ammount"),
	badabookAmmount: field(Badabook, "ammount"),
	draugrAmmount: field(Draugr, "ammount"),
	strigoiAmmount: field(Strigoi, "ammount"),
	overloardAmmount: field(Overloard, "ammount"),

	familiarAmmount: field(Familiars, "ammount"),
	familiarNotWorking: field(Familiars, "notWorking"),
	familiarLimit: field(Familiars, "maxLimit"),
	humanFoodGather: field(Familiars, "foodGather"),
	bloodVictimGather: field(Familiars, "bloodGather"),
	woodGather: field(Familiars, "woodGather"),
	fireGuard: field(Familiars, "fireGuard"),

	newHumanFoodPerRound: field(Inv, "newHumanFoodPerRound"),
	newBloodPerRound: field(Inv, "newBloodPerRound"),

	xp: field(House, "xp"),
	level: field(House, "level"),
	firePercent: field(House.fire, "percent"),

	vampireName: field(Account, "vampireName"),
	houseName: field(Account, "houseName"),
	playerBloodPerRoundGain: field(Account, "bloodPerRoundGain"),
	playerInfluencePerRound: field(Account, "influence"),
};

function newGame(){
	myTown.newTileMap(document);
}

function readSave(){
	try {
		return JSON.parse(localStorage.getItem("save"));
	} catch {
		return null; // missing or damaged save: start fresh
	}
}

function load(){
	updateBox.townUpdatesAdd("-- Welcome back --", document);
	House.updateFire(document);

	const savegame = readSave();
	if (!savegame || typeof savegame.tiles === "undefined") newGame();

	if (savegame){
		for (const [key, [, set]] of Object.entries(saveFields)){
			if (savegame[key] !== undefined && savegame[key] !== null) set(savegame[key]);
		}
		if (typeof savegame.tiles !== "undefined") myTown.tiles = savegame.tiles;
		signedUp = savegame.signedUp === true;

		if (typeof savegame.level === "undefined"){
			// Saved before levels existed: the old house size becomes the level, and the
			// influence collected beyond that house's milestone is the progress in it.
			const oldSize = Number.isInteger(savegame.currentSize) ? savegame.currentSize : 0;
			House.level = oldSize + 1;
			House.xp = Math.max(0, House.xp - (xpRates[oldSize] || 0));
		}
		House.applyLevel(House.level); // house name, size and next milestone follow from the level
	}

	if (signedUp) chat?.lockName(Account.vampireName);
	else showSignUp();
}

//What the server keeps in its player file
function playerProfile(names = Account){
	return {
		vampireName: names.vampireName,
		settlementName: names.houseName,
		level: House.level,
		stats: {
			blood: Inv.items.blood,
			humanFood: Inv.items.humanFood,
			wood: Inv.items.wood,
			iron: Inv.items.iron,
			bronze: Inv.items.bronze,
			gold: Inv.items.gold,
			familiars: Familiars.ammount,
			influence: House.xp,
		},
	};
}

async function syncPlayerFile(){
	const result = await playerSync.save(playerProfile());
	if (result.status === 409 && signedUp){
		// The server says another player has this name (it could not be checked while offline).
		signedUp = false;
		save();
		showSignUp(result.error || "That vampire name is already taken. Choose another.");
	}
}

function save(){
	const data = { signedUp, tiles: myTown.tiles };
	for (const [key, [get]] of Object.entries(saveFields)) data[key] = get();

	try {
		localStorage.setItem("save", JSON.stringify(data));
	} catch (error) {
		console.warn("Could not save the game:", error);
	}
	if (signedUp) syncPlayerFile();
}

//LEVELS
function announceLevelUp(level){
	updateBox.townUpdatesAdd("-- Level up! " + Account.vampireName + " is now level " + level + " (" + House.currentHouse + ") --", document);
	const levelStat = document.getElementById("levelStat");
	levelStat.classList.remove("level-up");
	void levelStat.offsetWidth; // lets the flash start again if levels come quickly
	levelStat.classList.add("level-up");
}

function deleteSave(){
	localStorage.removeItem("save");
	location.reload(); // start a new game (otherwise the next autosave would write the old one back)
}

load();
