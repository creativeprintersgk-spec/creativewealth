import React, { useRef } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportConfig } from '../ReportsModal';

import { formatInvestorName } from '../../logic';

interface PortfolioSummaryRendererProps {
  isOpen: boolean;
  onClose: () => void;
  reportConfig: ReportConfig | null;
  reportData: any[] | null;
}

export default function PortfolioSummaryRenderer({ isOpen, onClose, reportConfig, reportData }: PortfolioSummaryRendererProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  if (!isOpen || !reportConfig) return null;

  const now = new Date();
  const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const formatCurrency = (val: number) => val.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const formatPct = (val: number) => (val > 0 ? '+' : '') + val.toFixed(2) + '%';
  
  const getColor = (val: number) => {
    if (val > 0) return '#0e872d';
    if (val < 0) return '#e62b25';
    return '#333';
  };

  // Calculate Net Worth Totals
  const netInvested = reportData?.reduce((acc, curr) => acc + curr.totalInvested, 0) || 0;
  const netCurrent = reportData?.reduce((acc, curr) => acc + curr.currentValue, 0) || 0;
  const netOverallGain = reportData?.reduce((acc, curr) => acc + curr.overallGain, 0) || 0;
  const netTodaysGain = reportData?.reduce((acc, curr) => acc + curr.todaysGain, 0) || 0;
  const netOverallGainPct = netCurrent > 0 ? (netOverallGain / (netCurrent - netOverallGain)) * 100 : 0;
  const netTodaysGainPct = netCurrent > 0 ? (netTodaysGain / (netCurrent - netTodaysGain)) * 100 : 0;

  const handleExportExcel = () => {
    if (!reportData) return;
    const investor = formatInvestorName(reportConfig.options?.portfolioName);
    const rows: any[] = [
      { 'Asset Name': investor, 'Quantity': '', 'Pur. Price': '', 'Pur. Value': '', 'Market Price': '', 'Market Value': '', 'Gain': '', 'Gain %': '' },
      { 'Asset Name': `Portfolio Summary Report as on ${dateString}`, 'Quantity': '', 'Pur. Price': '', 'Pur. Value': '', 'Market Price': '', 'Market Value': '', 'Gain': '', 'Gain %': '' },
      {}
    ];
    reportData.forEach(group => {
      rows.push({ 'Asset Name': group.assetClass, 'Quantity': '', 'Pur. Price': '', 'Pur. Value': group.totalInvested, 'Market Price': '', 'Market Value': group.currentValue, 'Gain': group.overallGain, 'Gain %': '' });
      group.assets.forEach((a: any) => {
        rows.push({
          'Asset Name': a.name,
          'Quantity': a.qty,
          'Pur. Price': a.avgPrice,
          'Pur. Value': a.amtInvested,
          'Market Price': a.currPrice,
          'Market Value': a.currentValue,
          'Gain': a.overallGainValue,
          'Gain %': a.overallGainPct.toFixed(2) + '%'
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Portfolio Summary");
    const safeTitle = investor.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}_Portfolio_Summary_Report.xlsx`);
  };

  const handleExportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const investor = formatInvestorName(reportConfig.options?.portfolioName);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(investor, 105, 15, { align: 'center' });

    doc.setFontSize(9.5);
    doc.text(`Portfolio Summary Report as on ${dateString}`, 105, 21, { align: 'center' });

    const tableHeaders = ['Asset Name', 'Qty', 'Pur. Price', 'Pur. Value', 'Mkt Price', 'Mkt Value', 'Gain', 'Gain %'];
    const tableRows: any[] = [];

    reportData.forEach(group => {
      tableRows.push([
        { content: group.assetClass, colSpan: 8, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42], lineWidth: 0.2, lineColor: [148, 163, 184] } }
      ]);
      group.assets.forEach((asset: any) => {
        tableRows.push([
          asset.name,
          asset.qty ? asset.qty.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '',
          asset.avgPrice ? formatCurrency(asset.avgPrice) : '',
          formatCurrency(asset.amtInvested),
          asset.currPrice ? formatCurrency(asset.currPrice) : '',
          formatCurrency(asset.currentValue),
          { content: formatCurrency(asset.overallGainValue), styles: { textColor: asset.overallGainValue < 0 ? [220, 38, 38] : [22, 163, 74] } },
          { content: formatPct(asset.overallGainPct), styles: { textColor: asset.overallGainPct < 0 ? [220, 38, 38] : [22, 163, 74] } }
        ]);
      });
      tableRows.push([
        { content: `Total for ${group.assetClass}`, styles: { fontStyle: 'bold' } },
        '', '',
        { content: formatCurrency(group.totalInvested), styles: { fontStyle: 'bold' } },
        '',
        { content: formatCurrency(group.currentValue), styles: { fontStyle: 'bold' } },
        { content: formatCurrency(group.overallGain), styles: { fontStyle: 'bold', textColor: group.overallGain < 0 ? [220, 38, 38] : [22, 163, 74] } },
        { content: formatPct(group.currentValue > 0 ? (group.overallGain / (group.currentValue - group.overallGain)) * 100 : 0), styles: { fontStyle: 'bold', textColor: group.overallGain < 0 ? [220, 38, 38] : [22, 163, 74] } }
      ]);
    });

    // Net Worth Total
    tableRows.push([
      { content: 'NET WORTH TOTAL', styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
      '', '',
      { content: formatCurrency(netInvested), styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
      '',
      { content: formatCurrency(netCurrent), styles: { fontStyle: 'bold', lineWidth: 0.35, lineColor: [15, 23, 42] } },
      { content: formatCurrency(netOverallGain), styles: { fontStyle: 'bold', textColor: netOverallGain < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } },
      { content: formatPct(netOverallGainPct), styles: { fontStyle: 'bold', textColor: netOverallGain < 0 ? [220, 38, 38] : [22, 163, 74], lineWidth: 0.35, lineColor: [15, 23, 42] } }
    ]);

    autoTable(doc, {
      startY: 28,
      head: [tableHeaders],
      body: tableRows,
      theme: 'plain',
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
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.15,
        lineColor: [11, 37, 69]
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 55 },
        1: { halign: 'right', cellWidth: 15 },
        2: { halign: 'right', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 25 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 16 }
      },
      margin: { left: 7, right: 7, bottom: 12, top: 28 }
    });

    const safeTitle = investor.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${safeTitle}_Portfolio_Summary_Report.pdf`);
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }

          html, body, #root, .app-shell, .app-layout, main, .main-content, .pms-workspace, .pms-main-content {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            position: static !important;
          }

          .print-modal-backdrop {
            position: static !important;
            background: none !important;
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
            display: block !important;
            background: white !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .printable-report-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th {
            background-color: #0b2545 !important;
            color: white !important;
            padding: 6px 8px !important;
            font-size: 9px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          td {
            padding: 5px 8px !important;
            border-bottom: 1px solid #cbd5e1 !important;
            word-break: break-word !important;
            font-size: 9.5px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4 portrait;
            margin: 15mm 10mm 12mm 10mm;
          }
        }
      `}</style>
      <div className="print-modal-backdrop" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#f1f5f9', // slight backdrop
        zIndex: 10000,
        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px'
      }}>
        <div className="print-modal-content" style={{
          background: 'white', width: '100%', maxWidth: '1400px', height: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', borderRadius: '4px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          {/* Top Action Bar */}
          <div className="no-print" style={{
            display: 'flex', borderBottom: '1px solid #cbd5e1', background: '#f8fafc',
            color: '#334155', fontSize: '13px', fontWeight: 600
          }}>
            <button onClick={onClose} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}>BACK</button>
            <button style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}>CUSTOMISE</button>
            <button onClick={() => window.print()} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}>PRINT</button>
            <button onClick={handleExportPDF} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}>DOWNLOAD PDF</button>
            <button onClick={handleExportExcel} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderRight: '1px solid #cbd5e1', cursor: 'pointer' }}>DOWNLOAD EXCEL</button>
            <button onClick={onClose} style={{ padding: '16px 24px', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {/* Report Content Area */}
          <div ref={reportRef} className="printable-report-area" style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: 'white' }}>
          
          {/* Titles */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#000' }}>
              {formatInvestorName(reportConfig.options?.portfolioName)}
            </h1>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: '#000' }}>
              Portfolio Summary Report{' '}
              <span style={{ fontWeight: 400, color: '#475569', fontSize: '14px' }}>as on {dateString}</span>
            </h2>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr style={{ background: '#023059', color: 'white', textAlign: 'right' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Folio / Ref No.</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Quantity<br/>Avg. Pur. Price</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amt. Invested</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Curr. Price</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Today's Gain<br/><span style={{ fontSize: '11px' }}>Gain %</span></th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Overall Gain<br/><span style={{ fontSize: '11px' }}>Gain %</span></th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Current Value</th>
              </tr>
            </thead>
            <tbody>
              {/* Net Worth Row */}
              <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: 700, color: '#000', background: '#f8fafc' }}>
                <td colSpan={3} style={{ padding: '16px', textAlign: 'left' }}>Net Worth</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>{formatCurrency(netInvested)}</td>
                <td></td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ color: getColor(netTodaysGain) }}>{formatCurrency(netTodaysGain)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 400, color: '#475569' }}>{formatPct(netTodaysGainPct)}</div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ color: getColor(netOverallGain) }}>{formatCurrency(netOverallGain)}</div>
                  <div style={{ fontSize: '11px', fontWeight: 400, color: '#475569' }}>{formatPct(netOverallGainPct)}</div>
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>{formatCurrency(netCurrent)}</td>
              </tr>

              {/* Asset Groups */}
              {reportData?.map((group, i) => (
                <React.Fragment key={i}>
                  {/* Group Header */}
                  <tr style={{ background: '#dcecf9', fontWeight: 700, color: '#000', borderBottom: '1px solid #cbd5e1' }}>
                    <td colSpan={3} style={{ padding: '16px', textAlign: 'left' }}>{group.assetClass}</td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>{formatCurrency(group.totalInvested)}</td>
                    <td></td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ color: getColor(group.todaysGain) }}>{formatCurrency(group.todaysGain)}</div>
                      <div style={{ fontSize: '11px', fontWeight: 400, color: '#475569' }}>{formatPct(group.currentValue ? (group.todaysGain / (group.currentValue - group.todaysGain))*100 : 0)}</div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ color: getColor(group.overallGain) }}>{formatCurrency(group.overallGain)}</div>
                      <div style={{ fontSize: '11px', fontWeight: 400, color: '#475569' }}>{formatPct(group.currentValue ? (group.overallGain / (group.currentValue - group.overallGain))*100 : 0)}</div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>{formatCurrency(group.currentValue)}</td>
                  </tr>
                  
                  {/* Individual Assets */}
                  {group.assets.map((asset: any, j: number) => (
                    <tr key={j} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                      <td style={{ padding: '12px 16px', textAlign: 'left' }}>{asset.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'left' }}>{asset.folio || '-'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div>{asset.qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{formatCurrency(asset.avgPrice)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(asset.amtInvested)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(asset.currPrice)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ color: getColor(asset.todaysGainValue) }}>{formatCurrency(asset.todaysGainValue)}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{formatPct(asset.todaysGainPct)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ color: getColor(asset.overallGainValue) }}>{formatCurrency(asset.overallGainValue)}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{formatPct(asset.overallGainPct)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(asset.currentValue)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          
          {(!reportData || reportData.length === 0) && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No data available for the selected filters.
            </div>
          )}
        </div>
      </div>
    </div>
  </>
  );
}
