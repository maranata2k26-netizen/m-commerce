@echo off
setlocal EnableExtensions
title M Commerce - Instalador Panel Maestro V8
color 0B

echo ========================================================
echo          M COMMERCE - PANEL MAESTRO - V8
echo ========================================================
echo.
echo Iniciando instalacion...
echo.

set "URL=https://m-commerce-ar.vercel.app/app-maestro/panel?desktop=1"
set "BROWSER="

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined BROWSER (
  echo ERROR: No encontre Microsoft Edge ni Google Chrome.
  echo.
  echo Instala o actualiza Edge/Chrome y volve a ejecutar este archivo.
  echo.
  pause
  exit /b 10
)

echo Navegador encontrado:
echo %BROWSER%
echo.

set "DESKTOP=%USERPROFILE%\Desktop"
if defined OneDrive if exist "%OneDrive%\Desktop" set "DESKTOP=%OneDrive%\Desktop"
if defined OneDriveConsumer if exist "%OneDriveConsumer%\Desktop" set "DESKTOP=%OneDriveConsumer%\Desktop"

if not exist "%DESKTOP%" (
  echo ERROR: No pude localizar la carpeta Escritorio.
  echo Ruta probada: %DESKTOP%
  echo.
  pause
  exit /b 11
)

set "VBS=%TEMP%\mcommerce_master_%RANDOM%_%RANDOM%.vbs"
set "SHORTCUT=%DESKTOP%\M Commerce - Panel Maestro.lnk"
set "LAUNCHER=%DESKTOP%\M Commerce - Panel Maestro.bat"

echo Creando acceso directo en:
echo %SHORTCUT%
echo.

>"%VBS%" echo Set WshShell = CreateObject("WScript.Shell")
>>"%VBS%" echo Set Link = WshShell.CreateShortcut("%SHORTCUT%")
>>"%VBS%" echo Link.TargetPath = "%BROWSER%"
>>"%VBS%" echo Link.Arguments = "--app=""%URL%"" --start-maximized"
>>"%VBS%" echo Link.WorkingDirectory = "%~dp0"
>>"%VBS%" echo Link.IconLocation = "%BROWSER%,0"
>>"%VBS%" echo Link.Description = "M Commerce - Panel Maestro"
>>"%VBS%" echo Link.Save

cscript //nologo "%VBS%"
set "CSCRIPT_CODE=%ERRORLEVEL%"
del /q "%VBS%" >nul 2>&1

>"%LAUNCHER%" echo @echo off
>>"%LAUNCHER%" echo start "" "%BROWSER%" --app="%URL%" --start-maximized

if not "%CSCRIPT_CODE%"=="0" (
  echo.
  echo AVISO: Windows no pudo crear el acceso directo .lnk.
  echo Pero deje un lanzador funcional en el Escritorio:
  echo %LAUNCHER%
  echo.
) else (
  echo Acceso directo creado correctamente.
)

echo Abriendo M Commerce en modo aplicacion...
start "" "%BROWSER%" --app="%URL%" --start-maximized

echo.
echo ========================================================
echo INSTALACION FINALIZADA
echo.
echo Busca en tu Escritorio:
echo   M Commerce - Panel Maestro
echo.
echo Si el acceso directo .lnk no aparece, usa:
echo   M Commerce - Panel Maestro.bat
echo ========================================================
echo.
pause
exit /b 0