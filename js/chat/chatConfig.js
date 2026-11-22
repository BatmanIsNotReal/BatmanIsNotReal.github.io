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

// ...and so is the leaderboard.
export const LEADERBOARD_API_URL = CHAT_API_URL.replace(/\/chat$/, "/leaderboard");
