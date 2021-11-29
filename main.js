
//Init data
const houseSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];
const xpRates = [0, 1000, 10000, 50000, 200000, 1000000];
const houseImages = ["src/smallHut.png", "src/house2.png"];


//Class constructors
//personal
function Player(vName, hName){
	this.vampireName = '';
	this.houseName = '';
	this.playedBefore = 0;
	this.vampiresAmmount = 0;
	this.influence = 0;
	this.bloodPerRoundGain = 0;

	this.addInfluence = function(gain){
		this.influence = Math.round(this.influence + gain);
	};

	this.addBloodPerRoundGain = function(gain){
		this.bloodPerRoundGain = this.bloodPerRoundGain + gain;
	}
};

//storage vars
function Inventory(){

	this.items = {
		blood: 10,
		humanFood: 10,
		wood: 10,
	}

	this.newHumanFoodPerRound = 0;
	this.newBloodPerRound = 0;

	this.getHumanFoodPerRound = function(){
		var n = (Familiars.foodGather * Familiars.foodGatherGain);
		this.newHumanFoodPerRound = n;
		return n;
	};

	this.getBloodPerRound = function(){
		var n = (Familiars.bloodGather * Familiars.bloodGatherGain) + Account.bloodPerRoundGain;
		this.newBloodPerRound = n;
		return n;
	};

	this.getNewHumanFoodPerRound = function(){
		return this.newHumanFoodPerRound;
	};

	this.getNewBloodPerRound = function(){
		return this.newBloodPerRound;
	};

	this.getBloodCount = function(){
		this.items.blood = Math.floor(this.items.blood);
		return this.items.blood;
	};


	this.addBloodPerRound = function(gain){
		this.newBloodPerRound = this.newBloodPerRound + gain;
	};

	this.addBlood = function(ammount){
		this.items.blood = this.items.blood + ammount;
	};

	this.getHumanFoodAmmount = function(){
		return this.items.humanFood;
	};

	this.useBlood = function(ammount){
		this.items.blood = this.items.blood - ammount;
	};

	this.updateBlood = function(){
		this.addBlood(this.newBloodPerRound);
	}

	this.update = function(){
		this.getBloodCount();
		this.getBloodPerRound();
		this.getHumanFoodPerRound();
	};
};

function Vampire(ammount, cost, gain, influence){
	this.ammount = ammount;
	this.cost = cost;
	this.gain = gain;
	this.influence = influence;

	this.addVampire = function(){
		this.ammount = this.ammount + 1;
	};

	this.addInfluence = function(gain){
		this.influence = this.influence + gain;
	};

	this.getAmmount = function(){
		return this.ammount;
	};

	this.getCost = function(){
		return this.cost;
	};

	this.getGain = function(){
		return this.gain;
	};

	this.getInfluence = function(){
		return this.influence;
	};
	
};

function Familiar(ammount, cost, foodGather, foodGatherGain, bloodGather, bloodGatherGain, notWorking){
	this.ammount = ammount;
	this.cost = cost;
	this.foodGather = foodGather;
	this.foodGatherGain = foodGatherGain;
	this.bloodGather = bloodGather;
	this.bloodGatherGain = bloodGatherGain;
	this.notWorking = notWorking;

	this.getNotWorking = function(){
		return this.notWorking;
	};

	this.getHumanFoodGather = function(){
		return this.foodGather;
	};

	this.addFamiliar = function(){
		this.ammount = this.ammount + 1;
		this.notWorking = this.notWorking + 1;
	};

	this.addHumanFoodGather = function(n){
		if(n > 0){
			this.foodGather = this.foodGather + (n);
			this.notWorking = this.notWorking - n;
		}
		if(n < 0){
			this.foodGather = this.foodGather + n;
			this.notWorking = this.notWorking - n;
		}
	};

	
	this.addBloodGather = function(n){
		if(n > 0){
			this.bloodGather = this.bloodGather + (n);
			this.notWorking = this.notWorking - n;
		}
		if(n < 0){
			this.bloodGather = this.bloodGather + n;
			this.notWorking = this.notWorking - n;
		}
	};

	this.adopt = function(){
		if (House.xp >= Familiars.cost){
			Familiars.addFamiliar();
			House.useXp(Familiars.cost);
			Inv.getHumanFoodPerRound();
			document.getElementById("humanFoodCount").innerHTML = Inv.items.humanFood;
			coolDown("adoptFamiliar", 5000);
		};
		document.getElementById("newHumanFoodPerRound").innerHTML = Inv.newHumanFoodPerRound;
	};

	this.gatherHumanFood = function(){
		Inv.items.humanFood = Inv.items.humanFood + Inv.newHumanFoodPerRound;
	};

	this.gatherBloodVictim = function(){
		Inv.addBlood(this.bloodGather * 2);
	};

	this.eat = function(){
		if (Inv.items.humanFood >= 1){
			Inv.items.humanFood = Inv.items.humanFood - this.ammount;
		}
	};

	this.update = function(){
		this.gatherHumanFood();
		this.gatherBloodVictim();
		this.eat();
	}
};

