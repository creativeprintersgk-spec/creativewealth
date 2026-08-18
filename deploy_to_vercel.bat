@echo off
title WealthCore - Deploy to Live (Vercel)
echo ======================================================================
echo             WEALTHCORE - 1-CLICK DEPLOY TO LIVE (VERCEL)
echo ======================================================================
echo.
cd /d "C:\Users\Admin\Desktop\wealthcore-clean"

echo [1/3] Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [!] Build error occurred. Please check code.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Pushing latest 33 commits to GitHub repositories...
echo - Pushing to saahil repository...
git push saahil main
echo - Pushing to origin repository...
git push origin main
echo - Pushing to vercel repository...
git push vercel main
echo - Pushing to prod repository...
git push prod main

echo.
echo [3/3] If Git push succeeded, Vercel will deploy automatically!
echo If you prefer direct CLI deployment, running Vercel CLI now:
echo.
call npx vercel --prod

echo.
echo ======================================================================
echo Deployment process finished! Check https://wealthcore-clean.vercel.app
echo ======================================================================
echo.
pause
