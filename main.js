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
import MapZoom from './js/MapZoom.js';
import PlayerSync from './js/playerSync.js';
import Leaderboard from './js/leaderboard/Leaderboard.js';
import GifPicker from './js/chat/GifPicker.js';
import DiceGame from './js/dice/DiceGame.js';
import HowToPlay from './js/HowToPlay.js';
import OnlineCounter from './js/OnlineCounter.js';
import OnlinePlayers from './js/chat/OnlinePlayers.js';
import UpgradeMenu from './js/town/UpgradeMenu.js';
import FamiliarWalkers from './js/town/FamiliarWalkers.js';
import AvatarBuilder from './js/profile/AvatarBuilder.js';
import { ACCENTS, ACCENT_NAMES, defaultAvatar, normalizeAvatar, randomAvatar } from './js/profile/Avatar.js';
import formatNumber, { formatRate } from './js/formatNumber.js';
import { DICE_API_URL, ONLINE_API_URL, GIPHY_API_KEY, CHAT_API_URL, PLAYER_API_URL, LEADERBOARD_API_URL, PROFILE_API_URL } from './js/chat/chatConfig.js';

//Init data
const houseSize = ["small hut", "respectable hut", "lesser house", "decent house", "grand house", "mansion"];
const xpRates = [0, 1000, 10000, 50000, 200000, 1000000];
const houseImages = ["src/smallHut.png", "src/house2.png"];

//game basics - inventory, player 
let Inv = new Inventory();
const Account = new Player("", "");
let signedUp = false; // true once the player has chosen their names
// How the player looks and what their character page shows (see js/profile and player.html)
const Profile = { avatar: null, bio: "", accent: 0, isPublic: true, showResources: true, showMap: true };
let myTown = new Town(houseSize, xpRates);
const Upgrades = new Upgrade();

let updateBox = new UpdateBox(10, 0);

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
let Draugr = new Vampire(0, 10000, 350, 12, { iron: 200, bronze: 50 });
let Strigoi = new Vampire(0, 30000, 700, 18, { iron: 600, bronze: 150 });

// The top tiers: (amount, blood, blood/10s, influence/10s, { iron, bronze, gold })
let VampireMaster = new Vampire(0, 1000000, 3000, 40, { iron: 5000, bronze: 1000, gold: 140 });   // was the Overlord
let VampireElder = new Vampire(0, 5000000, 20000, 120, { iron: 20000, bronze: 4000, gold: 560 });
let BloodDemon = new Vampire(0, 25000000, 130000, 360, { iron: 75000, bronze: 16000, gold: 2200 });
let BloodLeviathan = new Vampire(0, 125000000, 850000, 1000, { iron: 300000, bronze: 64000, gold: 9000 });


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
	"vampireMaster": VampireMaster,
	"vampireElder": VampireElder,
	"bloodDemon": BloodDemon,
	"bloodLeviathan": BloodLeviathan,
}

//Map
myTown.createTiles(document);

//familiar vars
let Familiars = new Familiar(0, 500, 0, 2, 0, 2, 0, 2, 0);

//Timers
const Timer = new Timers();

//house 
let House = new HousePar(houseSize, xpRates, houseImages);

let eventHandler = new EventHandler(Inv, Familiars, House, () => musicHandler.playSpell());

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


const restartButton = document.getElementById("restart");

//buy vampire check
for (let i = 0; i < buyVampireButtons.length; i++) {
	buyVampireButtons[i].addEventListener("click", (event) => {
		const bought = vampireTypes[event.currentTarget.id].addVampire(Inv, Account);
		if (bought) musicHandler.playBuyVamp(); // no sound when you could not afford it
	})
}

// Upgrade menu for your buildings
const upgradeMenu = new UpgradeMenu(document, {
	getInfo: (id) => myTown.upgradeInfo(id, Inv, Familiars),
	upgrade: (id) => myTown.upgradeTile(id, Inv, Familiars, updateBox, document),
	onUpgraded: () => { musicHandler.playToolUpgrade(); save(); },
	demolishInfo: (id) => myTown.demolishInfo(id, Familiars),
	demolish: (id) => myTown.demolishTile(id, Inv, Familiars, updateBox, document),
	onDemolished: () => { displayUpdate(); save(); },
});

