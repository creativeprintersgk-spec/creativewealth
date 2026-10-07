import React, { useState, useRef, useMemo } from 'react';
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportConfig } from '../ReportsModal';
import { type CapGainReportData } from '../../services/capitalGainsEngine';
import { formatInvestorName, getAssetISIN, getStoredPortfolios, formatDateDDMMMYYYY } from '../../logic';

interface CapitalGainsRendererProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  reportConfig: ReportConfig | null;
  reportData: CapGainReportData[] | null;
  onUpdateConfig?: (newConfig: ReportConfig) => void;
}

interface ReportRow {
  rowType: 'sec_header' | 'data' | 'sub_total' | 'grand_total' | 'spacer';
  secTitle?: string;
  data?: any;
  saleAmt?: number;
  acqCost?: number;
  gain?: number;
}

interface PageData {
  pageNumber: number;
  assetClass: string;
  rows: ReportRow[];
  hasFMV: boolean;
}

export default function CapitalGainsRenderer({
  isOpen,
  onClose,
  onBack,
  reportConfig,
  reportData,
  onUpdateConfig
}: CapitalGainsRendererProps) {
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onBack) onBack();
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onBack, onClose]);

  // Customization Modal State
  const [isCustomiseOpen, setIsCustomiseOpen] = useState(false);
  const allPortfolios = useMemo(() => getStoredPortfolios(), []);

  // Customization Form Local State
  const [selectedPortId, setSelectedPortId] = useState<string>(
    reportConfig?.options?.portfolios?.[0] || 'all'
  );
  const [selectedAssetType, setSelectedAssetType] = useState<string>(
    reportConfig?.options?.assetTypes?.[0] || 'All Assets'
  );
  const [selectedGainType, setSelectedGainType] = useState<'All' | 'STCG' | 'LTCG'>(
    reportConfig?.options?.gainType || 'All'
  );
  const [startDate, setStartDate] = useState<string>(
    reportConfig?.options?.dateRange?.start || '2025-04-01'
  );
  const [endDate, setEndDate] = useState<string>(
    reportConfig?.options?.dateRange?.end || '2026-03-31'
  );
  const [showISIN, setShowISIN] = useState<boolean>(true);

  if (!isOpen || !reportConfig) return null;

  const isITRFormat = reportConfig.reportName === 'Capital Gains - Income Tax Return Format';

  const formatCurrency = (val: number) => (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  const formatQty = (val: number) => {
    if (!val && val !== 0) return '0';
    const rounded = Number(val.toFixed(3));
    if (Number.isInteger(rounded)) {
      return rounded.toLocaleString('en-IN');
    }
    return rounded.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const formatPrice = (val: number) => {
    if (!val && val !== 0) return '0.00';
    const r2 = Number(val.toFixed(2));
    const r4 = Number(val.toFixed(4));
    if (r4 !== r2) {
      return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getColor = (val: number) => {
    if (val > 0) return '#16a34a';
    if (val < 0) return '#dc2626';
    return '#334155';
  };

  const formatDate = (dateStr?: string) => {
    return formatDateDDMMMYYYY(dateStr);
  };

  const currentPort = allPortfolios.find(p => String(p.id) === selectedPortId);
  const investor = currentPort ? (currentPort.portfolioName || currentPort.name || currentPort.investor_name || currentPort.full_name) : formatInvestorName(reportConfig.options?.portfolioName);

  const selectedTypes = reportConfig.options?.assetTypes || ['All Assets'];

  const netBuyValue = reportData?.reduce((acc, curr) => acc + curr.totalBuyValue, 0) || 0;
  const netSellValue = reportData?.reduce((acc, curr) => acc + curr.totalSellValue, 0) || 0;
  const netIntraday = reportData?.reduce((acc, curr) => acc + curr.totalIntraday, 0) || 0;
  const netSTCG = reportData?.reduce((acc, curr) => acc + curr.totalSTCG, 0) || 0;
  const netLTCG = reportData?.reduce((acc, curr) => acc + curr.totalLTCG, 0) || 0;

  // ── BUILD PAGINATED DATA STRUCTURE (MPROFIT PAGE SYSTEM) ──────────────────
  const pages: PageData[] = [];

  if (reportData && isITRFormat) {
    reportData.forEach(group => {
      const stcgMatches: any[] = [];
      const ltcgMatches: any[] = [];

      group.assets.forEach(scrip => {
        scrip.matches.forEach(m => {
          const isinVal = m.isin || (scrip as any).isin || getAssetISIN(Number(scrip.assetId)) || getAssetISIN(Number((m as any).amid || 0));
          const folioVal = m.folio || scrip.folio;
          const item = {
            rawSellDate: m.rawSellDate || m.sellDate || '',
            rawBuyDate: m.rawBuyDate || m.buyDate || '',
            saleDate: formatDate(m.sellDate),
            assetName: scrip.assetName,
            isin: showISIN ? isinVal : undefined,
            folio: folioVal,
            qtySold: m.quantity,
            salePrice: m.sellPrice,
            saleAmt: m.sellValue,
            purDate: formatDate(m.buyDate),
            purPrice: m.buyPrice,
            fmvPrice: m.fmvPrice || 0,
            caPrice: m.caPrice || m.buyPrice,
            acqCost: m.buyValue,
            gain: m.gain
          };
          if (m.gainType === 'STCG' || m.gainType === 'Intraday') {
            stcgMatches.push(item);
          } else {
            ltcgMatches.push(item);
          }
        });
      });

      // Sort chronologically by sale date, then asset name, then purchase date
      stcgMatches.sort((a, b) => {
        const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
        if (dtCmp !== 0) return dtCmp;
        const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
        if (nameCmp !== 0) return nameCmp;
        return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
      });

      ltcgMatches.sort((a, b) => {
        const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
        if (dtCmp !== 0) return dtCmp;
        const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
        if (nameCmp !== 0) return nameCmp;
        return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
      });

      const hasFMV = group.assetClass.toLowerCase().includes('stock');

      // ── Build STCG section rows ──
      const stcgRows: ReportRow[] = [];
      if (stcgMatches.length > 0 && (selectedGainType === 'All' || selectedGainType === 'STCG')) {
        const secTitle = reportData.length > 1 ? `Short Term Capital Gain on ${group.assetClass}` : `Short Term Capital Gain`;
        stcgRows.push({ rowType: 'sec_header', secTitle });
        stcgMatches.forEach(m => stcgRows.push({ rowType: 'data', data: m, secTitle }));
        const stcgSale = stcgMatches.reduce((s, x) => s + x.saleAmt, 0);
        const stcgAcq = stcgMatches.reduce((s, x) => s + x.acqCost, 0);
        const stcgGain = stcgMatches.reduce((s, x) => s + x.gain, 0);
        stcgRows.push({ rowType: 'sub_total', secTitle: `Total Short Term Capital Gain`, saleAmt: stcgSale, acqCost: stcgAcq, gain: stcgGain });
      }

      // ── Build LTCG section rows ──
      const ltcgRows: ReportRow[] = [];
      if (ltcgMatches.length > 0 && (selectedGainType === 'All' || selectedGainType === 'LTCG')) {
        const secTitle = reportData.length > 1 ? `Long Term Capital Gain on ${group.assetClass}` : `Long Term Capital Gain`;
        // Blank spacer row between STCG total and LTCG header
        if (stcgRows.length > 0) {
          ltcgRows.push({ rowType: 'spacer' });
        }
        ltcgRows.push({ rowType: 'sec_header', secTitle });
        ltcgMatches.forEach(m => ltcgRows.push({ rowType: 'data', data: m, secTitle }));
        const ltcgSale = ltcgMatches.reduce((s, x) => s + x.saleAmt, 0);
        const ltcgAcq = ltcgMatches.reduce((s, x) => s + x.acqCost, 0);
        const ltcgGain = ltcgMatches.reduce((s, x) => s + x.gain, 0);
        ltcgRows.push({ rowType: 'sub_total', secTitle: `Total Long Term Capital Gain`, saleAmt: ltcgSale, acqCost: ltcgAcq, gain: ltcgGain });
      }

      const grandTotalSale = (stcgMatches.reduce((s, x) => s + x.saleAmt, 0)) + (ltcgMatches.reduce((s, x) => s + x.saleAmt, 0));
      const grandTotalAcq = (stcgMatches.reduce((s, x) => s + x.acqCost, 0)) + (ltcgMatches.reduce((s, x) => s + x.acqCost, 0));
      const grandTotalGain = (stcgMatches.reduce((s, x) => s + x.gain, 0)) + (ltcgMatches.reduce((s, x) => s + x.gain, 0));

      const grandTotalRow: ReportRow = {
        rowType: 'grand_total',
        secTitle: `Grand Total`,
        saleAmt: grandTotalSale,
        acqCost: grandTotalAcq,
        gain: grandTotalGain
      };

      // ── Paginate: Combine STCG & LTCG for dense, optimal page utilization ──
      const ROWS_PER_PAGE = 14;

      const allClassRows: ReportRow[] = [];
      if (stcgRows.length > 0) allClassRows.push(...stcgRows);
      if (ltcgRows.length > 0) allClassRows.push(...ltcgRows);

      if (allClassRows.length > 0) {
        let i = 0;
        let pageNumInClass = 0;
        let lastActiveSecTitle = '';

        while (i < allClassRows.length) {
          pageNumInClass++;
          // For continuation pages, reserve 1 slot for the Contd header
          const currentLimit = (pageNumInClass > 1 && allClassRows[i]?.rowType === 'data')
            ? ROWS_PER_PAGE - 1
            : ROWS_PER_PAGE;

          let slice = allClassRows.slice(i, i + currentLimit);
          
          // Avoid leaving an orphaned sec_header at the very bottom of the page
          if (slice.length === currentLimit && slice[slice.length - 1]?.rowType === 'sec_header') {
            slice = slice.slice(0, slice.length - 1);
          }

          i += slice.length;

          // Track active section header title
          slice.forEach(r => {
            if (r.rowType === 'sec_header' && r.secTitle && !r.secTitle.includes('(Contd.)')) {
              lastActiveSecTitle = r.secTitle;
            }
          });

          // If this slice starts mid-section on a new page, prepend Contd. header
          const firstRow = slice[0];
          if (firstRow && firstRow.rowType === 'data' && pageNumInClass > 1 && lastActiveSecTitle) {
            slice.unshift({ rowType: 'sec_header', secTitle: `${lastActiveSecTitle} (Contd.)` });
          }

          // Append grand total on the very last page of this asset class
          if (i >= allClassRows.length) {
            slice.push(grandTotalRow);
          }

          pages.push({
            pageNumber: pages.length + 1,
            assetClass: group.assetClass,
            rows: slice,
            hasFMV
          });
        }
      } else {
        // No data — still push grand total page
        pages.push({
          pageNumber: pages.length + 1,
          assetClass: group.assetClass,
          rows: [grandTotalRow],
          hasFMV
        });
      }
    });
  }

  const totalPages = pages.length || 1;

  // Handle Customisation Form Submit
  const handleApplyCustomisation = () => {
    if (onUpdateConfig) {
      onUpdateConfig({
        ...reportConfig,
        options: {
          ...reportConfig.options,
          portfolios: selectedPortId === 'all' ? allPortfolios.map(p => String(p.id)) : [selectedPortId],
          portfolioName: investor,
          assetTypes: selectedAssetType === 'All Assets' ? ['All Assets'] : [selectedAssetType],
          gainType: selectedGainType,
          dateRange: { start: startDate, end: endDate }
        }
      });
    }
    setIsCustomiseOpen(false);
  };

  // ── EXCEL EXPORT (MULTIPLE SHEETS MATCHING MPROFIT) ────────────────────────
  const handleExportExcel = async () => {
    if (!reportData) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WealthCore';

    for (const group of reportData) {
      const sheetName = group.assetClass.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 31);
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.addRow([]);

      const r2 = worksheet.addRow([investor]);
      r2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
      r2.alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      if (isITRFormat) {
        const r4 = worksheet.addRow([`Capital Gains Report - Income Tax Return Format - Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]);
        r4.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        r4.alignment = { horizontal: 'center' };

        const r6 = worksheet.addRow([group.assetClass]);
        r6.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        r6.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.mergeCells('A2:K2');
        worksheet.mergeCells('A4:K4');
        worksheet.mergeCells('A6:K6');

        const headerTitles = [
          'Sale Date', 'Asset Name / ISIN', 'Qty. Sold', 'Sale Price', 'Sale Amt.',
          'Pur. Date', 'Pur. Price', 'FMV Price on 31-Jan-2018',
          'Cost of Acquisition Price (CA)', 'Acquisition Cost / Purchase Amount', 'Capital Gain'
        ];

        const headerRow = worksheet.addRow(headerTitles);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2545' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        const stcgMatches: any[] = [];
        const ltcgMatches: any[] = [];

        group.assets.forEach(scrip => {
          scrip.matches.forEach(m => {
            const isinVal = m.isin || (scrip as any).isin || getAssetISIN(Number(scrip.assetId)) || getAssetISIN(Number((m as any).amid || 0));
            const item = {
              rawSellDate: m.rawSellDate || m.sellDate || '',
              rawBuyDate: m.rawBuyDate || m.buyDate || '',
              saleDate: formatDate(m.sellDate),
              assetName: showISIN && isinVal ? `${scrip.assetName}\n${isinVal}` : scrip.assetName,
              qtySold: m.quantity,
              salePrice: m.sellPrice,
              saleAmt: m.sellValue,
              purDate: formatDate(m.buyDate),
              purPrice: m.buyPrice,
              fmvPrice: m.fmvPrice || 0,
              caPrice: m.caPrice || m.buyPrice,
              acqCost: m.buyValue,
              gain: m.gain
            };
            if (m.gainType === 'STCG' || m.gainType === 'Intraday') stcgMatches.push(item);
            else ltcgMatches.push(item);
          });
        });

        stcgMatches.sort((a, b) => {
          const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
          if (dtCmp !== 0) return dtCmp;
          const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
          if (nameCmp !== 0) return nameCmp;
          return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
        });

        ltcgMatches.sort((a, b) => {
          const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
          if (dtCmp !== 0) return dtCmp;
          const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
          if (nameCmp !== 0) return nameCmp;
          return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
        });

        if (stcgMatches.length > 0) {
          const stcgSecRow = worksheet.addRow([`Short Term Capital Gain`]);
          stcgSecRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          stcgSecRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
          worksheet.mergeCells(`A${stcgSecRow.number}:K${stcgSecRow.number}`);

          let stcgSaleAmt = 0, stcgAcqCost = 0, stcgGain = 0;
          stcgMatches.forEach(m => {
            stcgSaleAmt += m.saleAmt; stcgAcqCost += m.acqCost; stcgGain += m.gain;
            const dataRow = worksheet.addRow([
              m.saleDate, m.assetName, m.qtySold, m.salePrice, m.saleAmt,
              m.purDate, m.purPrice, m.fmvPrice, m.caPrice, m.acqCost, m.gain
            ]);
            dataRow.getCell(1).alignment = { horizontal: 'center' };
            dataRow.getCell(3).numFmt = '#,##0.000';
            dataRow.getCell(4).numFmt = '#,##0.00';
            dataRow.getCell(5).numFmt = '#,##0.00';
            dataRow.getCell(6).alignment = { horizontal: 'center' };
            dataRow.getCell(7).numFmt = '#,##0.00';
            dataRow.getCell(8).numFmt = '#,##0.00';
            dataRow.getCell(9).numFmt = '#,##0.00';
            dataRow.getCell(10).numFmt = '#,##0.00';
            dataRow.getCell(11).numFmt = '#,##0.00';
          });

          const stcgSubRow = worksheet.addRow([
            `Total Short Term Capital Gain`, '', '', '', stcgSaleAmt, '', '', '', '', stcgAcqCost, stcgGain
          ]);
          stcgSubRow.font = { name: 'Arial', size: 10, bold: true };
          stcgSubRow.getCell(5).numFmt = '#,##0.00';
          stcgSubRow.getCell(10).numFmt = '#,##0.00';
          stcgSubRow.getCell(11).numFmt = '#,##0.00';
          stcgSubRow.eachCell(cell => { cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }; });
          worksheet.addRow([]);
        }

        if (ltcgMatches.length > 0) {
          const ltcgSecRow = worksheet.addRow([`Long Term Capital Gain`]);
          ltcgSecRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          ltcgSecRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
          worksheet.mergeCells(`A${ltcgSecRow.number}:K${ltcgSecRow.number}`);

          let ltcgSaleAmt = 0, ltcgAcqCost = 0, ltcgGain = 0;
          ltcgMatches.forEach(m => {
            ltcgSaleAmt += m.saleAmt; ltcgAcqCost += m.acqCost; ltcgGain += m.gain;
            const dataRow = worksheet.addRow([
              m.saleDate, m.assetName, m.qtySold, m.salePrice, m.saleAmt,
              m.purDate, m.purPrice, m.fmvPrice, m.caPrice, m.acqCost, m.gain
            ]);
            dataRow.getCell(1).alignment = { horizontal: 'center' };
            dataRow.getCell(3).numFmt = '#,##0.000';
            dataRow.getCell(4).numFmt = '#,##0.00';
            dataRow.getCell(5).numFmt = '#,##0.00';
            dataRow.getCell(6).alignment = { horizontal: 'center' };
            dataRow.getCell(7).numFmt = '#,##0.00';
            dataRow.getCell(8).numFmt = '#,##0.00';
            dataRow.getCell(9).numFmt = '#,##0.00';
            dataRow.getCell(10).numFmt = '#,##0.00';
            dataRow.getCell(11).numFmt = '#,##0.00';
          });

          const ltcgSubRow = worksheet.addRow([
            `Total Long Term Capital Gain`, '', '', '', ltcgSaleAmt, '', '', '', '', ltcgAcqCost, ltcgGain
          ]);
          ltcgSubRow.font = { name: 'Arial', size: 10, bold: true };
          ltcgSubRow.getCell(5).numFmt = '#,##0.00';
          ltcgSubRow.getCell(10).numFmt = '#,##0.00';
          ltcgSubRow.getCell(11).numFmt = '#,##0.00';
          ltcgSubRow.eachCell(cell => { cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }; });
          worksheet.addRow([]);
        }

        const grandRow = worksheet.addRow([
          `Grand Total`, '', '', '', group.totalSellValue, '', '', '', '', group.totalBuyValue, group.totalSTCG + group.totalLTCG
        ]);
        grandRow.font = { name: 'Arial', size: 10, bold: true };
        grandRow.getCell(5).numFmt = '#,##0.00';
        grandRow.getCell(10).numFmt = '#,##0.00';
        grandRow.getCell(11).numFmt = '#,##0.00';
        grandRow.eachCell(cell => { cell.border = { top: { style: 'medium' }, bottom: { style: 'double' } }; });
        worksheet.addRow([]);

        worksheet.columns = [
          { width: 14 }, { width: 35 }, { width: 14 }, { width: 14 }, { width: 18 },
          { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 22 }, { width: 18 }
        ];

      } else {
        const r4 = worksheet.addRow([`Capital Gains Report - Summary - Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]);
        r4.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        r4.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.mergeCells('A2:G2');
        worksheet.mergeCells('A4:G4');

        const headerTitles = [
          'Asset Name', 'Qty. Sold', 'Sale Amt.', 'Acquisition Cost / Purchase Amount',
          'Intra-day Profit/Loss', 'Short-term Capital Gain', 'Long-term Capital Gain'
        ];

        const headerRow = worksheet.addRow(headerTitles);
        headerRow.height = 26;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2545' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const grpRow = worksheet.addRow([group.assetClass]);
        grpRow.font = { name: 'Arial', size: 10, bold: true };
        grpRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
        worksheet.mergeCells(`A${grpRow.number}:G${grpRow.number}`);

        group.assets.forEach(scrip => {
          const row = worksheet.addRow([
            scrip.assetName, scrip.qtySold, scrip.saleAmt, scrip.acquisitionCost,
            scrip.intradayGain, scrip.stcg, scrip.ltcg
          ]);
          row.getCell(2).numFmt = '#,##0.000';
          row.getCell(3).numFmt = '#,##0.00';
          row.getCell(4).numFmt = '#,##0.00';
          row.getCell(5).numFmt = '#,##0.00';
          row.getCell(6).numFmt = '#,##0.00';
          row.getCell(7).numFmt = '#,##0.00';
        });

        const subRow = worksheet.addRow([
          `Total for ${group.assetClass}`, '', group.totalSellValue, group.totalBuyValue,
          group.totalIntraday, group.totalSTCG, group.totalLTCG
        ]);
        subRow.font = { name: 'Arial', size: 10, bold: true };
        subRow.getCell(3).numFmt = '#,##0.00';
        subRow.getCell(4).numFmt = '#,##0.00';
        subRow.getCell(5).numFmt = '#,##0.00';
        subRow.getCell(6).numFmt = '#,##0.00';
        subRow.getCell(7).numFmt = '#,##0.00';
        subRow.eachCell(cell => { cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } }; });
        worksheet.addRow([]);

        worksheet.columns = [
          { width: 35 }, { width: 14 }, { width: 18 }, { width: 22 },
          { width: 18 }, { width: 18 }, { width: 18 }
        ];
      }

      worksheet.addRow([]);
      const footerRow = worksheet.addRow(['Powered by WealthCore | www.wealthcore.com']);
      footerRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const safeTitle = investor.replace(/[^a-zA-Z0-9]/g, '_');
    const fmtSuffix = isITRFormat ? 'ITR_Format' : 'Summary';
    anchor.download = `${safeTitle}_Capital_Gains_${fmtSuffix}_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // ── PURE VECTOR NATIVE PDF BUILDER (MPROFIT PIXEL-PERFECT) ───────────
  const generatePDFDocument = () => {
    if (!reportData || reportData.length === 0) return null;

    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    if (isITRFormat && reportData && reportData.length > 0) {
      reportData.forEach((group, groupIdx) => {
        if (groupIdx > 0) doc.addPage();

        const stcgMatches: any[] = [];
        const ltcgMatches: any[] = [];

        group.assets.forEach(scrip => {
          scrip.matches.forEach(m => {
            const isinVal = m.isin || (scrip as any).isin || getAssetISIN(Number(scrip.assetId)) || getAssetISIN(Number((m as any).amid || 0));
            const item = {
              rawSellDate: m.rawSellDate || m.sellDate || '',
              rawBuyDate: m.rawBuyDate || m.buyDate || '',
              saleDate: formatDate(m.sellDate),
              assetName: scrip.assetName,
              isin: showISIN ? isinVal : undefined,
              qtySold: m.quantity,
              salePrice: m.sellPrice,
              saleAmt: m.sellValue,
              purDate: formatDate(m.buyDate),
              purPrice: m.buyPrice,
              fmvPrice: m.fmvPrice || 0,
              caPrice: m.caPrice || m.buyPrice,
              acqCost: m.buyValue,
              gain: m.gain
            };
            if (m.gainType === 'STCG' || m.gainType === 'Intraday') {
              stcgMatches.push(item);
            } else {
              ltcgMatches.push(item);
            }
          });
        });

        stcgMatches.sort((a, b) => {
          const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
          if (dtCmp !== 0) return dtCmp;
          const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
          if (nameCmp !== 0) return nameCmp;
          return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
        });

        ltcgMatches.sort((a, b) => {
          const dtCmp = (a.rawSellDate || '').localeCompare(b.rawSellDate || '');
          if (dtCmp !== 0) return dtCmp;
          const nameCmp = (a.assetName || '').localeCompare(b.assetName || '');
          if (nameCmp !== 0) return nameCmp;
          return (a.rawBuyDate || '').localeCompare(b.rawBuyDate || '');
        });

        const hasFMV = group.assetClass.toLowerCase().includes('stock');

        const tableHeaders = hasFMV ? [
          'SALE DATE', 'ASSET NAME / ISIN', 'QTY. SOLD', 'SALE PRICE', 'SALE AMT.',
          'PUR. DATE', 'PUR. PRICE', 'FMV PRICE ON 31-JAN-2018', 'CA PRICE', 'PURCHASE AMT.', 'CAPITAL GAIN'
        ] : [
          'SALE DATE', 'ASSET NAME / ISIN', 'QTY. SOLD', 'SALE PRICE', 'SALE AMT.',
          'PUR. DATE', 'PUR. PRICE', 'PURCHASE AMT.', 'CAPITAL GAIN'
        ];

        const tableRows: any[] = [];
        let stcgSale = 0, stcgAcq = 0, stcgGain = 0;
        let ltcgSale = 0, ltcgAcq = 0, ltcgGain = 0;

        if (stcgMatches.length > 0 && (selectedGainType === 'All' || selectedGainType === 'STCG')) {
          tableRows.push([
            {
              content: reportData.length > 1 ? `Short Term Capital Gain on ${group.assetClass}` : `Short Term Capital Gain`,
              colSpan: hasFMV ? 11 : 9,
              styles: {
                fontStyle: 'bold',
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                halign: 'left',
                lineWidth: 0.2,
                lineColor: [148, 163, 184]
              }
            }
          ]);
          stcgMatches.forEach(m => {
            const assetNameCol = m.isin ? `${m.assetName}\n${m.isin}` : m.assetName;
            if (hasFMV) {
              tableRows.push([
                m.saleDate,
                assetNameCol,
                formatQty(m.qtySold),
                formatPrice(m.salePrice),
                formatCurrency(m.saleAmt),
                m.purDate,
                formatPrice(m.purPrice),
                m.fmvPrice > 0 ? formatPrice(m.fmvPrice) : '0.00',
                formatPrice(m.caPrice),
                formatCurrency(m.acqCost),
                { content: formatCurrency(m.gain), styles: { fontStyle: 'bold', textColor: m.gain < 0 ? [220, 38, 38] : [22, 163, 74] } }
              ]);
            } else {
              tableRows.push([
                m.saleDate,
                assetNameCol,
                formatQty(m.qtySold),
                formatPrice(m.salePrice),
                formatCurrency(m.saleAmt),
                m.purDate,
                formatPrice(m.purPrice),
                formatCurrency(m.acqCost),
                { content: formatCurrency(m.gain), styles: { fontStyle: 'bold', textColor: m.gain < 0 ? [220, 38, 38] : [22, 163, 74] } }
              ]);
            }
          });
          stcgSale = stcgMatches.reduce((s, x) => s + x.saleAmt, 0);
          stcgAcq = stcgMatches.reduce((s, x) => s + x.acqCost, 0);
          stcgGain = stcgMatches.reduce((s, x) => s + x.gain, 0);
          tableRows.push([
            { content: `Total Short Term Capital Gain`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'left', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: '', colSpan: 2 },
            { content: formatCurrency(stcgSale), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: '', colSpan: hasFMV ? 4 : 2 },
            { content: formatCurrency(stcgAcq), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: formatCurrency(stcgGain), styles: { fontStyle: 'bold', halign: 'right', textColor: stcgGain < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.2, lineColor: [148, 163, 184] } }
          ]);
        }

        if (ltcgMatches.length > 0 && (selectedGainType === 'All' || selectedGainType === 'LTCG')) {
          tableRows.push([
            {
              content: reportData.length > 1 ? `Long Term Capital Gain on ${group.assetClass}` : `Long Term Capital Gain`,
              colSpan: hasFMV ? 11 : 9,
              styles: {
                fontStyle: 'bold',
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                halign: 'left',
                lineWidth: 0.2,
                lineColor: [148, 163, 184]
              }
            }
          ]);
          ltcgMatches.forEach(m => {
            const assetNameCol = m.isin ? `${m.assetName}\n${m.isin}` : m.assetName;
            if (hasFMV) {
              tableRows.push([
                m.saleDate,
                assetNameCol,
                formatQty(m.qtySold),
                formatPrice(m.salePrice),
                formatCurrency(m.saleAmt),
                m.purDate,
                formatPrice(m.purPrice),
                m.fmvPrice > 0 ? formatPrice(m.fmvPrice) : '0.00',
                formatPrice(m.caPrice),
                formatCurrency(m.acqCost),
                { content: formatCurrency(m.gain), styles: { fontStyle: 'bold', textColor: m.gain < 0 ? [220, 38, 38] : [22, 163, 74] } }
              ]);
            } else {
              tableRows.push([
                m.saleDate,
                assetNameCol,
                formatQty(m.qtySold),
                formatPrice(m.salePrice),
                formatCurrency(m.saleAmt),
                m.purDate,
                formatPrice(m.purPrice),
                formatCurrency(m.acqCost),
                { content: formatCurrency(m.gain), styles: { fontStyle: 'bold', textColor: m.gain < 0 ? [220, 38, 38] : [22, 163, 74] } }
              ]);
            }
          });
          ltcgSale = ltcgMatches.reduce((s, x) => s + x.saleAmt, 0);
          ltcgAcq = ltcgMatches.reduce((s, x) => s + x.acqCost, 0);
          ltcgGain = ltcgMatches.reduce((s, x) => s + x.gain, 0);
          tableRows.push([
            { content: `Total Long Term Capital Gain`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'left', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: '', colSpan: 2 },
            { content: formatCurrency(ltcgSale), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: '', colSpan: hasFMV ? 4 : 2 },
            { content: formatCurrency(ltcgAcq), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.2, lineColor: [148, 163, 184] } },
            { content: formatCurrency(ltcgGain), styles: { fontStyle: 'bold', halign: 'right', textColor: ltcgGain < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.2, lineColor: [148, 163, 184] } }
          ]);
        }

        const totalSale = stcgSale + ltcgSale;
        const totalAcq = stcgAcq + ltcgAcq;
        const totalGain = stcgGain + ltcgGain;
        tableRows.push([
          { content: `Grand Total`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [255, 255, 255], halign: 'left', lineWidth: 0.35, lineColor: [15, 23, 42] } },
          { content: '', colSpan: 2 },
          { content: formatCurrency(totalSale), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.35, lineColor: [15, 23, 42] } },
          { content: '', colSpan: hasFMV ? 4 : 2 },
          { content: formatCurrency(totalAcq), styles: { fontStyle: 'bold', halign: 'right', lineWidth: 0.35, lineColor: [15, 23, 42] } },
          { content: formatCurrency(totalGain), styles: { fontStyle: 'bold', halign: 'right', textColor: totalGain < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } }
        ]);

        autoTable(doc, {
          startY: 30,
          head: [tableHeaders],
          body: tableRows,
          theme: 'plain',
          showHead: 'everyPage',
          styles: {
            lineColor: [203, 213, 225],
            lineWidth: 0.15,
            fontSize: 7.5,
            textColor: [51, 65, 85],
            valign: 'middle',
            cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }
          },
          headStyles: {
            fillColor: [11, 37, 69],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.15,
            lineColor: [11, 37, 69],
            cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85],
            valign: 'middle'
          },
          columnStyles: hasFMV ? {
            0: { halign: 'center', cellWidth: 20 },
            1: { halign: 'left', cellWidth: 55 },
            2: { halign: 'right', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 26 },
            5: { halign: 'center', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 22 },
            7: { halign: 'right', cellWidth: 24 },
            8: { halign: 'right', cellWidth: 22 },
            9: { halign: 'right', cellWidth: 25 },
            10: { halign: 'right', cellWidth: 23 }
          } : {
            0: { halign: 'center', cellWidth: 22 },
            1: { halign: 'left', cellWidth: 80 },
            2: { halign: 'right', cellWidth: 22 },
            3: { halign: 'right', cellWidth: 24 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'center', cellWidth: 22 },
            6: { halign: 'right', cellWidth: 24 },
            7: { halign: 'right', cellWidth: 28 },
            8: { halign: 'right', cellWidth: 27 }
          },
          margin: { left: 10, right: 10, bottom: 15, top: 30 },
          didDrawPage: () => {
            // Header drawn on EVERY page created by autoTable
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(investor, 148.5, 15, { align: 'center' });

            doc.setFontSize(9.5);
            doc.text(`Capital Gains Report - Income Tax Return Format - Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 148.5, 20.5, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(group.assetClass || selectedTypes.join(' & '), 148.5, 25.5, { align: 'center' });

            // Footer base
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('Powered by WealthCore | www.wealthcore.com', 10, 202);
          }
        });
      });

      // Stamp final dynamic page numbers (e.g. "1 of 4", "2 of 4") on all pages
      const totalDocPages = (doc.internal as any).getNumberOfPages?.() || (doc as any).getNumberOfPages?.() || 1;
      for (let p = 1; p <= totalDocPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${p} of ${totalDocPages}`, 287, 202, { align: 'right' });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(investor, 148.5, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.text(`Capital Gains Report - Summary - ${formatDate(startDate)} to ${formatDate(endDate)}`, 148.5, 20.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 148.5, 25.5, { align: 'center' });

      const tableHeaders = [
        'Asset Name', 'Qty. Sold', 'Sale Amt.',
        'Acquisition Cost / Purchase Amount', 'Intra-day Profit/Loss',
        'Short-term Capital Gain', 'Long-term Capital Gain'
      ];

      const tableRows: any[] = [];
      (reportData || []).forEach(group => {
        tableRows.push([
          { content: group.assetClass, colSpan: 7, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42], lineWidth: 0.2, lineColor: [148, 163, 184] } }
        ]);
        group.assets.forEach(scrip => {
          tableRows.push([
            scrip.assetName,
            scrip.qtySold.toLocaleString('en-IN', { maximumFractionDigits: 3 }),
            formatCurrency(scrip.saleAmt),
            formatCurrency(scrip.acquisitionCost),
            { content: formatCurrency(scrip.intradayGain), styles: { textColor: scrip.intradayGain < 0 ? [220, 38, 38] : [22, 163, 74] } },
            { content: formatCurrency(scrip.stcg), styles: { textColor: scrip.stcg < 0 ? [220, 38, 38] : [22, 163, 74] } },
            { content: formatCurrency(scrip.ltcg), styles: { textColor: scrip.ltcg < 0 ? [220, 38, 38] : [22, 163, 74] } }
          ]);
        });
        tableRows.push([
          { content: `Total for ${group.assetClass}`, styles: { fontStyle: 'bold' } },
          '',
          { content: formatCurrency(group.totalSellValue), styles: { fontStyle: 'bold' } },
          { content: formatCurrency(group.totalBuyValue), styles: { fontStyle: 'bold' } },
          { content: formatCurrency(group.totalIntraday), styles: { fontStyle: 'bold', textColor: group.totalIntraday < 0 ? [220, 38, 38] : [22, 163, 74] } },
          { content: formatCurrency(group.totalSTCG), styles: { fontStyle: 'bold', textColor: group.totalSTCG < 0 ? [220, 38, 38] : [22, 163, 74] } },
          { content: formatCurrency(group.totalLTCG), styles: { fontStyle: 'bold', textColor: group.totalLTCG < 0 ? [220, 38, 38] : [22, 163, 74] } }
        ]);
      });

      tableRows.push([
        { content: `Grand Total for ${formatDate(startDate)} to ${formatDate(endDate)}`, styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
        '',
        { content: formatCurrency(netSellValue), styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
        { content: formatCurrency(netBuyValue), styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
        { content: formatCurrency(netIntraday), styles: { fontStyle: 'bold', textColor: netIntraday < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } },
        { content: formatCurrency(netSTCG), styles: { fontStyle: 'bold', textColor: netSTCG < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } },
        { content: formatCurrency(netLTCG), styles: { fontStyle: 'bold', textColor: netLTCG < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } }
      ]);

      autoTable(doc, {
        startY: 30,
        head: [tableHeaders],
        body: tableRows,
        theme: 'plain',
        styles: {
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
          fontSize: 8,
          textColor: [51, 65, 85],
          valign: 'middle',
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
        },
        headStyles: {
          fillColor: [11, 37, 69],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.15,
          lineColor: [11, 37, 69]
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
          valign: 'middle'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 77 },
          1: { halign: 'right', cellWidth: 25 },
          2: { halign: 'right', cellWidth: 35 },
          3: { halign: 'right', cellWidth: 40 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 34 },
          6: { halign: 'right', cellWidth: 34 }
        },
        margin: { left: 10, right: 10, bottom: 12, top: 30 }
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Powered by WealthCore | www.wealthcore.com', 10, 202);
      doc.text('1 of 1', 287, 202, { align: 'right' });
    }

    return doc;
  };

  const handleExportPDF = () => {
    try {
      const doc = generatePDFDocument();
      if (!doc) return;
      const safeTitle = investor.replace(/[^a-zA-Z0-9]/g, '_');
      const fmtSuffix = isITRFormat ? 'ITR_Format' : 'Summary';
      doc.save(`${safeTitle}_Capital_Gains_${fmtSuffix}_${formatDate(startDate)}_${formatDate(endDate)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not generate PDF: ' + (err as any)?.message);
    }
  };

  const handlePrint = () => {
    try {
      const doc = generatePDFDocument();
      if (!doc) return;
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = blobUrl;
      document.body.appendChild(printIframe);
      printIframe.onload = () => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (e) {
          window.open(blobUrl, '_blank');
        }
      };
    } catch (err) {
      console.error('Error printing report:', err);
      window.print();
    }
  };

  return (
    <>
      <style>{`
        /* Screen View Styles for MProfit Page Cards */
        .mprofit-page-card {
          width: 100%;
          max-width: 1360px;
          min-height: 680px;
          background: #ffffff;
          margin: 0 auto 28px auto;
          padding: 24px 28px 16px 28px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
          overflow: hidden;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          html, body, #root, .app-shell, .app-layout, main, .main-content, .pms-workspace, .pms-main-content {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
          }

          .print-modal-backdrop {
            position: static !important;
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
          }

          .print-modal-content {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            background: white !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .printable-report-container {
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
            height: auto !important;
            display: block !important;
          }

          .mprofit-page-card {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 0 12mm 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: visible !important;
            background: white !important;
          }

          .mprofit-page-card:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          @page {
            size: A4 landscape;
            margin: 18mm 10mm 12mm 10mm;
          }

          /* ── Print-only: crisp thin borders between rows ── */
          .cg-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .cg-table td {
            border-bottom: 1px solid #cbd5e1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            padding: 4px 6px !important;
          }
          .cg-table th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            padding: 5px 6px !important;
          }
          .cg-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* ── Print-only typography ── */
          .cg-title        { font-size: 15px !important; }
          .cg-subtitle     { font-size: 11px !important; }
          .cg-period       { font-size: 10px !important; }
          .cg-table        { font-size: 9.5px !important; }
          .cg-thead-row    { font-size: 8.5px !important; }
          .cg-isin-label   { font-size: 7.5px !important; }
          .cg-sec-header   { font-size: 10.5px !important; }
          .cg-isin-val     { font-size: 8.5px !important; }
          .cg-footer       { font-size: 9px !important; }
        }
      `}</style>

      <div className="print-modal-backdrop" style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px'
      }}>
        <div className="print-modal-content" style={{
          background: '#f1f5f9', width: '100%', maxWidth: '1440px', height: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', borderRadius: '8px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'
        }}>
          {/* Top Action Ribbon matching MProfit */}
          <div className="no-print" style={{
            display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#ffffff',
            color: '#475569', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em'
          }}>
            <button onClick={onBack || onClose} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569' }}>BACK</button>
            <button onClick={() => setIsCustomiseOpen(true)} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <SlidersHorizontal size={15} /> CUSTOMISE
            </button>
            <button onClick={handlePrint} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569' }}>PRINT</button>
            <button onClick={handleExportPDF} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569' }}>DOWNLOAD PDF</button>
            <button onClick={handleExportExcel} style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569' }}>DOWNLOAD EXCEL</button>
            <button onClick={onClose} style={{ padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={18} /></button>
          </div>

          {/* Paginated Report Document Container */}
          <div ref={reportContainerRef} className="printable-report-container" style={{ flex: 1, overflow: 'auto', padding: '32px 0', background: '#cbd5e1' }}>
            
            {isITRFormat ? (
              /* ── MPROFIT PAGINATED ITR FORMAT PAGES ── */
              pages.map((page, pIdx) => (
                <div key={pIdx} className="mprofit-page-card">
                  <div>
                    {/* Header Title Block on EVERY Page */}
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                      <h1 className="cg-title" style={{ fontSize: '15px', margin: '0 0 2px 0', color: '#0f172a', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
                        {investor}
                      </h1>
                      <h2 className="cg-subtitle" style={{ fontSize: '11px', margin: '0 0 2px 0', fontWeight: 600, color: '#1e293b' }}>
                        {`Capital Gains Report - Income Tax Return Format - Period: ${formatDate(startDate)} to ${formatDate(endDate)}`}
                      </h2>
                      <div className="cg-period" style={{ fontWeight: 600, fontSize: '11px', color: '#0f172a' }}>
                        {page.assetClass}
                      </div>
                    </div>

                    {/* Dark Navy Table Header on EVERY Page - 100% White 8.5px Font */}
                    <table className="cg-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Inter, sans-serif', tableLayout: 'auto' }}>
                      <thead>
                        <tr className="cg-thead-row" style={{ background: '#0b2545', color: '#ffffff', textAlign: 'right', fontSize: '8.5px' }}>
                          <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 700, width: page.hasFMV ? '7%' : '9%', color: '#ffffff' }}>Sale Date</th>
                          <th style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 700, width: page.hasFMV ? '18%' : '26%', color: '#ffffff' }}>Asset Name<br/><span className="cg-isin-label" style={{ fontSize: '8px', fontWeight: 400, opacity: 0.9, color: '#ffffff' }}>ISIN</span></th>
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '6%' : '8%', color: '#ffffff' }}>Qty. Sold</th>
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '7%' : '9%', color: '#ffffff' }}>Sale Price</th>
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '9%' : '11%', color: '#ffffff' }}>Sale Amt.</th>
                          <th style={{ padding: '8px 5px', textAlign: 'center', fontWeight: 700, width: page.hasFMV ? '7%' : '9%', color: '#ffffff' }}>Pur. Date</th>
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '7%' : '9%', color: '#ffffff' }}>Pur. Price</th>
                          {page.hasFMV && (
                            <>
                              <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: '9%', color: '#ffffff', lineHeight: 1.25 }}>FMV Price on<br/>31-Jan-2018</th>
                              <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: '9%', color: '#ffffff', lineHeight: 1.25 }}>Cost of Acquisition<br/>Price (CA)</th>
                            </>
                          )}
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '11%' : '11%', color: '#ffffff', lineHeight: 1.25 }}>Acquisition Cost /<br/>Purchase Amount</th>
                          <th style={{ padding: '8px 5px', fontWeight: 700, textAlign: 'right', width: page.hasFMV ? '10%' : '11%', color: '#ffffff' }}>Capital Gain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.rows.map((r, rIdx) => {
                          if (r.rowType === 'sec_header') {
                            return (
                              <tr key={rIdx} style={{ background: '#f1f5f9', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                                <td colSpan={page.hasFMV ? 11 : 9} style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10.5px' }} className="cg-sec-header">
                                  {r.secTitle}
                                </td>
                              </tr>

                            );
                          }
                          if (r.rowType === 'spacer') {
                            return (
                              <tr key={rIdx} style={{ height: '10px' }}>
                                <td colSpan={page.hasFMV ? 11 : 9} />
                              </tr>
                            );
                          }
                          if (r.rowType === 'data') {
                            const m = r.data;
                            return (
                              <tr key={rIdx} style={{ color: '#334155' }}>
                                <td style={{ padding: '4px 5px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>{m.saleDate}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2 }}>{m.assetName}</div>
                                  {m.folio && <div style={{ fontSize: '9.5px', color: '#2563eb', fontWeight: 600, marginTop: '1px', lineHeight: 1.1 }}>Folio: {m.folio}</div>}
                                  {m.isin && <div className="cg-isin-val" style={{ fontSize: '9px', color: '#64748b', marginTop: '1px', lineHeight: 1.1 }}>{m.isin}</div>}
                                </td>
                                <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatQty(m.qtySold)}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatPrice(m.salePrice)}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatCurrency(m.saleAmt)}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>{m.purDate}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatPrice(m.purPrice)}</td>
                                {page.hasFMV && (
                                  <>
                                    <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{m.fmvPrice > 0 ? formatPrice(m.fmvPrice) : '0.00'}</td>
                                    <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatPrice(m.caPrice)}</td>
                                  </>
                                )}
                                <td style={{ padding: '4px 5px', textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>{formatCurrency(m.acqCost)}</td>
                                <td style={{ padding: '4px 5px', textAlign: 'right', fontWeight: 600, color: getColor(m.gain), borderBottom: '1px solid #cbd5e1' }}>
                                  {formatCurrency(m.gain)}
                                </td>
                              </tr>
                            );
                          }
                          if (r.rowType === 'sub_total') {
                            return (
                              <tr key={rIdx} style={{ fontWeight: 700, color: '#0f172a', background: '#f8fafc', borderTop: '1px solid #94a3b8', borderBottom: '1px solid #94a3b8' }}>
                                <td colSpan={2} style={{ padding: '6px 6px', textAlign: 'left' }}>
                                  {r.secTitle}
                                </td>
                                <td colSpan={2}></td>
                                <td style={{ padding: '6px 6px', textAlign: 'right' }}>{formatCurrency(r.saleAmt || 0)}</td>
                                <td colSpan={page.hasFMV ? 4 : 2}></td>
                                <td style={{ padding: '6px 6px', textAlign: 'right' }}>{formatCurrency(r.acqCost || 0)}</td>
                                <td style={{ padding: '6px 6px', textAlign: 'right', color: getColor(r.gain || 0) }}>{formatCurrency(r.gain || 0)}</td>
                              </tr>
                            );
                          }
                          if (r.rowType === 'grand_total') {
                            return (
                              <tr key={rIdx} style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 800, color: '#0f172a', background: '#ffffff' }}>
                                <td colSpan={2} style={{ padding: '7px 6px', textAlign: 'left' }}>{r.secTitle}</td>
                                <td colSpan={2}></td>
                                <td style={{ padding: '7px 6px', textAlign: 'right' }}>{formatCurrency(r.saleAmt || 0)}</td>
                                <td colSpan={page.hasFMV ? 4 : 2}></td>
                                <td style={{ padding: '7px 6px', textAlign: 'right' }}>{formatCurrency(r.acqCost || 0)}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'right', color: getColor(r.gain || 0) }}>{formatCurrency(r.gain || 0)}</td>
                              </tr>
                            );
                          }
                          return null;
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Clean Page Footer on EVERY Page */}
                  <div className="cg-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#64748b' }}>
                    <div>Powered by WealthCore | www.wealthcore.com</div>
                    <div style={{ fontWeight: 600 }}>{`${page.pageNumber} of ${totalPages}`}</div>
                  </div>
                </div>
              ))
            ) : (
              /* ── MPROFIT SUMMARY FORMAT REPORT PAGE ── */
              <div className="mprofit-page-card">
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '18px', margin: '0 0 6px 0', color: '#0f172a', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
                      {investor}
                    </h1>
                    <h2 style={{ fontSize: '13px', margin: '0 0 4px 0', fontWeight: 600, color: '#1e293b' }}>
                      {`Capital Gains Report - Summary - ${formatDate(startDate)} to ${formatDate(endDate)} - ${selectedTypes.join(' & ')}`}
                    </h2>
                    <div style={{ textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`}
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    <thead>
                      <tr style={{ background: '#0b2545', color: '#ffffff', textAlign: 'right', fontSize: '11px' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>Asset Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Qty. Sold</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Sale Amt.</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Acquisition Cost /<br/>Purchase Amount</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Intra-day<br/>Profit/Loss</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Short-term<br/>Capital Gain</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>Long-term<br/>Capital Gain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.map((group, i) => (
                        <React.Fragment key={i}>
                          <tr style={{ background: '#f1f5f9', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                            <td colSpan={7} style={{ padding: '10px 16px', textAlign: 'left' }}>{group.assetClass}</td>
                          </tr>
                          {group.assets.map((scrip, j) => (
                            <tr key={j} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                              <td style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#0f172a' }}>
                                <div>{scrip.assetName}</div>
                                {scrip.folio && <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>Folio: {scrip.folio}</div>}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>{scrip.qtySold.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(scrip.saleAmt)}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(scrip.acquisitionCost)}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(scrip.intradayGain) }}>
                                {formatCurrency(scrip.intradayGain)}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(scrip.stcg) }}>
                                {formatCurrency(scrip.stcg)}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(scrip.ltcg) }}>
                                {formatCurrency(scrip.ltcg)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: '#ffffff', fontWeight: 700, color: '#0f172a', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                            <td style={{ padding: '10px 16px', textAlign: 'left' }}>Total for {group.assetClass}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}></td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(group.totalSellValue)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(group.totalBuyValue)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(group.totalIntraday) }}>{formatCurrency(group.totalIntraday)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(group.totalSTCG) }}>{formatCurrency(group.totalSTCG)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: getColor(group.totalLTCG) }}>{formatCurrency(group.totalLTCG)}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 800, color: '#0f172a', background: '#ffffff' }}>
                        <td style={{ padding: '12px 16px', textAlign: 'left' }}>Grand Total for {formatDate(startDate)} to {formatDate(endDate)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(netSellValue)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(netBuyValue)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: getColor(netIntraday) }}>{formatCurrency(netIntraday)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: getColor(netSTCG) }}>{formatCurrency(netSTCG)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: getColor(netLTCG) }}>{formatCurrency(netLTCG)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                  <div>Powered by WealthCore | www.wealthcore.com</div>
                  <div style={{ fontWeight: 600 }}>1 of 1</div>
                </div>
              </div>
            )}

            {(!reportData || reportData.length === 0) && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No Capital Gains data available for the selected filters.
              </div>
            )}
          </div>

          {/* ── MPROFIT CAPITAL GAINS REPORT CUSTOMISATION MODAL ── */}
          {isCustomiseOpen && (
            <div className="no-print" style={{
              position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20000
            }}>
              <div style={{
                background: 'white', borderRadius: '12px', width: '560px', maxWidth: '95%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', padding: '24px 28px',
                display: 'flex', flexDirection: 'column', gap: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Capital Gains ITR Format Report
                  </h3>
                  <button onClick={() => setIsCustomiseOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  {/* Select Portfolio / Person Name */}
                  <div>
                    <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Select Portfolio (Person Name):
                    </label>
                    <select
                      value={selectedPortId}
                      onChange={e => setSelectedPortId(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white', color: '#0f172a' }}
                    >
                      <option value="all">All Family Portfolios (Consolidated)</option>
                      {allPortfolios.map(p => (
                        <option key={p.id} value={String(p.id)}>
                          {p.portfolioName || p.name || p.investor_name || p.full_name || `Portfolio ${p.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Period / Date Range */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Start Date:</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>End Date:</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* Select Asset Type */}
                  <div>
                    <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Select Asset Type:
                    </label>
                    <select
                      value={selectedAssetType}
                      onChange={e => setSelectedAssetType(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white', color: '#0f172a' }}
                    >
                      <option value="All Assets">All Assets</option>
                      <option value="Stocks & ETFs">Stocks & ETFs (Stocks)</option>
                      <option value="Mutual Funds">Mutual Funds (All)</option>
                      <option value="Mutual Funds (Equity)">Mutual Funds (Equity)</option>
                      <option value="Mutual Funds (Debt)">Mutual Funds (Debt / Hybrid)</option>
                      <option value="Mutual Funds (Other)">Mutual Funds (Other / Multi Asset)</option>
                      <option value="Gold / Commodities">Gold / Commodities</option>
                      <option value="Traded Bonds">Traded Bonds</option>
                      <option value="NCDs">NCDs</option>
                    </select>
                  </div>

                  {/* Capital Gain Type */}
                  <div>
                    <label style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Capital Gain Type:
                    </label>
                    <select
                      value={selectedGainType}
                      onChange={e => setSelectedGainType(e.target.value as any)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white', color: '#0f172a' }}
                    >
                      <option value="All">All (STCG & LTCG)</option>
                      <option value="STCG">Short Term Capital Gain Only (STCG)</option>
                      <option value="LTCG">Long Term Capital Gain Only (LTCG)</option>
                    </select>
                  </div>

                  {/* Show/Hide ISIN No */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>ISIN No:</label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={showISIN} onChange={() => setShowISIN(true)} /> Show
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={!showISIN} onChange={() => setShowISIN(false)} /> Hide
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleApplyCustomisation}
                  style={{
                    width: '100%', padding: '12px', background: '#0b2545', color: 'white',
                    fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '14px', marginTop: '6px'
                  }}
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
