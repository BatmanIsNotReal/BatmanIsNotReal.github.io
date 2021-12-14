import Player from './js/Player.js';
import Inventory from './js/Inventory.js';
import Vampire from './js/Vampire.js';
import Familiar from './js/Familiar.js';
import HousePar from './js/House.js';
import Timers from './js/Timers.js';
import Town from './js/town/Town.js';
import UpdateBox from './js/town/updateBox/updatesBox.js';


//Init data
const houseSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];
const xpRates = [0, 1000, 10000, 50000, 200000, 1000000];
const houseImages = ["src/smallHut.png", "src/house2.png"];

const townSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];


//game basics - inventory, player 
let Inv = new Inventory();
let Account = new Player("john", "house");
let myTown = new Town(townSize, xpRates);

let updateBox = new UpdateBox(10, 0);



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

//familiar vars
let Familiars = new Familiar(0, 500, 0, 2, 0, 2, 0, 2, 0);

//Timers
const Timer = new Timers();

//house 
let House = new HousePar(houseSize, xpRates, houseImages);

var modal = document.getElementById("myModal");
var span = document.getElementsByClassName("close")[0];
let currentTile = "";
const drinkBloodButton = document.getElementById("drinkBlood");
const buyVampireButtons = document.getElementsByClassName("buy-vamp-button");
const adoptFamiliarButton = document.getElementById("adoptFamiliar");
const addGatherButtons = document.getElementsByClassName("add-gather-button");
const removeGatherButtons = document.getElementsByClassName("remove-gather-button");

const buyBuildingButtons = document.getElementsByClassName("buy-building-button");

let tiles = document.getElementsByClassName("tile");

const addWoodButton = document.getElementById("addWoodFire");

const restartButton = document.getElementById("restart");

//buy vampire check
for (let i = 0; i < buyVampireButtons.length; i++) {
	buyVampireButtons[i].addEventListener("click", (event) => {
		vampireTypes[event.target.id].addVampire(Inv, Account);
	})
}

// open modal box
for (let i = 0; i < tiles.length; i++){
	tiles[i].addEventListener("click", () => {currentTile = tiles[i].id; modal.style.display = "block"; console.log(tiles[i].id)});
}
span.addEventListener("click", () => {modal.style.display = "none"});
window.addEventListener("click", (event) => {if (event.target == modal){modal.style.display = "none"}});

//buy buildings check
//hut
for (let i = 0; i < buyBuildingButtons.length; i++){
	buyBuildingButtons[i].addEventListener("click", (event) => {
		if(event.target.id == "buyHut"){
			myTown.buyHut(Inv, Familiars, document, currentTile, event.target.id);
			modal.style.display = "none";
		}
		if(event.target.id == "buyMine"){
			myTown.buyMine(Inv, Familiars, document, currentTile, event.target.id);
			modal.style.display = "none";
		}
		if(event.target.id == "buyFarm"){
			myTown.buyFarm(Inv, Familiars, document, currentTile, event.target.id);
			modal.style.display = "none";
		}
	})
}
//mine



addWoodButton.addEventListener("click", () => {House.addWoodToFire(Inv, 1);})

drinkBloodButton.addEventListener("click", () => { document.getElementById("bloodCount").innerHTML = Math.floor(++Inv.items.blood); })

adoptFamiliarButton.addEventListener("click", () => { Familiars.adopt(House, Inv, updateBox, document); })

for (let i = 0; i < addGatherButtons.length; i++){
	addGatherButtons[i].addEventListener("click", () => { Familiars.addGather(event.target.id); } )
	removeGatherButtons[i].addEventListener("click", () => { Familiars.removeGather(event.target.id); })
}
restartButton.addEventListener("click", () => {deleteSave();})

//Random events
//const randEvents = [];
//let randEvents[1] = "";

load();
//Drinking blood

//CORE GAME MECHANICS
//cooldown function
// function coolDown(elementID, time){
// 	document.getElementById(elementID).disabled = true;
// 	setTimeout(function() {document.getElementById(elementID).disabled = false;}, time);
// }