// Click a tile: your buildings open the upgrade menu, other tiles the build menu
for (let i = 0; i < tiles.length; i++){
	tiles[i].addEventListener("click", () => {
		currentTile = tiles[i].id;
		if (myTown.upgradeKey(currentTile)) upgradeMenu.open(currentTile);
		else modal.style.display = "block";
	});
}
span.addEventListener("click", () => {modal.style.display = "none"});
window.addEventListener("click", (event) => {if (event.target == modal){modal.style.display = "none"}});

new FamiliarWalkers(document.getElementById("mapStage"), familiarState);

//ORBS: Upgrades, Updates and the vampire shops each open in their own pop-up
{
	const updatesOrb = document.getElementById("orbUpdates");
	const openModals = () => [...document.querySelectorAll(".popup-modal")].filter((modal) => modal.style.display === "block");
	// The pop-ups are as wide as the middle column (map and chat) and sit right over it
	const fitToMiddleColumn = (modal) => {
		const column = document.querySelector(".flex-column.main").getBoundingClientRect();
		const content = modal.querySelector(".modal-content");
		const padding = parseFloat(getComputedStyle(modal).paddingLeft) || 0;
		content.style.width = column.width + "px";
		content.style.marginLeft = Math.max(0, column.left - padding) + "px";
	};
	window.addEventListener("resize", () => openModals().forEach(fitToMiddleColumn));
	for (const orb of document.querySelectorAll(".orb")){
		const modal = document.getElementById(orb.dataset.opens);
		const close = () => { modal.style.display = "none"; orb.focus(); };
		orb.addEventListener("click", () => {
			if (modal.style.display === "block") return close();
			for (const other of openModals()) other.style.display = "none";
			modal.style.display = "block";
			fitToMiddleColumn(modal);
			if (orb === updatesOrb) orb.classList.remove("has-news");
			const list = modal.querySelector("#townUpdates");
			if (list) list.scrollTop = list.scrollHeight;
			modal.querySelector(".popup-close").focus();
		});
		const closeButton = modal.querySelector(".popup-close");
		closeButton.addEventListener("click", close);
		closeButton.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " "){ event.preventDefault(); close(); } });
		modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
	}
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") for (const modal of openModals()) modal.style.display = "none";
	});
	// A gold dot on the Updates orb when something new was written while the pop-up is closed
	const news = new MutationObserver(() => {
		if (document.getElementById("updatesModal").style.display !== "block") updatesOrb.classList.add("has-news");
	});
	setTimeout(() => news.observe(document.getElementById("townUpdates"), { childList: true }), 1000); // not for the welcome line
}

//map zoom with the mouse wheel
new MapZoom(document.querySelector(".map-scroll"));

//buy buildings check
const buildingActions = {
	buyHut: (id) => myTown.buyHut(Inv, Familiars, document, currentTile, id),
	buyMine: (id) => myTown.buyMine(Inv, Familiars, document, currentTile, id),
	buyFarm: (id) => myTown.buyFarm(Inv, Familiars, document, currentTile, id),
	buyLumberMill: (id) => myTown.buyLumberMill(Inv, Familiars, document, currentTile, id),
	buyBloodTemple: (id) => myTown.buyBloodTemple(Inv, Familiars, document, currentTile, id),
};

// What the separate map window (map.html) uses: it shows this window's map and builds through it,
// so everything stays in one save.
// What the walking familiars need to know (also used by the pop-out map)
function familiarState(){
	// Every building has familiars working in it (workersRequired each), on top of the free gatherers
	const staff = (building) => building.ammount * building.workersRequired;
	const { Farm, LumberMill, Mine, BloodTemple } = myTown.Buildings;
	return {
		width: myTown.mapWidth,
		height: myTown.mapHeight,
		tiles: myTown.tiles,
		counts: {
			food: Familiars.foodGather + staff(Farm),
			wood: Familiars.woodGather + staff(LumberMill),
			blood: Familiars.bloodGather + staff(BloodTemple),
			mine: staff(Mine),
			idle: Familiars.notWorking,
		},
		total: Familiars.ammount,
	};
}

