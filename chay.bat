@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Notchy

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js, hoac chua khoi dong lai may sau khi cai.
  echo Hay cai Node.js ban LTS tai https://nodejs.org roi khoi dong lai may.
  pause
  exit /b
)

if not exist "package.json" (
  echo [LOI] Khong thay file package.json. Co the ban chua giai nen file zip.
  echo Hay chuot phai vao file zip, chon Extract All, roi mo lai chay.bat trong thu muc vua giai nen.
  pause
  exit /b
)

if exist "node_modules\electron\dist\electron.exe" goto run

echo Buoc 1: Cai dat thu vien, vui long doi...
call npm install
if exist "node_modules\electron\dist\electron.exe" goto run

echo.
echo Buoc 2: Chay bo cai dat cua Electron...
set ELECTRON_SKIP_BINARY_DOWNLOAD=
set ELECTRON_MIRROR=
node node_modules\electron\install.js
echo Ket qua buoc 2: ma loi %errorlevel%
if exist "node_modules\electron\dist\electron.exe" goto run

echo.
echo Buoc 3: Tai Electron truc tiep, vui long doi 1-3 phut...
set EV=33.4.11
for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/electron/package.json').version"`) do set EV=%%v
set ARCH=x64
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set ARCH=arm64
echo Phien ban Electron: %EV%  -  Kieu may: %ARCH%

call :download "https://github.com/electron/electron/releases/download/v%EV%/electron-v%EV%-win32-%ARCH%.zip"
if exist "node_modules\electron\dist\electron.exe" goto run

echo.
echo Thu lai bang may chu du phong...
call :download "https://npmmirror.com/mirrors/electron/%EV%/electron-v%EV%-win32-%ARCH%.zip"
if exist "node_modules\electron\dist\electron.exe" goto run

echo.
echo [LOI] Van chua co Electron. Thong tin de minh sua loi:
node -v
echo ELECTRON_SKIP_BINARY_DOWNLOAD=[%ELECTRON_SKIP_BINARY_DOWNLOAD%]
dir /b node_modules\electron
echo.
echo Hay chup man hinh cua so nay gui lai cho minh.
pause
exit /b

:download
if exist electron.zip del electron.zip
echo Dang tai: %~1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = 'Tls12'; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%~1' -OutFile 'electron.zip' -UseBasicParsing } catch { Write-Host ('Loi tai: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 exit /b 1
if not exist electron.zip exit /b 1
echo Dang giai nen...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path 'electron.zip' -DestinationPath 'node_modules\electron\dist' -Force } catch { Write-Host ('Loi giai nen: ' + $_.Exception.Message); exit 1 }"
del electron.zip
<nul set /p="electron.exe">"node_modules\electron\path.txt"
exit /b 0

:run
echo Dang mo Notchy...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-old.ps1" >nul 2>nul
wscript.exe //nologo "%~dp0launch.vbs"
exit 0
