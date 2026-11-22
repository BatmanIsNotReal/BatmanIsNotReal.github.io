@echo off
rem Removes leftover files the game does not use. Run it from the project folder.
rem Everything stays in your git history, so nothing is lost for good.
cd /d "%~dp0"

for %%F in (Chat.js files_2.zip files_css.zip js\Modalbox.js js\town\test.html) do (
    if exist "%%F" (
        del "%%F"
        echo Deleted %%F
    )
)

rem The unfinished scoreboard is not used by the game either. To remove it too,
rem delete the "rem " at the start of the next three lines.
rem if exist js\scoreboard rmdir /s /q js\scoreboard
rem if exist php rmdir /s /q php
rem if exist textFiles rmdir /s /q textFiles

pause