// //random number getter
// function getRandomInt(min, max){
// 	min = Math.ceil(min);
// 	max = Math.floor(max);
// 	return Math.floor(Math.random() * (max - min) + min);
// }

//update displayed values
function displayUpdate(){
	

	//Testing
	


	document.getElementById("familiarNotWorking").innerHTML = Familiars.getNotWorking();

	//inventory
	document.getElementById("humanFoodCount").innerHTML = Inv.getHumanFoodAmmount();
	document.getElementById("bloodCount").innerHTML = Inv.getBloodAmmount();
	document.getElementById("woodCount").innerHTML = Inv.getWoodAmmount();
	document.getElementById("ironCount").innerHTML = Inv.getIronAmmount();
	document.getElementById("bronzeCount").innerHTML = Inv.getBronzeAmmount();
	document.getElementById("goldCount").innerHTML = Inv.getGoldAmmount();
	
	document.getElementById("familiarCost").innerHTML = Familiars.getCost();
	
	//document.getElementById("bloodPerTurn").innerHTML = bloodPerTurn;
	//document.getElementById("humanFoodPerTurn").innerHTML = humanFoodPerTurn;
	
	document.getElementById("currentHouse").innerHTML = House.getCurrentHouse();
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
	
	document.getElementById("mosquitoCount").innerHTML = Mosquito.getAmmount();
	document.getElementById("mosquitoCost").innerHTML = Mosquito.getCost();
	
	document.getElementById("vampireRatCount").innerHTML = VampireRat.getAmmount();
	document.getElementById("vampireRatCost").innerHTML = VampireRat.getCost();
	
	document.getElementById("vampireBatCount").innerHTML = VampireBat.getAmmount();
	document.getElementById("vampireBatCost").innerHTML = VampireBat.getCost();
	
	document.getElementById("bloodHoundCount").innerHTML = BloodHound.getAmmount();
	document.getElementById("bloodHoundCost").innerHTML = BloodHound.getCost();
	
	document.getElementById("vampireSlaveCount").innerHTML = VampireSlave.getAmmount();
	document.getElementById("vampireSlaveCost").innerHTML = VampireSlave.getCost();
	
	document.getElementById("nightWalkerCount").innerHTML = NightWalker.getAmmount();
	document.getElementById("nightWalkerCost").innerHTML = NightWalker.getCost();
	
	document.getElementById("badabookCount").innerHTML = Badabook.getAmmount();
	document.getElementById("badabookCost").innerHTML = Badabook.getCost();

	document.getElementById("draugrCount").innerHTML = Draugr.getAmmount();
	document.getElementById("draugrCost").innerHTML = Draugr.getCost();

	document.getElementById("strigoiCount").innerHTML = Strigoi.getAmmount();
	document.getElementById("strigoiCost").innerHTML = Strigoi.getCost();

	document.getElementById("overloardCount").innerHTML = Overloard.getAmmount();
	document.getElementById("overloardCost").innerHTML = Overloard.getCost();
	
	document.getElementById("fireLeft").innerHTML = House.fire.percent;
	
	//document.getElementById("house").src = House.updateImage();
	
	document.getElementById("vName").innerHTML = Account.vampireName;
	document.getElementById("hName").innerHTML = Account.houseName;
	document.getElementById("familiarLimit").innerHTML = Familiars.maxLimit;

	document.getElementById("buildingHutCost").innerHTML = myTown.Buildings.Hut.cost;
	document.getElementById("buildingMineCost").innerHTML = myTown.Buildings.Mine.cost;
	document.getElementById("buildingFarmCost").innerHTML = myTown.Buildings.Farm.cost;

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
	House.updateTen(Account, document);

	//Player

	//Vampire

	//Town
	myTown.updateTen(Inv, document, updateBox);
	//save
	save();
}, 10000);

