const { chromium } = require('playwright');

async function run() {
  console.log("Launching Chromium to test Report Headers & Exports...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:5173/pms', { timeout: 20000, waitUntil: 'load' });
    await page.waitForTimeout(3000);
    console.log("✅ Page loaded successfully!");
  } catch (err) {
    console.error("Test failed:", err.message);
  } finally {
    await browser.close();
  }
}

run();
