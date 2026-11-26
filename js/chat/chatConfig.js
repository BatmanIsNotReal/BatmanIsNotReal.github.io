// Where the chat server lives.
//
// "/api/chat" works when the game is opened through server.js (node server.js).
//
// If the game is hosted somewhere else (for example GitHub Pages) and the chat
// server runs on another address, put the full address here, for example:
//   export const CHAT_API_URL = "https://my-chat-server.example.com/api/chat";
export const CHAT_API_URL = "https://batmanisnotrealgithubio-production-1a906bae.up.railway.app/api/chat";

// The player file is saved by the same server, next to the chat.
export const PLAYER_API_URL = CHAT_API_URL.replace(/\/chat$/, "/player");

// ...and the count of active players.
export const ONLINE_API_URL = CHAT_API_URL.replace(/\/chat$/, "/online");

// ...and the dice game.
export const DICE_API_URL = CHAT_API_URL.replace(/\/chat$/, "/dice");

// ...and the character pages.
export const PROFILE_API_URL = CHAT_API_URL.replace(/\/chat$/, "/profile");

// ...and so is the leaderboard.
export const LEADERBOARD_API_URL = CHAT_API_URL.replace(/\/chat$/, "/leaderboard");

// GIF search in the chat uses GIPHY. This key is visible to anyone who views the page
// source (that is normal for GIPHY keys); in your GIPHY developer dashboard you can
// delete and replace it at any time. Leave it empty ("") to hide the GIF button.
export const GIPHY_API_KEY = "o7xku0eaOLKGG9TQvfExci26j0HXVCHZ";

// ...and the underground: a list of who is down there, and the live connection for the fights.
export const UNDERGROUND_API_URL = CHAT_API_URL.replace(/\/chat$/, "/underground");
// ...and the tavern and the friend list.
export const TAVERN_WS_URL = CHAT_API_URL.replace(/^http/, "ws").replace(/\/api\/chat$/, "/ws/tavern");
export const FRIENDS_API_URL = CHAT_API_URL.replace(/\/chat$/, "/friends");
export const UNDERGROUND_WS_URL = CHAT_API_URL.replace(/^http/, "ws").replace(/\/api\/chat$/, "/ws/underground");
