import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. Navigating to PMS Workspace...');
  await page.goto('http://localhost:5173/pms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check PPF table in PMS Workspace
  console.log('2. Checking PPF holdings in PMS Workspace...');
  // Look for PPF rows
  const pageContent = await page.content();
  const hasPPFPRS = pageContent.includes('PPF PRS');
  console.log('Has PPF PRS in PMS Workspace:', hasPPFPRS);

  // Take screenshot of PMS Workspace
  await page.screenshot({ path: 'scratch/pms_ppf_no_avg_price.png' });

  // 3. Navigating to Balance Sheet to open Bank ledger modal
  console.log('3. Navigating to Balance Sheet...');
  await page.goto('http://localhost:5173/balance-sheet', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find a Bank ledger to click
  console.log('4. Clicking a Bank ledger row...');
  const bankRow = page.locator('text=Kotak Bank').first();
  if (await bankRow.isVisible()) {
    await bankRow.click();
    await page.waitForTimeout(1500);

    // Verify Deposit and Withdrawal in modal
    const modalText = await page.locator('.modal-box').textContent();
    console.log('Modal contains (Deposit):', modalText?.includes('(Deposit)'));
    console.log('Modal contains (Withdrawal):', modalText?.includes('(Withdrawal)'));
    
    // Check if dates are formatted as DD-MMM-YYYY (e.g. Apr, May, Jun, etc.)
    const hasMonthName = /-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-/.test(modalText || '');
    console.log('Modal dates formatted as DD-MMM-YYYY:', hasMonthName);

    await page.screenshot({ path: 'scratch/bank_ledger_drilldown_mprofit_style.png' });

    // Close modal
    const closeBtn = page.locator('.modal-close').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Navigating to Capital Gains page
  console.log('5. Navigating to Capital Gains page...');
  await page.goto('http://localhost:5173/capital-gains', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click on a portfolio card or row to open PortfolioTaxModal
  const viewDetailsBtn = page.locator('button:has-text("View Detailed Lots"), tr.cursor-pointer, table tbody tr').first();
  if (await viewDetailsBtn.isVisible()) {
    await viewDetailsBtn.click();
    await page.waitForTimeout(1500);

    // Click on "Detailed Trade Lots (ITR Format)"
    const detailedTab = page.locator('button:has-text("Detailed Trade Lots (ITR Format)")');
    if (await detailedTab.isVisible()) {
      await detailedTab.click();
      await page.waitForTimeout(1500);

      // Verify CapitalGainsRenderer is visible
      const backBtn = page.locator('button:has-text("BACK")');
      const isBackVisible = await backBtn.isVisible();
      console.log('BACK button is visible in CapitalGainsRenderer:', isBackVisible);

      await page.screenshot({ path: 'scratch/capital_gains_renderer_before_back.png' });

      // Click BACK button
      console.log('Clicking BACK button...');
      await backBtn.click();
      await page.waitForTimeout(1000);

      const isSummaryVisible = await page.locator('text=Tax Category Summary').first().isVisible();
      console.log('Returned to Summary tab after clicking BACK:', isSummaryVisible);

      await page.screenshot({ path: 'scratch/capital_gains_after_back.png' });
    }
  }

  await browser.close();
  console.log('Verification completed successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
