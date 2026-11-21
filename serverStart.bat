@echo off
where node >nul 2>nul
if %errorlevel%==0 (
    node server.js
) else (
    echo Node.js was not found, so the chat will not work. Starting the plain game server instead.
    echo Install Node.js from https://nodejs.org to enable the chat.
    python -m http.server
)
pause
