const { chromium } = require('playwright');

async function run() {
  console.log("Launching Chromium to test PMS Workspace Mutual Funds classification...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:5173/pms', { timeout: 15000, waitUntil: 'networkidle' });
    console.log("Page loaded. Taking screenshot of PMS Workspace...");
    await page.screenshot({ path: 'scratch/pms_fixed.png', fullPage: true });
    console.log("Saved screenshot to scratch/pms_fixed.png");
  } catch (err) {
    console.error("Test failed:", err.message);
  } finally {
    await browser.close();
  }
}

run();
