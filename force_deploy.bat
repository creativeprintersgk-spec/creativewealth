echo We need to refresh your Vercel login.
call npx vercel login
echo.
echo Now deploying to Vercel directly...
call npx vercel --prod --yes
pause