window.vampireMap = {
	familiars: familiarState,
	width: myTown.mapWidth,
	height: myTown.mapHeight,
	tiles: () => myTown.tiles,
	levels: () => myTown.tileLevels,
	upgradeKey: (id) => myTown.upgradeKey(id),
	upgradeInfo: (id) => myTown.upgradeInfo(id, Inv, Familiars),
	upgrade: (id) => {
		const result = myTown.upgradeTile(id, Inv, Familiars, updateBox, document);
		if (result.ok){ musicHandler.playToolUpgrade(); save(); }
		return result;
	},
	demolishInfo: (id) => myTown.demolishInfo(id, Familiars),
	demolish: (id) => {
		const result = myTown.demolishTile(id, Inv, Familiars, updateBox, document);
		if (result.ok){ displayUpdate(); save(); }
		return result;
	},
	imageFor: (type) => myTown.tileImage(type),
	// Builds like a click on a building button after clicking a tile. The messages ("not enough wood")
	// are shown in the map window, where the player is looking.
	build(buttonId, tileId, mapWindow){
		if (!buildingActions[buttonId] || !(tileId in myTown.tiles)) return;
		const mainAlert = window.alert;
		window.alert = (text) => mapWindow.alert(text);
		try {
			currentTile = tileId;
			buildingActions[buttonId](buttonId);
		} finally {
			window.alert = mainAlert;
		}
	},
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
		if (!action) return;
		const countBefore = Object.values(Upgrades.tools).reduce((sum, tool) => sum + tool.ammount, 0);
		action();
		const countAfter = Object.values(Upgrades.tools).reduce((sum, tool) => sum + tool.ammount, 0);
		if (countAfter > countBefore) musicHandler.playToolUpgrade(); // only when the purchase went through
	})
}

drinkBloodButton.addEventListener("click", () => { showStorage("bloodCount", Math.floor(++Inv.items.blood)); })

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
	new GifPicker(chat, GIPHY_API_KEY).start();
} catch (error) {
	console.error("Chat could not start:", error);
}

//Map in a separate window (map.html)
document.getElementById("mapPopout")?.addEventListener("click", () => {
	const popup = window.open("map.html", "vampireHouseMap", "popup=yes,width=1000,height=780");
	if (popup) popup.focus();
	else alert("Your browser blocked the pop-up window. Allow pop-ups for this page and try again.");
});

//Dice button next to the chat opens the dice game in a separate window (dice.html).
//The header button still opens the pop-up inside the game.
document.getElementById("chatDice")?.addEventListener("click", () => {
	const popup = window.open("dice.html", "vampireHouseDice", "popup=yes,width=620,height=820");
	if (popup) popup.focus();
	else alert("Your browser blocked the pop-up window. Allow pop-ups for this page and try again.");
});

//Column with the names of the players who are online, next to the chat
try {
	new OnlinePlayers(ONLINE_API_URL).start();
} catch (error) {
	console.error("Online list could not start:", error);
}

//Chat in a separate window (chat.html)
document.getElementById("chatPopout")?.addEventListener("click", () => {
	const popup = window.open("chat.html", "vampireHouseChat", "popup=yes,width=440,height=620");
	if (popup) popup.focus();
	else alert("Your browser blocked the pop-up window. Allow pop-ups for this page and try again.");
});

//Player file (names and stats are also kept on the server)
const playerSync = new PlayerSync(PLAYER_API_URL);

//Dice game: results (resources won or lost, bets set aside) are applied to the storage by DiceGame.js.
//The ids of applied results are kept in the save so that none is ever applied twice.
const diceApplied = { ids: [] };
try {
	const diceOptions = {
		apiUrl: DICE_API_URL,
		getPlayerId: () => signedUp ? playerSync.id : null,
		getItems: () => Inv.items,
		onChange: () => save(),
		log: (text) => updateBox.townUpdatesAdd(text, document),
		applied: diceApplied,
	};
	new DiceGame(diceOptions).start();
	// The separate dice window (dice.html) runs on the same options, so it uses this window's storage and save.
	window.vampireGameDice = diceOptions;
} catch (error) {
	console.error("Dice game could not start:", error);
}

//How to play (header button; opens by itself once for a new player)
const howToPlay = new HowToPlay();
howToPlay.start();