function HousePar(houseSize, xpRates, houseImages){
	this.houseImages = houseImages;
	this.houseSize = houseSize;
	this.xpRates = xpRates;
	this.xp = 0;
	this.currentSize = 0;
	this.xpNext = xpRates[this.currentSize + 1];
	this.currentHouse = houseSize[this.currentSize];
	
	this.fire = {
        percent : 100,
        getRate: () => {
            return this.currentSize * 2;
        },
    }
		
	this.xpReturnDisplay = function(){
		return String(xp + "/" + xpNext);
	};
	
	this.addXp = function(){
		this.xp = this.xp + Account.influence;
	}

	this.useXp = function(ammount){
		this.xp = this.xp - ammount;
	};

	this.updateXP = function(){
		this.xp = (this.xp + Account.influence) + 1;
		if(this.xp >= this.xpNext){
			this.currentSize = this.currentSize + 1;
			this.xpNext = this.xpRates[this.currentSize];
			this.currentHouse = this.houseSize[this.currentSize];
		}
	};

	this.getXP = function(){
		return String(this.xp + "/" + this.xpNext);
	};

	this.updateImage = function(){
		document.getElementById("house").src = String(this.houseImages[this.currentSize]);
	}

	this.updateFire = function(){
		this.fire.percent = this.fire.percent - this.fire.getRate();
		alert(this.fire.percent);
		if (this.fire.percent == 10){
			alert("The fire is running out!");
		}
		document.getElementById("#fireProgressBar").style.width = this.fire.percent + "%";
	}

	this.update = function(){
		this.getXP();
		this.updateImage();
	}
};

//game basics - inventory, player 
let Inv = new Inventory();
let Account = new Player();

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
function drinkBlood(){
	if (Inv.items.blood >= 0){
	Inv.items.blood = Inv.items.blood + 1;
	document.getElementById("bloodCount").innerHTML = Inv.items.blood;
	};
};

function buyVampire(n){
	if (Inv.items.blood >= n.cost){
		n.ammount = n.ammount + 1;
		Inv.useBlood(n.cost);
		Account.addBloodPerRoundGain(n.gain);
		Account.addInfluence(n.influence);
		Vampire.ammount = Vampire.ammount + 1;
	}
};

//BUY FAMILIAR
//Adopt a familiar


//FAMILIAR WORK
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
	document.getElementById("bloodCount").innerHTML = Inv.getBloodCount();
	document.getElementById("woodCount").innerHTML = Inv.items.wood;
	
	document.getElementById("familiarCost").innerHTML = Familiars.cost;
	
	//document.getElementById("bloodPerTurn").innerHTML = bloodPerTurn;
	//document.getElementById("humanFoodPerTurn").innerHTML = humanFoodPerTurn;
	
	document.getElementById("currentHouse").innerHTML = House.currentHouse;
	document.getElementById("xpReturnDisplayStat").innerHTML = House.getXP();
	
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
	
	
	
	
	document.getElementById("vName").innerHTML = Account.vampireName;
	document.getElementById("hName").innerHTML = Account.houseName;
}


//GAME LOOP
//every second
window.setInterval(function(){
	Inv.update();
	displayUpdate();
	House.update();
}, 1000);

//every 10 seconds
window.setInterval(function(){
	Familiars.update();
	House.updateXP();
	save();
	Inv.updateBlood();
	House.updateFire();
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
	playedBefore = true;
}

function load(){
	savegame = JSON.parse(localStorage.getItem("save"));
	if (savegame == null) savegame = ""; newGame();
	if (savegame.bloodAmmount !== "undefined"){ 
		bloodAmmount = savegame.bloodAmmount;
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




