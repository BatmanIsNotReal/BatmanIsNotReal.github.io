import Player from './js/Player.js';
import Inventory from './js/Inventory.js';
import Vampire from './js/Vampire.js';
import Familiar from './js/Familiar.js';
import HousePar from './js/House.js';



//Init data
const houseSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];
const xpRates = [0, 1000, 10000, 50000, 200000, 1000000];
const houseImages = ["src/smallHut.png", "src/house2.png"];

//game basics - inventory, player 
let Inv = new Inventory();
let Account = new Player("john", "house");

//vampires vars
let Mosquito = new Vampire(0, 10, 0.1, 0.01);
let VampireRat = new Vampire(0, 20, 0.3, 0.03);
let VampireBat = new Vampire(0, 30, 0.6, 0.06);
let BloodHound = new Vampire(0, 100, 2, 0.08);
let VampireSlave = new Vampire(0, 400, 10, 0.1);
let NightWalker = new Vampire(0, 1000, 30, 0.15);
let Badabook = new Vampire(0, 3000, 100, 0.3);


//familiar vars
let Familiars = new Familiar(0, 500, 0, 2, 0, 2, 0);


//consumption vars


//house 
let House = new HousePar(houseSize, xpRates, houseImages);




//Random events
//const randEvents = [];
//let randEvents[1] = "";

load();
//Drinking blood



const buyVampire = (n) =>{
	if (Inv.items.blood >= n.cost){
		n.ammount = n.ammount + 1;
		Inv.useBlood(n.cost);
		Account.addBloodPerRoundGain(n.gain);
		Account.addInfluence(n.influence);
		Vampire.ammount = Vampire.ammount + 1;
	}
};



	function drinkBlood (){
		if (Inv.items.blood >= 0){
		Inv.items.blood = Inv.items.blood + 1;
		document.getElementById("bloodCount").innerHTML = Inv.items.blood;
		};
	};

	

	//BUY FAMILIAR
	//Adopt a familiar
	var adoptFamiliar = function(){
		if (House.xp >= Familiars.cost){
			Familiars.addFamiliar();
			House.useXp(Familiars.cost);
			Inv.getHumanFoodPerRound();
			document.getElementById("humanFoodCount").innerHTML = Inv.items.humanFood;
		}
		document.getElementById("newHumanFoodPerRound").innerHTML = Inv.newHumanFoodPerRound;
	}

	//Eat food
	function familiarEat() {
		if (Inv.items.humanFood >= 1){
			Inv.useHumanFood(Familiars.ammount);
		}
	}

	//FAMILIARs
	//add
	function addGather(type){
		if(Familiars.notWorking >= 1){
			if (type == 'humanFoodGather'){
				Familiars.addHumanFoodGather(1);
			}
			if (type == "bloodGather"){
				Familiars.addBloodGather(1);
			}
		}
	}
	//sub
	function useGather(type){
		if (type == "humanFoodGather"){
			if(Familiars.foodGather >= 1){
				Familiars.addHumanFoodGather(-1);
			}
		}
		if (Familiars.bloodGather >= 1){
			if (type == "bloodGather"){
				Familiars.addBloodGather(-1);
			}
		}
	}

	



//CORE GAME MECHANICS
//cooldown function
function coolDown(elementID, time){
	document.getElementById(elementID).disabled = true;
	setTimeout(function() {document.getElementById(elementID).disabled = false;}, time);
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

	//inventory
	document.getElementById("humanFoodCount").innerHTML = Inv.getHumanFoodAmmount();
	document.getElementById("bloodCount").innerHTML = Inv.getBloodAmmount();
	document.getElementById("woodCount").innerHTML = Inv.items.wood;
	
	document.getElementById("familiarCost").innerHTML = Familiars.cost;
	
	//document.getElementById("bloodPerTurn").innerHTML = bloodPerTurn;
	//document.getElementById("humanFoodPerTurn").innerHTML = humanFoodPerTurn;
	
	document.getElementById("currentHouse").innerHTML = House.currentHouse;
	document.getElementById("xpReturnDisplayStat").innerHTML = House.xpReturnDisplay();
	
	//gathering
	document.getElementById("humanFoodGather").innerHTML = Familiars.foodGather;
	document.getElementById("newHumanFoodPerRound").innerHTML = Inv.getNewHumanFoodPerRound();
	document.getElementById("newHumanFoodPerRoundStat").innerHTML = Inv.getNewHumanFoodPerRound();
	
	document.getElementById("bloodVictimGather").innerHTML = Familiars.bloodGather;
	document.getElementById("newBloodPerRound").innerHTML = Inv.getBloodPerRound();
	document.getElementById("newBloodPerRoundStat").innerHTML = Inv.newBloodPerRound;
	
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
	
	
	document.getElementById("house").src = House.updateImage();
	
	document.getElementById("vName").innerHTML = Account.vampireName;
	document.getElementById("hName").innerHTML = Account.houseName;
}


