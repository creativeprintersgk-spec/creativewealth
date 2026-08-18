import React, { useState, useEffect } from 'react';
import { useFY } from '../FYContext';
import { Calculator, TrendingUp, AlertCircle, FileText, Download, PieChart, ExternalLink, FileDown, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStoredPortfolios, getCapitalGains } from '../logic';
import { generateCapitalGainsDetailed } from '../services/capitalGainsEngine';
import CapitalGainsRenderer from '../components/reports/CapitalGainsRenderer';

type CGSummaryRow = {
  portfolio_id: string;
  portfolio_name: string;
  gain_type: 'STCG' | 'LTCG';
  transactions: number;
  total_gain_loss: number;
  estimated_tax: number;
};

export default function CapitalGainsPage() {
  const { customRange, selectedFY, setReportFilter, setCustomRange, setSelectedFY, availableFYs, selectedMember } = useFY();
  const [data, setData] = useState<CGSummaryRow[]>([]);
  const [assetClassData, setAssetClassData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedReportPf, setSelectedReportPf] = useState<any>(null);

  useEffect(() => {
    const allPfs = getStoredPortfolios();
    setPortfolios(allPfs);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const pfs = getStoredPortfolios();
        const pfIds = pfs.map(p => Number(p.id));
        const pfIdStrs = pfs.map(p => String(p.id));

        setTimeout(() => {
          // 1. Transaction-level summary for Portfolio breakdown
          const txns = getCapitalGains(pfIds, customRange.start, customRange.end);
          const summary: Record<string, CGSummaryRow> = {};
          
          txns.forEach(tx => {
            const p = pfs.find(x => Number(x.id) === Number(tx.portfolioId));
            const pName = p?.name || p?.investor_name || p?.full_name || `Portfolio ${tx.portfolioId}`;
            const key = `${tx.portfolioId}_${tx.gainType}`;
            if (!summary[key]) {
              summary[key] = {
                portfolio_id: String(tx.portfolioId),
                portfolio_name: pName,
                gain_type: tx.gainType as 'STCG' | 'LTCG',
                transactions: 0,
                total_gain_loss: 0,
                estimated_tax: 0
              };
            }
            summary[key].transactions += 1;
            summary[key].total_gain_loss += tx.gainLoss;
            summary[key].estimated_tax += tx.estimatedTax;
          });

          setData(Object.values(summary));

          // 2. Asset Class bifurcation summary using verified capital gains engine
          const detailed = generateCapitalGainsDetailed(pfIdStrs, ['All Assets'], customRange.start, customRange.end);
          setAssetClassData(detailed);

          setLoading(false);
        }, 10);
      } catch (err) {
        console.error("Exception fetching CG:", err);
        setLoading(false);
      }
    }
    fetchData();
  }, [customRange]);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Process data for display
  const stcgRows = data.filter(r => r.gain_type === 'STCG');
  const ltcgRows = data.filter(r => r.gain_type === 'LTCG');

  const totalSTCG = stcgRows.reduce((sum, r) => sum + r.total_gain_loss, 0);
  const totalLTCG = ltcgRows.reduce((sum, r) => sum + r.total_gain_loss, 0);
  const grandTotalGain = totalSTCG + totalLTCG;
  
  // Tax logic: 1.25L exemption on LTCG
  const taxableLTCG = Math.max(0, totalLTCG - 125000);
  const estimatedTaxSTCG = totalSTCG > 0 ? totalSTCG * 0.20 : 0;
  const estimatedTaxLTCG = taxableLTCG > 0 ? taxableLTCG * 0.125 : 0;
  const totalTax = estimatedTaxSTCG + estimatedTaxLTCG;

  return (
    <div style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto', color: '#0f172a' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={28} color="#2563eb" />
            Capital Gains Summary & Tax Bifurcation
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Comprehensive realized gains, asset class bifurcations, and estimated tax liabilities.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={selectedFY}
            onChange={(e) => {
              const fy = availableFYs.find((f: any) => f.label === e.target.value);
              if (fy) {
                setSelectedFY(fy.label);
                setCustomRange({ start: fy.start, end: fy.end });
                setReportFilter('custom');
              }
            }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}
          >
            {availableFYs.map((fy: any) => (
              <option key={fy.label} value={fy.label}>{fy.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Total STCG</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: totalSTCG >= 0 ? '#10b981' : '#ef4444' }}>
            ₹{formatCurrency(totalSTCG)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Tax @ 20%: ₹{formatCurrency(estimatedTaxSTCG)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Total LTCG</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: totalLTCG >= 0 ? '#10b981' : '#ef4444' }}>
            ₹{formatCurrency(totalLTCG)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Taxable (&gt;1.25L): ₹{formatCurrency(taxableLTCG)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Net Capital Gain</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: grandTotalGain >= 0 ? '#10b981' : '#ef4444' }}>
            ₹{formatCurrency(grandTotalGain)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Combined Realized Gain</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Estimated Tax Liability</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>
            ₹{formatCurrency(totalTax)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>LTCG Tax @ 12.5%: ₹{formatCurrency(estimatedTaxLTCG)}</div>
        </div>
      </div>

      {/* 1. ASSET CLASS BIFURCATION TABLE */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '28px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={18} color="#2563eb" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Asset Class Tax Bifurcation (All Portfolios)</span>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading Asset Class Bifurcations...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Asset Class</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Sale (₹)</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Acquisition Cost (₹)</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>STCG (₹)</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>LTCG (₹)</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Net Gain (₹)</th>
              </tr>
            </thead>
            <tbody>
              {assetClassData.map((clsGroup, idx) => {
                const netGain = (clsGroup.totalSTCG || 0) + (clsGroup.totalLTCG || 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {clsGroup.assetClass}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>
                      {formatCurrency(clsGroup.totalSellValue)}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>
                      {formatCurrency(clsGroup.totalBuyValue)}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 700, color: clsGroup.totalSTCG >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(clsGroup.totalSTCG)}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 700, color: clsGroup.totalLTCG >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(clsGroup.totalLTCG)}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 800, color: netGain >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(netGain)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 2. PORTFOLIO BREAKDOWN TABLE */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#64748b" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>Portfolio Breakdown</span>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Click on any portfolio to view detailed ITR statement</span>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading Portfolios...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Portfolio</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>STCG (₹)</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>LTCG (₹)</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Net Gain (₹)</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Transactions</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map(port => {
                const st = stcgRows.find(r => String(r.portfolio_id) === String(port.id));
                const lt = ltcgRows.find(r => String(r.portfolio_id) === String(port.id));
                const stVal = st?.total_gain_loss || 0;
                const ltVal = lt?.total_gain_loss || 0;
                const netVal = stVal + ltVal;
                const txns = (st?.transactions || 0) + (lt?.transactions || 0);

                if (txns === 0) return null;

                const displayName = port.investor_name || port.name || port.full_name || `Portfolio ${port.id}`;

                return (
                  <tr key={port.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                      {displayName}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: stVal >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(stVal)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: ltVal >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(ltVal)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 800, color: netVal >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(netVal)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>
                      {txns}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedReportPf(port)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
                          borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#2563eb', cursor: 'pointer'
                        }}
                      >
                        <ExternalLink size={13} /> View ITR Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Budget Notice */}
      <div style={{ marginTop: '24px', background: '#fff7ed', padding: '16px', borderRadius: '8px', border: '1px solid #fed7aa', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <AlertCircle color="#ea580c" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#9a3412' }}>Budget 2024 Updates Applied</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#c2410c' }}>
            Calculations use updated tax rules: STCG on equity is taxed at 20%. LTCG on equity is taxed at 12.5% with an annual exemption limit of Rs. 1.25 Lakhs. Commodities and debt are categorized under their respective tax provisions. These figures are estimates based on FIFO lot matching; consult your CA for final tax filing.
          </p>
        </div>
      </div>

      {/* 3. TAX CATEGORY MODAL (MATCHING HANDWRITTEN FORMAT) */}
      {selectedReportPf && (
        <PortfolioTaxModal
          portfolio={selectedReportPf}
          startDate={customRange.start}
          endDate={customRange.end}
          selectedFY={selectedFY}
          onClose={() => setSelectedReportPf(null)}
        />
      )}
    </div>
  );
}

// ── PORTFOLIO TAX MODAL COMPONENT (MATCHING HANDWRITTEN FORMAT) ──────────────────
function PortfolioTaxModal({
  portfolio,
  startDate,
  endDate,
  selectedFY,
  onClose
}: {
  portfolio: any;
  startDate: string;
  endDate: string;
  selectedFY: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'detailed'>('summary');
  const [reportData, setReportData] = useState<any[]>([]);
  const displayName = portfolio.investor_name || portfolio.name || portfolio.full_name || `Portfolio ${portfolio.id}`;

  useEffect(() => {
    const detailed = generateCapitalGainsDetailed([String(portfolio.id)], ['All Assets'], startDate, endDate);
    setReportData(detailed);
  }, [portfolio, startDate, endDate]);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  let totalSale = 0, totalCost = 0, totalSTCG = 0, totalLTCG = 0, totalIntraday = 0;
  reportData.forEach(d => {
    totalSale += d.totalSellValue || 0;
    totalCost += d.totalBuyValue || 0;
    totalSTCG += d.totalSTCG || 0;
    totalLTCG += d.totalLTCG || 0;
    totalIntraday += d.totalIntraday || 0;
  });
  const netTotalGain = totalSTCG + totalLTCG + totalIntraday;
  const taxableLTCG = Math.max(0, totalLTCG - 125000);
  const estimatedTax = (totalSTCG > 0 ? totalSTCG * 0.20 : 0) + (taxableLTCG > 0 ? taxableLTCG * 0.125 : 0);

  // Define standard categories to display exactly as per handwritten format
  const categoryOrder = [
    { key: 'Stocks', label: 'Equity (Stocks)', taxRuleST: 'Sec 111A @ 20%', taxRuleLT: 'Sec 112A @ 12.5%' },
    { key: 'Mutual Funds (Equity)', label: 'Mutual Funds (Equity)', taxRuleST: 'Sec 111A @ 20%', taxRuleLT: 'Sec 112A @ 12.5%' },
    { key: 'Mutual Funds (Debt)', label: 'Mutual Funds (Debt)', taxRuleST: 'Slab Rate', taxRuleLT: 'Legacy 12.5% / 20%' },
    { key: 'Gold / Commodities', label: 'Gold / Commodities (Silver/Gold ETFs)', taxRuleST: 'Sec 111A / 20%', taxRuleLT: '12.5%' },
    { key: 'Traded Bonds', label: 'Traded Bonds & G-Secs', taxRuleST: 'Slab Rate', taxRuleLT: '12.5% (No Indexation)' },
    { key: 'Mutual Funds (Other)', label: 'Mutual Funds (Other / Multi-Asset)', taxRuleST: 'Slab / 20%', taxRuleLT: '12.5%' },
    { key: 'Other', label: 'Other Securities', taxRuleST: 'Applicable Rate', taxRuleLT: 'Applicable Rate' }
  ];

  const buildPDFDoc = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Capital Gains Tax Category Summary', 14, 11);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${displayName}  |  FY: ${selectedFY} (${startDate} to ${endDate})`, 14, 18);

    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 14, 18, { align: 'right' });

    // Summary KPI Boxes
    const boxW = (pageWidth - 28 - 9) / 4;
    const kpis = [
      { label: 'TOTAL STCG', val: `Rs. ${formatCurrency(totalSTCG)}`, color: totalSTCG >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { label: 'TOTAL LTCG', val: `Rs. ${formatCurrency(totalLTCG)}`, color: totalLTCG >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { label: 'NET CAPITAL GAIN', val: `Rs. ${formatCurrency(netTotalGain)}`, color: netTotalGain >= 0 ? [16, 185, 129] : [239, 68, 68] },
      { label: 'ESTIMATED TAX', val: `Rs. ${formatCurrency(estimatedTax)}`, color: [217, 119, 6] }
    ];

    kpis.forEach((kpi, idx) => {
      const bx = 14 + idx * (boxW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bx, 28, boxW, 16, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, bx + 4, 34);

      doc.setFontSize(10.5);
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, bx + 4, 40);
    });

    // Table rows
    const tableRows: any[] = [];
    categoryOrder.forEach(cat => {
      const dataRow = reportData.find(d => d.assetClass === cat.key);
      const sale = dataRow?.totalSellValue || 0;
      const cost = dataRow?.totalBuyValue || 0;
      const stcg = dataRow?.totalSTCG || 0;
      const ltcg = dataRow?.totalLTCG || 0;
      const net = stcg + ltcg;
      if (sale === 0 && cost === 0 && stcg === 0 && ltcg === 0) return;
      tableRows.push([
        `${cat.label}\n(${cat.taxRuleST} / ${cat.taxRuleLT})`,
        formatCurrency(sale),
        formatCurrency(cost),
        formatCurrency(stcg),
        formatCurrency(ltcg),
        formatCurrency(net),
        `ST: ${cat.taxRuleST}\nLT: ${cat.taxRuleLT}`
      ]);
    });

    tableRows.push([
      'GRAND TOTAL',
      formatCurrency(totalSale),
      formatCurrency(totalCost),
      formatCurrency(totalSTCG),
      formatCurrency(totalLTCG),
      formatCurrency(netTotalGain),
      ''
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Asset Class / Tax Category', 'Total Sale (Rs.)', 'Cost Basis (Rs.)', 'STCG (Rs.)', 'LTCG (Rs.)', 'Net Gain (Rs.)', 'Tax Provisions']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { halign: 'right', cellWidth: 32 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
        4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
        5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        6: { cellWidth: 40, fontSize: 7.5, textColor: [100, 116, 139] }
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.row.index === tableRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [241, 245, 249];
          hookData.cell.styles.textColor = [15, 23, 42];
        }
      }
    });

    return doc;
  };

  const handleExportPDF = () => {
    const doc = buildPDFDoc();
    doc.save(`${displayName.replace(/\s+/g, '_')}_Capital_Gains_${selectedFY}.pdf`);
  };

  const handlePrint = () => {
    const doc = buildPDFDoc();
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 200);
    };
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '1050px', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={20} color="#2563eb" />
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {displayName} — Capital Gains Tax Category Report
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Financial Year: <strong style={{ color: '#1e293b' }}>{selectedFY}</strong> ({startDate} to {endDate})
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* PDF & Print Action Buttons */}
            <button
              onClick={handleExportPDF}
              title="Export Summary PDF"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1',
                borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0f172a', cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <FileDown size={14} color="#dc2626" /> PDF
            </button>

            <button
              onClick={handlePrint}
              title="Print Summary Report"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1',
                borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#0f172a', cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Printer size={14} color="#2563eb" /> Print
            </button>

            <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', marginLeft: '4px' }}>
              <button
                onClick={() => setActiveTab('summary')}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: activeTab === 'summary' ? '#fff' : 'transparent',
                  color: activeTab === 'summary' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'summary' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Tax Category Summary
              </button>
              <button
                onClick={() => setActiveTab('detailed')}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: activeTab === 'detailed' ? '#fff' : 'transparent',
                  color: activeTab === 'detailed' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'detailed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Detailed Trade Lots (ITR Format)
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 10px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b',
                fontWeight: 700, fontSize: '13px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'summary' ? (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total STCG</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: totalSTCG >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                    ₹{formatCurrency(totalSTCG)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total LTCG</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: totalLTCG >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                    ₹{formatCurrency(totalLTCG)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Capital Gain</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: netTotalGain >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                    ₹{formatCurrency(netTotalGain)}
                  </div>
                </div>
                <div style={{ background: '#fffbeb', padding: '14px 18px', borderRadius: '10px', border: '1px solid #fef3c7' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Estimated Tax</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                    ₹{formatCurrency(estimatedTax)}
                  </div>
                </div>
              </div>

              {/* Tax Category Table (Exact Handwritten Format) */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Asset Class / Tax Category</th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Total Sale (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Cost Basis (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>STCG (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>LTCG (₹)</th>
                      <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Net Gain (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryOrder.map((cat, idx) => {
                      const dataRow = reportData.find(d => d.assetClass === cat.key);
                      const sale = dataRow?.totalSellValue || 0;
                      const cost = dataRow?.totalBuyValue || 0;
                      const stcg = dataRow?.totalSTCG || 0;
                      const ltcg = dataRow?.totalLTCG || 0;
                      const net = stcg + ltcg;

                      if (sale === 0 && cost === 0 && stcg === 0 && ltcg === 0) return null;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                            <div>{cat.label}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                              Tax Rates: STCG {cat.taxRuleST} | LTCG {cat.taxRuleLT}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>
                            {formatCurrency(sale)}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>
                            {formatCurrency(cost)}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: stcg >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                            {formatCurrency(stcg)}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 700, color: ltcg >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                            {formatCurrency(ltcg)}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 800, color: net >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                            {formatCurrency(net)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Grand Total Row */}
                    <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', fontWeight: 800 }}>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', textTransform: 'uppercase' }}>
                        Grand Total
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                        {formatCurrency(totalSale)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                        {formatCurrency(totalCost)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: totalSTCG >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                        {formatCurrency(totalSTCG)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: totalLTCG >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                        {formatCurrency(totalLTCG)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '15px', color: netTotalGain >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                        {formatCurrency(netTotalGain)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <CapitalGainsRenderer
              isOpen={true}
              onClose={() => {}}
              reportConfig={{
                category: 'Capital Gains',
                reportName: 'Capital Gains - Income Tax Return Format',
                options: {
                  portfolios: [String(portfolio.id)],
                  assetTypes: ['All Assets'],
                  gainType: 'All',
                  dateRange: { start: startDate, end: endDate }
                }
              }}
              reportData={reportData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