//every minute
window.setInterval(function(){
	//Familiars
	Familiars.updateMin(House, Inv);
	//Inventory

	//House

	//Player

	//Vampire

}, 60000)


function validateForm(){
		let vName = document.forms["signUp"]["vName"].value;
		let hName = document.forms["signUp"]["hName"].value;
		if (vName == ""){
			alert("You must have a name");
		}
		else if (hName == ""){
			alert("Your house must have a name");
		}
		if (vName !== "" && hName !== ""){
			let Account = new Player(vName, hName);
			document.getElementById("overlay").style.display = "none";
		} 
	}


function newGame(){
	//document.getElementById("overlay").style.display="grid";
	Account.playedBefore = true;
}

function load(){
	myTown.createTiles(document);
	
	updateBox.townUpdatesAdd("-- Welcome back --", document);
	document.body.style.zoom="60%";
	House.updateFire(document);
	var savegame = JSON.parse(localStorage.getItem("save"));
	if (savegame == null) savegame = ""; newGame();
	if (savegame.bloodAmmount !== "undefined"){ 
		Inv.bloodAmmount = savegame.bloodAmmount;
	}else{
		return;
	}
	if (typeof savegame.bloodAmmount !== "undefined") Inv.items.blood = savegame.bloodAmmount;
	if (typeof savegame.humanFoodAmmount !== "undefined") Inv.items.humanFood = savegame.humanFoodAmmount;
	if (typeof savegame.woodAmmount !== "undefined") Inv.items.wood = savegame.woodAmmount;
	if (typeof savegame.ironAmmount !== "undefined") Inv.items.iron = savegame.ironAmmount;
	if (typeof savegame.bronzeAmmount !== "undefined") Inv.items.bronze = savegame.bronzeAmmount;
	if (typeof savegame.goldAmmount !== "undefined") Inv.items.gold = savegame.goldAmmount;
	
	if (typeof savegame.hutAmmount !== "undefined") myTown.Buildings.Hut.ammount = savegame.hutAmmount;
	if (typeof savegame.mineAmmount !== "undefined") myTown.Buildings.Mine.ammount = savegame.mineAmmount;

	if (typeof savegame.vampiresAmmount !== "undefined") Account.vampiresAmmount = savegame.vampiresAmmount;
	if (typeof savegame.mosquitoAmmount !== "undefined") Mosquito.ammount = savegame.mosquitoAmmount;
	if (typeof savegame.vampireRatAmmount !== "undefined") VampireRat.ammount = savegame.vampireRatAmmount;
	if (typeof savegame.vampireBatAmmount !== "undefined") VampireBat.ammount = savegame.vampireBatAmmount;
	if (typeof savegame.bloodHoundAmmount !== "undefined") BloodHound.ammount = savegame.bloodHoundAmmount;
	if (typeof savegame.vampireSlaveAmmount !== "undefined") VampireSlave.ammount = savegame.vampireSlaveAmmount;
	if (typeof savegame.nightWalkerAmmount !== "undefined") NightWalker.ammount = savegame.nightWalkerAmmount;
	if (typeof savegame.badabookAmmount !== "undefined") Badabook.ammount = savegame.badabookAmmount;
	if (typeof savegame.draugrAmmount !== "undefined") Draugr.ammount = savegame.draugrAmmount;
	if (typeof savegame.strigoiAmmount !== "undefined") Strigoi.ammount = savegame.strigoiAmmount;
	if (typeof savegame.overloardAmmount !== "undefined") Overloard.ammount = savegame.overloardAmmount;
	if (typeof savegame.familiarAmmount !== "undefined") Familiars.ammount = savegame.familiarAmmount;
	if (typeof savegame.newHumanFoodPerRound !== "undefined") Inv.newHumanFoodPerRound = savegame.newHumanFoodPerRound;
	if (typeof savegame.newBloodPerRound !== "undefined") Inv.newBloodPerRound = savegame.newBloodPerRound;
	if (typeof savegame.humanFoodGather !== "undefined") Familiars.foodGather = savegame.humanFoodGather;
	if (typeof savegame.bloodVictimGather !== "undefined") Familiars.bloodGather = savegame.bloodVictimGather;
	if (typeof savegame.woodGather !== "undefined") Familiars.woodGather = savegame.woodGather;
	if (typeof savegame.fireGuard !== "undefined") Familiars.fireGuard = savegame.fireGuard;
	if (typeof savegame.familiarNotWorking !== "undefined") Familiars.notWorking = savegame.familiarNotWorking;
	if (typeof savegame.familiarLimit !== "undefined") Familiars.maxLimit = savegame.familiarLimit;
	if (typeof savegame.xp !== "undefined") House.xp = savegame.xp;
	if (typeof savegame.currentSize !== "undefined") House.currentSize = savegame.currentSize;
	if (typeof savegame.currentHouse !== "undefined") House.currentHouse = savegame.currentHouse;
	if (typeof savegame.vampireName !== "undefined") Account.vampireName = savegame.vampireName;
	if (typeof savegame.houseName !== "undefined") Account.houseName = savegame.houseName;
	if (typeof savegame.playerBloodPerRoundGain !== "undefined") Account.bloodPerRoundGain = savegame.playerBloodPerRoundGain;
	if (typeof savegame.playerInfluencePerRound !== "undefined") Account.influence = savegame.playerInfluencePerRound;
	if (typeof savegame.firePercent !== "undefined") House.fire.percent = savegame.firePercent;
	if (typeof savegame.tiles !== "undefined") myTown.tiles = savegame.tiles;
	
	if (Inv.bloodAmmount == 10){
		myTown.newTileMap(document);
	}
}