//GAME LOOP
//every second
window.setInterval(function(){
	displayUpdate();
	House.update();
	//Inventory
	Inv.getBloodAmmount();
	Inv.getBloodPerRound(Familiars.bloodGather, Familiars.bloodGatherGain, Account.bloodPerRoundGain);
	Inv.getHumanFoodPerRound(Familiars.foodGather, Familiars.foodGatherGain);
}, 1000);

//every 10 seconds
window.setInterval(function(){
	//Familiar
	// Familiars.familiarEat();
	
	
	save();
	House.updateFire(document);

	//House
	House.updateXP(Account.influence);
	House.updateImage(document);
	House.updateFire(document);


	//Inventory
	Inv.updateBlood();
	// Inv.gatherHumanFood();
	// Inv.gatherBloodVictim(Familiars.bloodGather);
}, 10000);


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
	if (typeof savegame.vampiresAmmount !== "undefined") Account.vampiresAmmount = savegame.vampiresAmmount;
	if (typeof savegame.mosquitoAmmount !== "undefined") Mosquito.ammount = savegame.mosquitoAmmount;
	if (typeof savegame.vampireRatAmmount !== "undefined") VampireRat.ammount = savegame.vampireRatAmmount;
	if (typeof savegame.vampireBatAmmount !== "undefined") VampireBat.ammount = savegame.vampireBatAmmount;
	if (typeof savegame.bloodHoundAmmount !== "undefined") BloodHound.ammount = savegame.bloodHoundAmmount;
	if (typeof savegame.vampireSlaveAmmount !== "undefined") VampireSlave.ammount = savegame.vampireSlaveAmmount;
	if (typeof savegame.nightWalkerAmmount !== "undefined") NightWalker.ammount = savegame.nightWalkerAmmount;
	if (typeof savegame.badabookAmmount !== "undefined") Badabook.ammount = savegame.badabookAmmount;
	if (typeof savegame.familiarAmmount !== "undefined") Familiars.ammount = savegame.familiarAmmount;
	if (typeof savegame.newHumanFoodPerRound !== "undefined") Inv.newHumanFoodPerRound = savegame.newHumanFoodPerRound;
	if (typeof savegame.newBloodPerRound !== "undefined") Inv.newBloodPerRound = savegame.newBloodPerRound;
	if (typeof savegame.humanFoodGather !== "undefined") Familiars.foodGather = savegame.humanFoodGather;
	if (typeof savegame.bloodVictimGather !== "undefined") Familiars.bloodGather = savegame.bloodVictimGather;
	if (typeof savegame.familiarNotWorking !== "undefined") Familiars.notWorking = savegame.familiarNotWorking;
	if (typeof savegame.xp !== "undefined") House.xp = savegame.xp;
	if (typeof savegame.currentSize !== "undefined") House.currentSize = savegame.currentSize;
	if (typeof savegame.currentHouse !== "undefined") House.currentHouse = savegame.currentHouse;
	if (typeof savegame.vampireName !== "undefined") Account.vampireName = savegame.vampireName;
	if (typeof savegame.houseName !== "undefined") Account.houseName = savegame.houseName;
	if (typeof savegame.playerBloodPerRoundGain !== "undefined") Account.bloodPerRoundGain = savegame.playerBloodPerRoundGain;
	
}

function save(){
	var save = {
		bloodAmmount: Inv.items.blood,
		humanFoodAmmount: Inv.items.humanFood,
		vampiresAmmount: Account.vampiresAmmount,
		mosquitoAmmount: Mosquito.ammount,
		vampireRatAmmount: VampireRat.ammount,
		vampireBatAmmount: VampireBat.ammount,
		bloodHoundAmmount: BloodHound.ammount,
		vampireSlaveAmmount: VampireSlave.ammount,
		nightWalkerAmmount: NightWalker.ammount,
		badabookAmmount: Badabook.ammount,
		familiarAmmount: Familiars.ammount,
		newHumanFoodPerRound: Inv.newHumanFoodPerRound,
		newBloodPerRound: Inv.getNewBloodPerRound(),
		humanFoodGather: Familiars.foodGather,
		bloodVictimGather: Familiars.bloodGather,
		familiarNotWorking: Familiars.notWorking,
		humanFoodPerTurn: Inv.getHumanFoodPerRound(),
		xp: House.xp,
		currentSize: House.currentSize,
		currentHouse: House.currentHouse,
		vampireName: Account.vampireName,
		houseName: Account.houseName,
		playerBloodPerRoundGain: Account.bloodPerRoundGain
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