//Players online (signed-up players count once, however many tabs they have open)
try {
	new OnlineCounter(ONLINE_API_URL, () => signedUp ? playerSync.id : null).start();
} catch (error) {
	console.error("Online counter could not start:", error);
}

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
	document.getElementById("mapTitle").textContent = Account.houseName || "World map"; // the settlement name the player chose

	//inventory
	showStorage("humanFoodCount", Inv.getHumanFoodAmmount());
	showStorage("bloodCount", Inv.getBloodAmmount());
	showStorage("woodCount", Inv.getWoodAmmount());
	showStorage("ironCount", Inv.getIronAmmount());
	showStorage("bronzeCount", Inv.getBronzeAmmount());
	showStorage("goldCount", Inv.getGoldAmmount());
	
	document.getElementById("familiarCost").innerHTML = Familiars.getCost();
	
	document.getElementById("levelStat").innerHTML = House.level;
	document.getElementById("xpReturnDisplayStat").innerHTML = House.xpReturnDisplay();
	
	//gathering
	document.getElementById("humanFoodGather").innerHTML = Familiars.getHumanFoodGather();
	showRate("newHumanFoodPerRound", Inv.getNewHumanFoodPerRound(Familiars));
	showRate("newHumanFoodPerRoundStat", Inv.getNewHumanFoodPerRound());
	
	document.getElementById("bloodVictimGather").innerHTML = Familiars.getBloodGather();
	showRate("newBloodPerRound", Inv.getBloodPerRound(Familiars, Account));
	showRate("newBloodPerRoundStat", Inv.getNewBloodPerRound());
	
	document.getElementById("woodGather").innerHTML = Familiars.getWoodGather();
	showRate("newWoodPerRound", Inv.getWoodPerRound(Familiars));
	showRate("newWoodPerRoundStat", Inv.getNewWoodPerRound());

	for (const [id, vampire] of Object.entries(vampireTypes)){
		document.getElementById(id + "Count").innerHTML = vampire.getAmmount();
		const price = vampire.getPrices();
		for (const [kind, suffix] of [["blood", ""], ["iron", "Iron"], ["bronze", "Bronze"], ["gold", "Gold"]]){
			const element = document.getElementById(id + "Cost" + suffix);
			if (!element) continue; // this vampire does not cost that resource
			element.textContent = formatNumber(price[kind]);
			element.title = price[kind].toLocaleString("en-US");
			element.classList.toggle("price-short", Inv.items[kind] < price[kind]); // not enough of it yet
		}
	}
	
	document.getElementById("familiarLimit").innerHTML = Familiars.maxLimit;
	if (upgradeMenu.isOpen()) upgradeMenu.render();

	document.getElementById("buildingHutCost").innerHTML = myTown.Buildings.Hut.cost;
	document.getElementById("buildingMineCost").innerHTML = myTown.Buildings.Mine.cost;
	document.getElementById("buildingFarmCost").innerHTML = myTown.Buildings.Farm.cost;
	document.getElementById("buildingLumberMillCost").innerHTML = myTown.Buildings.LumberMill.cost;

	const temple = myTown.Buildings.BloodTemple;
	document.getElementById("buildingBloodTempleWood").innerHTML = temple.cost.wood;
	document.getElementById("buildingBloodTempleIron").innerHTML = temple.cost.iron;
	document.getElementById("buildingBloodTempleBronze").innerHTML = temple.cost.bronze;
	document.getElementById("buildingBloodTempleGold").innerHTML = temple.cost.gold;
	document.getElementById("buildingBloodTempleFamiliarsRequired").innerHTML = temple.workersRequired;

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

	//Player

	//Vampire

	//map
	

	
	
}, 1000);

//Which way each resource went in the last round: more earned than used (up), or the opposite (down).
//Only what the game does by itself counts (gathering, mining, feeding, blessings), not what the player buys.
const STORAGE_KINDS = ["blood", "humanFood", "wood", "iron", "bronze", "gold"];
const lastRoundChange = {};

