const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`PAGE ${msg.type().toUpperCase()}:`, msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });
  page.on('pageerror', error => console.log('PAGE UNCAUGHT ERROR:', error.message));

  await page.goto('http://localhost:5173/import');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await browser.close();
})();
