const { chromium } = require('playwright');

async function run() {
  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to local dev server http://localhost:5173 ...");
  try {
    await page.goto('http://localhost:5173', { timeout: 15000, waitUntil: 'load' });
    const title = await page.title();
    console.log("✅ Page loaded successfully!");
    console.log("Page Title:", title);
  } catch (err) {
    console.error("❌ Navigation failed:", err.message);
  } finally {
    await browser.close();
  }
}

run();
