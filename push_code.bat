@echo off
echo Initializing Git repository...
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/A91A1214/Build-Payment-Gateway
echo.
echo Pushing to GitHub...
git push -u origin main
echo.
echo Done!
pause