function showTrends(){
	for (const kind of STORAGE_KINDS){
		const element = document.getElementById(kind + "Trend");
		const change = lastRoundChange[kind] || 0;
		const direction = change > 0.0001 ? "up" : change < -0.0001 ? "down" : "";
		element.className = direction ? "trend trend-" + direction : "trend";
		const amount = formatNumber(Math.abs(change) < 10 ? Math.round(Math.abs(change) * 10) / 10 : Math.round(Math.abs(change)));
		element.title = direction === "up" ? "Earned more than used last round (+" + amount + ")"
			: direction === "down" ? "Used more than earned last round (-" + amount + ")" : "";
		element.setAttribute("aria-label", direction ? (direction === "up" ? "rising" : "falling") : "");
	}
}

//every 10 seconds
window.setInterval(function(){
	const before = { ...Inv.items };

	//Familiars
	Familiars.update(Inv, House);

	//Inventory
	Inv.updateTen();

	//House
	const influenceMultiplier = myTown.influenceMultiplier(document, updateBox, Inv);
	const newLevel = House.updateTen(Account, document, influenceMultiplier);
	if (newLevel) announceLevelUp(newLevel);

	//Player

	//Vampire

	//Town
	myTown.updateTen(Inv, document, updateBox, Familiars);

	for (const kind of STORAGE_KINDS) lastRoundChange[kind] = Inv.items[kind] - before[kind];
	showTrends();

	//save
	save();
}, 10000);

//every minute
window.setInterval(function(){
	//Event handler - every minute has a 10% chance of triggering an event
	// ...but only once the first building stands: nothing happens to a settlement that has not started
	const buildings = myTown.Buildings;
	const hasBuilding = [buildings.Hut, buildings.Mine, buildings.Farm, buildings.LumberMill, buildings.BloodTemple].some((building) => building.ammount > 0);
	if (hasBuilding && getRandomInt(0, 100) < 10){
		eventHandler.getRandomEvent(document);
	}
	//Familiars
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

const signUpBuilder = new AvatarBuilder(document.getElementById("signUpBuilder"), randomAvatar());
const signUpPublic = document.getElementById("signUpPublic");

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
	Profile.avatar = signUpBuilder.getValue();
	Profile.isPublic = signUpPublic.checked;
	signedUp = true;
	overlay.style.display = "none";
	sendProfile(Profile, true); // the character page (nothing to wait for if the server is away)
	chat?.lockName(vampireName);
	howToPlay.showOnce();
	updateBox.townUpdatesAdd("-- " + vampireName + " founds " + settlementName + " --", document);
	save();
})


