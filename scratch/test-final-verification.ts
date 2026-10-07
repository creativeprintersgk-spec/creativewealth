import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- 1. Testing PPF in PMS Workspace ---');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Open Krisha Inv
  const openPortBtn = page.locator('button:has-text("Open Portfolio")');
  await openPortBtn.click();
  await page.waitForTimeout(500);

  const krishaOption = page.locator('label:has-text("Krisha Inv"), div:has-text("Krisha Inv")').last();
  await krishaOption.click();
  await page.waitForTimeout(500);

  const openSelectedBtn = page.locator('button:has-text("Open Selected")');
  await openSelectedBtn.click();
  await page.waitForTimeout(2000);

  // Click on "PPF / EPF" tab
  const ppfTabBtn = page.locator('button:has-text("PPF / EPF")');
  if (await ppfTabBtn.count() > 0) {
    await ppfTabBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/verified_ppf_no_avg_price.png' });
  }

  // Check row data
  const pmsPpfText = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr')).map(r => r.innerText);
    return rows;
  });
  console.log('PMS PPF Table Rows:', pmsPpfText);

  console.log('\n--- 2. Testing Bank Ledger Drilldown in Balance Sheet ---');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click on a Kotak Bank ledger
  const kotakLink = page.locator('text=Kotak Bank').first();
  if (await kotakLink.count() > 0) {
    await kotakLink.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'scratch/verified_bank_modal_mprofit.png' });

    const modalData = await page.evaluate(() => {
      const modal = document.querySelector('.modal-box');
      if (!modal) return null;
      return {
        hasDeposit: modal.innerText.includes('(Deposit)'),
        hasWithdrawal: modal.innerText.includes('(Withdrawal)'),
        headerPeriod: modal.querySelector('.modal-header')?.textContent || '',
        firstDate: modal.querySelector('tbody tr td')?.textContent || '',
      };
    });
    console.log('Bank Modal Verification:', JSON.stringify(modalData, null, 2));

    // Close modal
    const closeBtn = page.locator('.modal-close');
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('\n--- 3. Testing Capital Gains Detailed View Back & Close Buttons ---');
  await page.goto('http://localhost:5173/capital-gains', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click first row in the capital gains table
  const cgRow = page.locator('table tbody tr').first();
  if (await cgRow.count() > 0) {
    await cgRow.click();
    await page.waitForTimeout(1500);

    // Switch to Detailed tab
    const detailedTab = page.locator('button:has-text("Detailed Trade Lots (ITR Format)")');
    await detailedTab.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'scratch/verified_cg_renderer_opened.png' });

    // Check BACK button
    const backBtn = page.locator('button:has-text("BACK")');
    const hasBack = await backBtn.isVisible();
    console.log('BACK button visible:', hasBack);

    // Click BACK
    await backBtn.click();
    await page.waitForTimeout(1000);

    const isBackToSummary = await page.locator('text=Tax Category Summary').first().isVisible();
    console.log('Clicking BACK successfully returned to Summary tab:', isBackToSummary);
    await page.screenshot({ path: 'scratch/verified_cg_back_to_summary.png' });

    // Switch to detailed again and test X button
    await detailedTab.click();
    await page.waitForTimeout(1500);

    const xBtn = page.locator('.print-modal-backdrop button:has(svg.lucide-x)').first();
    console.log('X button visible:', await xBtn.isVisible());
    await xBtn.click();
    await page.waitForTimeout(1000);

    const isModalClosed = (await page.locator('.modal-overlay').count()) === 0;
    console.log('Clicking X successfully closed the modal completely:', isModalClosed);
    await page.screenshot({ path: 'scratch/verified_cg_modal_closed.png' });
  }

  await browser.close();
  console.log('\nAll verifications completed!');
})();
