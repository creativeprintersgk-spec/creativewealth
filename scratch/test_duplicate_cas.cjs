const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
  });

  console.log("Navigating to Import page...");
  await page.goto('http://localhost:5173/import');

  console.log("Waiting for database initialization...");
  const camsCasButton = await page.waitForSelector('button:has-text("CAMS-CAS")', { timeout: 60000 });
  console.log("Tab buttons rendered.");

  console.log("Clicking CAMS-CAS tab...");
  await camsCasButton.click();
  await page.waitForTimeout(2000);
  
  console.log("Uploading CAS A.pdf a second time...");
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  await fileInput.setInputFiles('C:\\Users\\Admin\\Desktop\\CAS A.pdf');

  console.log("Waiting for rows to render (waiting for selector 'table tbody tr')...");
  // Wait up to 30 seconds for rows to render
  await page.waitForSelector('table tbody tr', { timeout: 30000 });
  console.log("Rows rendered. Giving a tiny extra wait to ensure state stabilizes...");
  await page.waitForTimeout(2000);

  // Evaluate the rows of the CAMS-CAS transaction table
  const rowDetails = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.map((row) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      const text = row.innerText || '';
      const style = window.getComputedStyle(row);
      return {
        text: text.replace(/\n/g, ' | '),
        checked: checkbox ? checkbox.checked : null,
        backgroundColor: style.backgroundColor
      };
    });
  });

  console.log("\n--- PARSED TRANSACTIONS ROW DETAILS ---");
  rowDetails.forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`);
    console.log(`  Text: ${row.text}`);
    console.log(`  Checked (Selected for Import): ${row.checked}`);
    console.log(`  Background Color: ${row.backgroundColor}`);
  });
  console.log("----------------------------------------\n");

  await page.screenshot({ path: 'scratch/duplicate_state.png' });
  console.log("Saved duplicate state screenshot to scratch/duplicate_state.png");

  await browser.close();
  process.exit(0);
})();