//MY CHARACTER (look, description and privacy of the character page)
{
	const modal = document.getElementById("profileModal");
	const bio = document.getElementById("profileBio");
	const bioCount = document.getElementById("profileBioCount");
	const status = document.getElementById("profileStatus");
	const switches = {
		isPublic: document.getElementById("profilePublic"),
		showResources: document.getElementById("profileShowResources"),
		showMap: document.getElementById("profileShowMap"),
	};
	const accents = document.getElementById("profileAccents");
	const viewLink = document.getElementById("profileView");
	let accent = 0;
	const builder = new AvatarBuilder(document.getElementById("profileBuilder"), randomAvatar());

	ACCENTS.forEach((colour, index) => {
		const swatch = document.createElement("button");
		swatch.type = "button";
		swatch.className = "accent-swatch";
		swatch.style.backgroundColor = colour;
		swatch.title = ACCENT_NAMES[index];
		swatch.setAttribute("aria-label", ACCENT_NAMES[index]);
		swatch.addEventListener("click", () => { accent = index; markAccent(); });
		accents.appendChild(swatch);
	});
	function markAccent(){
		[...accents.children].forEach((swatch, index) => swatch.setAttribute("aria-pressed", String(index === accent)));
	}
	// Hiding the page hides what is on it, so the two detail switches only matter while it is public
	function syncSwitches(){
		for (const key of ["showResources", "showMap"]) switches[key].disabled = !switches.isPublic.checked;
	}
	switches.isPublic.addEventListener("change", syncSwitches);
	bio.addEventListener("input", () => { bioCount.textContent = String(Array.from(bio.value).length); });

	function open(){
		if (!signedUp) return;
		builder.setValue(Profile.avatar || defaultAvatar(Account.vampireName));
		bio.value = Profile.bio;
		bioCount.textContent = String(Array.from(bio.value).length);
		accent = Profile.accent;
		markAccent();
		for (const key of Object.keys(switches)) switches[key].checked = Profile[key];
		syncSwitches();
		status.textContent = "";
		status.className = "profile-status";
		viewLink.href = "player.html?name=" + encodeURIComponent(Account.vampireName);
		modal.style.display = "block";
		document.getElementById("profileSave").focus();
	}
	function close(){ modal.style.display = "none"; }

	document.getElementById("profileButton").addEventListener("click", open);
	document.getElementById("profileClose").addEventListener("click", close);
	document.getElementById("profileClose").addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " "){ event.preventDefault(); close(); }
	});
	modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
	document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.style.display === "block") close(); });

	document.getElementById("profileSave").addEventListener("click", async () => {
		const candidate = {
			avatar: builder.getValue(),
			bio: Array.from(bio.value.replace(/\s+/g, " ").trim()).slice(0, 150).join(""),
			accent,
			isPublic: switches.isPublic.checked,
			showResources: switches.showResources.checked,
			showMap: switches.showMap.checked,
		};
		status.className = "profile-status";
		status.textContent = "Saving…";
		const result = await sendProfile(candidate, true);
		if (!result.ok && !result.offline){
			status.textContent = result.error || "Could not save. Please try again.";
			return;
		}
		Object.assign(Profile, candidate);
		save();
		status.className = "profile-status good";
		status.textContent = result.offline ? "Saved on this computer. It will reach your page when the server is back." : "Saved.";
	});
}


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
	bloodTempleAmmount: field(myTown.Buildings.BloodTemple, "ammount"),
	bloodTempleBlessingRoundsLeft: field(myTown.Buildings.BloodTemple, "blessingRoundsLeft"),

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
	vampireMasterAmmount: field(VampireMaster, "ammount"),
	vampireElderAmmount: field(VampireElder, "ammount"),
	bloodDemonAmmount: field(BloodDemon, "ammount"),
	bloodLeviathanAmmount: field(BloodLeviathan, "ammount"),

	familiarAmmount: field(Familiars, "ammount"),
	familiarNotWorking: field(Familiars, "notWorking"),
	familiarLimit: field(Familiars, "maxLimit"),
	humanFoodGather: field(Familiars, "foodGather"),
	bloodVictimGather: field(Familiars, "bloodGather"),
	woodGather: field(Familiars, "woodGather"),

	newHumanFoodPerRound: field(Inv, "newHumanFoodPerRound"),
	newBloodPerRound: field(Inv, "newBloodPerRound"),

	diceApplied: field(diceApplied, "ids"),

	xp: field(House, "xp"),
	level: field(House, "level"),

	profile: [() => Profile, (value) => {
		if (!value || typeof value !== "object") return;
		if (value.avatar && typeof value.avatar === "object") Profile.avatar = normalizeAvatar(value.avatar);
		if (typeof value.bio === "string") Profile.bio = value.bio.slice(0, 150);
		if (Number.isInteger(value.accent) && value.accent >= 0 && value.accent < ACCENTS.length) Profile.accent = value.accent;
		for (const key of ["isPublic", "showResources", "showMap"]) if (typeof value[key] === "boolean") Profile[key] = value[key];
	}],

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

	const savegame = readSave();
	newGame(); // random terrain everywhere; a saved map is put on top of it below

	if (savegame){
		for (const [key, [, set]] of Object.entries(saveFields)){
			if (savegame[key] !== undefined && savegame[key] !== null) set(savegame[key]);
		}
		// The Overloard was renamed Vampire Master: owners keep theirs
		if (savegame.vampireMasterAmmount === undefined && savegame.overloardAmmount > 0) VampireMaster.ammount = savegame.overloardAmmount;
		Upgrades.applyGains(myTown.Buildings.Farm, myTown.Buildings.LumberMill, myTown.Buildings.Mine); // tool bonuses follow the number of tools
		myTown.loadTiles(savegame.tiles, savegame.mapWidth);
		myTown.loadTileLevels(savegame.tileLevels, savegame.mapWidth);
		signedUp = savegame.signedUp === true;
		// Fire guards no longer exist: their familiars are free to work elsewhere again
		if (savegame.fireGuard > 0) Familiars.notWorking += savegame.fireGuard;

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

//The character page: look, description, privacy and a snapshot of the map
function mapSnapshot(){
	const count = myTown.mapWidth * myTown.mapHeight;
	let tiles = "";
	let levels = "";
	for (let i = 0; i < count; i++){
		const type = myTown.tiles["tile" + i];
		tiles += Number.isInteger(type) && type > 0 && type <= 8 ? type : 0;
		levels += (myTown.tileLevels["tile" + i] || 0).toString(36).slice(0, 1);
	}
	return { width: myTown.mapWidth, height: myTown.mapHeight, tiles, levels };
}

let profileLastSent = "";
let profileLastTry = 0;

// Answers { ok } , { ok: false, error } (the server refused) or { ok: false, offline: true }.
// Without force it only sends when something changed, and at most once a minute.
async function sendProfile(candidate = Profile, force = false){
	const body = JSON.stringify({
		id: playerSync.id,
		avatar: normalizeAvatar(candidate.avatar || defaultAvatar(Account.vampireName)),
		bio: candidate.bio,
		accent: candidate.accent,
		isPublic: candidate.isPublic,
		showResources: candidate.showResources,
		showMap: candidate.showMap,
		map: mapSnapshot(),
	});
	if (!force && (body === profileLastSent || Date.now() - profileLastTry < 60000)) return { ok: true };
	profileLastTry = Date.now();
	try {
		const response = await fetch(PROFILE_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
		if (response.ok){
			profileLastSent = body;
			return { ok: true };
		}
		const data = await response.json().catch(() => ({}));
		return { ok: false, status: response.status, error: data.error || "" };
	} catch {
		return { ok: false, offline: true };
	}
}

async function syncPlayerFile(){
	const result = await playerSync.save(playerProfile());
	if (result.ok) sendProfile();
	if ((result.status === 409 || result.status === 400) && signedUp){
		// The server says another player has this name (it could not be checked while offline).
		signedUp = false;
		save();
		showSignUp(result.error || "That vampire name is already taken. Choose another.");
	}
}

function save(){
	const data = { signedUp, tiles: myTown.tiles, tileLevels: myTown.tileLevels, mapWidth: myTown.mapWidth, mapHeight: myTown.mapHeight };
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

	// An announcement that fails must never stop the game's round (save, town update...)
	try {
		chat?.announce(levelUpMessage(level), Account.vampireName);
	} catch (error) {
		console.error("Level-up announcement failed:", error);
	}
}

// Income per 10 seconds, rounded (659.3k); hovering shows the exact rounded amount
function showRate(id, amount){
	const element = document.getElementById(id);
	element.textContent = formatRate(amount);
	element.title = (Math.round(amount * 10) / 10).toLocaleString("en-US");
}

// Storage line with an easy-to-read number (1.2M); hovering shows the exact amount
function showStorage(id, amount){
	const element = document.getElementById(id);
	element.textContent = formatNumber(amount);
	element.title = Math.floor(amount).toLocaleString("en-US");
}

// Short number for the chat: 1234 -> 1234, 250000 -> 250k, 3200000 -> 3.2M
function shortNumber(value){
	value = Number(value) || 0;
	if (value >= 1e6) return (Math.round(value / 1e5) / 10) + "M";
	if (value >= 1e5) return Math.round(value / 1e3) + "k";
	return String(Math.round(value * 10) / 10);
}

// The text posted in the chat when the player reaches a new level (the server allows 300 characters)
function levelUpMessage(level){
	const n = shortNumber;
	const items = Inv.items;
	return "LEVEL UP! " + Account.vampireName + " of " + Account.houseName + " reached level " + level +
		" | Stats: blood +" + n(Inv.newBloodPerRound) + ", food +" + n(Inv.newHumanFoodPerRound) +
		", wood +" + n(Inv.newWoodPerRound) + " per 10s" +
		" | Familiars: " + n(Familiars.ammount) +
		" | Storage: blood " + n(items.blood) + ", food " + n(items.humanFood) + ", wood " + n(items.wood) +
		", iron " + n(items.iron) + ", bronze " + n(items.bronze) + ", gold " + n(items.gold);
}

function deleteSave(){
	localStorage.removeItem("save");
	location.reload(); // start a new game (otherwise the next autosave would write the old one back)
}

load();
