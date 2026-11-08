@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Phat hanh Notchy

rem Dang ban moi len GitHub: tang so phien ban, build, dang ban phat hanh, commit + push.
rem Ban be se tu nhan ban moi (khi mo app hoac trong vong 4 gio).

set GH="C:\Program Files\GitHub CLI\gh.exe"
if not exist %GH% (
  echo [LOI] Chua cai GitHub CLI. Chay: winget install GitHub.cli
  pause & exit /b
)
for /f "usebackq delims=" %%t in (`%GH% auth token`) do set GH_TOKEN=%%t
if "%GH_TOKEN%"=="" (
  echo [LOI] Chua dang nhap GitHub. Chay: gh auth login --web
  pause & exit /b
)

echo Loai ban moi:
echo   1 = sua loi        (vd 3.2.0 -^> 3.2.1)
echo   2 = tinh nang moi  (vd 3.2.0 -^> 3.3.0)
choice /c 12 /n /m "Chon 1 hoac 2: "
if errorlevel 2 (set BUMP=minor) else (set BUMP=patch)

set /p NOTE=Mo ta ngan ban nay (vd: sua loi chuyen bai YouTube): 

echo.
echo Build cau noi Rust (native)...
pushd native
"%USERPROFILE%\.cargo\bin\cargo.exe" build --release
if errorlevel 1 ( popd & echo [LOI] Build Rust that bai & pause & exit /b )
popd

echo.
echo Chay kiem thu (loi thi dung, khong dang ban loi)...
call npm test
if errorlevel 1 ( echo [LOI] Kiem thu that bai & pause & exit /b )
call npm run test:ui
if errorlevel 1 ( echo [LOI] Kiem thu giao dien that bai & pause & exit /b )
pushd native
"%USERPROFILE%\.cargo\bin\cargo.exe" test --release
if errorlevel 1 ( popd & echo [LOI] Kiem thu Rust that bai & pause & exit /b )
popd

call npm version %BUMP% --no-git-tag-version >nul
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set VER=%%v
echo Phien ban moi: %VER%

set ELECTRON_RUN_AS_NODE=
call npm run release
if errorlevel 1 ( echo [LOI] Dang ban phat hanh that bai & pause & exit /b )

%GH% release edit v%VER% --notes "%NOTE%" >nul 2>nul
git add -A
git commit -q -m "Ban %VER%: %NOTE%"
git push -q
echo.
echo Xong! Ban %VER% da len GitHub: https://github.com/iamna2000/notchy/releases/tag/v%VER%
pause
