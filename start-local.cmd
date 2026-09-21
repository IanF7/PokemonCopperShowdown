@echo off
rem Builds the client + server and runs the whole thing at http://localhost:8000
rem (the server now serves the client itself: no Python server, no testclient key)

cd /d "%~dp0pokemon-showdown-client" || goto :fail
echo === Building client data from ..\pokemon-showdown ===
call node build-tools/build-indexes || goto :fail
echo === Building client ===
rem (a "'php' is not recognized" message here is harmless)
call node build || goto :fail

cd /d "%~dp0pokemon-showdown" || goto :fail
echo === Building server ===
call npm.cmd run build || goto :fail

rem open the browser once the server has had a few seconds to start
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:8000"
echo === Starting server (Ctrl+C to stop) ===
node pokemon-showdown 8000
goto :eof

:fail
echo.
echo Build failed - see the errors above.
pause
exit /b 1
