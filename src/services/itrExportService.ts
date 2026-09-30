import ExcelJS from 'exceljs';
import { getStoredPortfolios, getCapitalGains } from '../logic';

interface QuarterBreakdown {
  label: string;
  startDate: string;
  endDate: string;
  stcg111A: number;
  ltcg112A: number;
  debt50AA: number;
  otherStcg: number;
  otherLtcg: number;
  totalGain: number;
}

export async function generateItrScheduleCgExcel(
  financialYear: string,
  portfolioId?: number
): Promise<Blob> {
  const parts = financialYear.split('-');
  const startYear = parseInt(parts[0], 10) || 2024;
  const endYear = parseInt(parts[1], 10) || 2025;

  const fromDate = `${startYear}-04-01`;
  const toDate = `${endYear}-03-31`;

  const allPortfolios = getStoredPortfolios();
  const targetPfs = portfolioId
    ? [portfolioId]
    : allPortfolios.map(p => Number(p.id));

  // Fetch detailed capital gains records using the central engine
  const rows = getCapitalGains(targetPfs, fromDate, toDate) || [];

  // Define the 5 mandatory quarters in Indian ITR Schedule CG
  const quarters: QuarterBreakdown[] = [
    { label: 'Upto 15-Jun',       startDate: `${startYear}-04-01`, endDate: `${startYear}-06-15`, stcg111A: 0, ltcg112A: 0, debt50AA: 0, otherStcg: 0, otherLtcg: 0, totalGain: 0 },
    { label: '16-Jun to 15-Sep',  startDate: `${startYear}-06-16`, endDate: `${startYear}-09-15`, stcg111A: 0, ltcg112A: 0, debt50AA: 0, otherStcg: 0, otherLtcg: 0, totalGain: 0 },
    { label: '16-Sep to 15-Dec',  startDate: `${startYear}-09-16`, endDate: `${startYear}-12-15`, stcg111A: 0, ltcg112A: 0, debt50AA: 0, otherStcg: 0, otherLtcg: 0, totalGain: 0 },
    { label: '16-Dec to 15-Mar',  startDate: `${startYear}-12-16`, endDate: `${endYear}-03-15`,   stcg111A: 0, ltcg112A: 0, debt50AA: 0, otherStcg: 0, otherLtcg: 0, totalGain: 0 },
    { label: '16-Mar to 31-Mar',  startDate: `${endYear}-03-16`,   endDate: `${endYear}-03-31`,   stcg111A: 0, ltcg112A: 0, debt50AA: 0, otherStcg: 0, otherLtcg: 0, totalGain: 0 },
  ];

  // Bucket trades into quarters
  rows.forEach((r: any) => {
    const sellDate = (r.sellDate || '').slice(0, 10);
    const gain = Number(r.gainLoss || 0);
    const gainType = (r.gainType || '').toUpperCase();
    const assetType = r.assetType || 50;
    const isDebt = assetType === 61 || assetType === 62;
    const buyDate = (r.buyDate || '').slice(0, 10);
    const isSec50AA = isDebt && buyDate >= '2023-04-01';

    const q = quarters.find(qtr => sellDate >= qtr.startDate && sellDate <= qtr.endDate);
    if (!q) return;

    if (isSec50AA) {
      q.debt50AA += gain;
    } else if (gainType === 'STCG' && [50, 60].includes(assetType)) {
      q.stcg111A += gain;
    } else if (gainType === 'LTCG' && [50, 60].includes(assetType)) {
      q.ltcg112A += gain;
    } else if (gainType === 'STCG') {
      q.otherStcg += gain;
    } else {
      q.otherLtcg += gain;
    }
    q.totalGain += gain;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WealthCore Accounting & PMS';
  workbook.created = new Date();

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: Schedule CG Quarterly Breakdown
  // ─────────────────────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('ITR Schedule CG');

  // Title Block
  ws1.mergeCells('A1:G1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `ITR-2 / ITR-3 SCHEDULE CG — CAPITAL GAINS QUARTERLY SUMMARY (FY ${financialYear})`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 36;

  // Subtitle
  ws1.mergeCells('A2:G2');
  const subCell = ws1.getCell('A2');
  subCell.value = 'Quarterly breakdown required for advance tax interest calculations (Section 234C)';
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 20;

  ws1.addRow([]); // Blank row

  // Table Headers
  const headerRow = ws1.addRow([
    'Period / Quarter',
    'Sec 111A (Equity STCG)',
    'Sec 112A (Equity LTCG)',
    'Sec 50AA (Debt MF)',
    'Other STCG',
    'Other LTCG',
    'Total Capital Gain'
  ]);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Quarter Data Rows
  quarters.forEach((q) => {
    const row = ws1.addRow([
      q.label,
      q.stcg111A,
      q.ltcg112A,
      q.debt50AA,
      q.otherStcg,
      q.otherLtcg,
      q.totalGain
    ]);
    row.height = 22;
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    for (let c = 2; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.numFmt = '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }
  });

  // Total Summary Row
  const total111A = quarters.reduce((s, q) => s + q.stcg111A, 0);
  const total112A = quarters.reduce((s, q) => s + q.ltcg112A, 0);
  const total50AA = quarters.reduce((s, q) => s + q.debt50AA, 0);
  const totalOtherStcg = quarters.reduce((s, q) => s + q.otherStcg, 0);
  const totalOtherLtcg = quarters.reduce((s, q) => s + q.otherLtcg, 0);
  const grandTotal = quarters.reduce((s, q) => s + q.totalGain, 0);

  const totalRow = ws1.addRow([
    'Full Year Total',
    total111A,
    total112A,
    total50AA,
    totalOtherStcg,
    totalOtherLtcg,
    grandTotal
  ]);
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    if (colNumber > 1) cell.numFmt = '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"';
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
  });

  ws1.columns = [
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 22 }
  ];

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: Trade-by-Trade Tax Audit Trail
  // ─────────────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Trade-Level Audit Trail');

  const ws2Header = ws2.addRow([
    'ISIN',
    'Security Name',
    'Portfolio',
    'Buy Date',
    'Sell Date',
    'Holding (Days)',
    'Quantity',
    'Buy Rate',
    'Sell Rate',
    'Sale Value',
    'Cost of Acquisition',
    'Transfer Exp.',
    'Net Realized Gain',
    'Tax Section',
    'Applicable Rate'
  ]);
  ws2Header.height = 26;
  ws2Header.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  rows.forEach((r: any) => {
    const isDebt = r.assetType === 61 || r.assetType === 62;
    const isSec50AA = isDebt && (r.buyDate || '').slice(0, 10) >= '2023-04-01';
    let sec = r.gainType === 'LTCG' ? 'Sec 112A' : 'Sec 111A';
    if (isSec50AA) sec = 'Sec 50AA';

    const row = ws2.addRow([
      r.isin || '-',
      r.assetName || 'Asset',
      r.portfolioName || '',
      r.buyDate || '',
      r.sellDate || '',
      r.holdingDays || 0,
      r.quantity || 0,
      Number(r.buyPrice || 0),
      Number(r.sellPrice || 0),
      Number(r.saleProceeds || 0),
      Number(r.costBasis || 0),
      0, // transfer exp
      Number(r.gainLoss || 0),
      sec,
      `${r.taxRate || 15}%`
    ]);

    row.getCell(8).numFmt = '₹#,##0.00';
    row.getCell(9).numFmt = '₹#,##0.00';
    row.getCell(10).numFmt = '₹#,##0.00';
    row.getCell(11).numFmt = '₹#,##0.00';
    row.getCell(12).numFmt = '₹#,##0.00';
    row.getCell(13).numFmt = '₹#,##0.00;[Red]-₹#,##0.00;"₹0.00"';
  });

  ws2.columns = [
    { width: 16 },
    { width: 30 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
    { width: 14 }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadItrScheduleCg(financialYear: string, portfolioId?: number) {
  const blob = await generateItrScheduleCgExcel(financialYear, portfolioId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ITR_Schedule_CG_FY${financialYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