function save(){
	var save = {
		bloodAmmount: Inv.items.blood,
		humanFoodAmmount: Inv.items.humanFood,
		woodAmmount: Inv.items.wood,
		ironAmmount: Inv.items.iron,
		bronzeAmmount: Inv.items.bronze,
		goldAmmount: Inv.items.gold,

		hutAmmount: myTown.Buildings.Hut.ammount,
		mineAmmount: myTown.Buildings.Mine.ammount,

		vampiresAmmount: Account.vampiresAmmount,
		mosquitoAmmount: Mosquito.ammount,
		vampireRatAmmount: VampireRat.ammount,
		vampireBatAmmount: VampireBat.ammount,
		bloodHoundAmmount: BloodHound.ammount,
		vampireSlaveAmmount: VampireSlave.ammount,
		nightWalkerAmmount: NightWalker.ammount,
		badabookAmmount: Badabook.ammount,
		draugrAmmount: Draugr.ammount,
		strigoiAmmount: Strigoi.ammount,
		overloardAmmount: Overloard.ammount,
		familiarAmmount: Familiars.ammount,
		newHumanFoodPerRound: Inv.newHumanFoodPerRound,
		newBloodPerRound: Inv.newBloodPerRound,
		humanFoodGather: Familiars.foodGather,
		bloodVictimGather: Familiars.bloodGather,
		woodGather: Familiars.woodGather,
		fireGuard: Familiars.fireGuard,
		familiarNotWorking: Familiars.notWorking,
		familiarLimit: Familiars.maxLimit,
		humanFoodPerTurn: Inv.newHumanFoodPerRound,
		xp: House.xp,
		currentSize: House.currentSize,
		currentHouse: House.currentHouse,
		vampireName: Account.vampireName,
		houseName: Account.houseName,
		firePercent: House.fire.percent,
		playerBloodPerRoundGain: Account.bloodPerRoundGain,
		playerInfluencePerRound: Account.influence,
		tiles: myTown.tiles,
	}
	localStorage.setItem("save", JSON.stringify(save));
}

function deleteSave(){
	localStorage.removeItem("save");
	
}



//random event timer
//window.setInterval(function(){
	//time = getRandomInt(180000, 600000);
	//random event
//}, time);




