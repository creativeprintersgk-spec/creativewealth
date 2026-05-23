import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useFY } from '../FYContext';
import { Calculator, TrendingUp, AlertCircle, FileText, Download } from 'lucide-react';
import { getStoredPortfolios, getCapitalGains } from '../logic';

type CGSummaryRow = {
  portfolio_id: string;
  gain_type: 'STCG' | 'LTCG';
  transactions: number;
  total_gain_loss: number;
  estimated_tax: number;
};

export default function CapitalGainsPage() {
  const { customRange, selectedFY, setReportFilter, setCustomRange, setSelectedFY, availableFYs } = useFY();
  const [data, setData] = useState<CGSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);

  useEffect(() => {
    setPortfolios(getStoredPortfolios());
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const pfs = getStoredPortfolios();
        const pfIds = pfs.map(p => Number(p.id));
        // Use timeout to let loading state render
        setTimeout(() => {
          const txns = getCapitalGains(pfIds, customRange.start, customRange.end);
          
          const summary: Record<string, CGSummaryRow> = {};
          txns.forEach(tx => {
            const key = `${tx.portfolioId}_${tx.gainType}`;
            if (!summary[key]) {
              summary[key] = {
                portfolio_id: String(tx.portfolioId),
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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Process data for display
  const stcgRows = data.filter(r => r.gain_type === 'STCG');
  const ltcgRows = data.filter(r => r.gain_type === 'LTCG');

  const totalSTCG = stcgRows.reduce((sum, r) => sum + r.total_gain_loss, 0);
  const totalLTCG = ltcgRows.reduce((sum, r) => sum + r.total_gain_loss, 0);
  
  // Tax logic: 1.25L exemption on LTCG
  const taxableLTCG = Math.max(0, totalLTCG - 125000);
  const estimatedTaxSTCG = totalSTCG > 0 ? totalSTCG * 0.20 : 0;
  const estimatedTaxLTCG = taxableLTCG > 0 ? taxableLTCG * 0.125 : 0;
  const totalTax = estimatedTaxSTCG + estimatedTaxLTCG;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calculator size={32} color="#2563eb" />
            Capital Gains Summary
          </h1>
          <p style={{ color: '#64748b', margin: 0 }}>Review realized gains and estimated tax liabilities for the selected financial year.</p>
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
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}
          >
            {availableFYs.map((fy: any) => (
              <option key={fy.label} value={fy.label}>{fy.label}</option>
            ))}
          </select>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total STCG</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: totalSTCG >= 0 ? '#10b981' : '#ef4444' }}>
            {formatCurrency(totalSTCG)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Tax @ 20%: {formatCurrency(estimatedTaxSTCG)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total LTCG</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: totalLTCG >= 0 ? '#10b981' : '#ef4444' }}>
            {formatCurrency(totalLTCG)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Taxable (&gt;1.25L): {formatCurrency(taxableLTCG)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Estimated Tax</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
            {formatCurrency(totalTax)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>LTCG Tax @ 12.5%: {formatCurrency(estimatedTaxLTCG)}</div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="#64748b" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>Portfolio Breakdown</span>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Portfolio</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>STCG (₹)</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>LTCG (₹)</th>
                <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map(port => {
                const st = stcgRows.find(r => r.portfolio_id === port.id);
                const lt = ltcgRows.find(r => r.portfolio_id === port.id);
                const stVal = st?.total_gain_loss || 0;
                const ltVal = lt?.total_gain_loss || 0;
                const txns = (st?.transactions || 0) + (lt?.transactions || 0);

                if (txns === 0) return null;

                return (
                  <tr key={port.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{port.name}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: stVal >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(stVal)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: ltVal >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>
                      {formatCurrency(ltVal)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#64748b', textAlign: 'right' }}>
                      {txns}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      <div style={{ marginTop: '24px', background: '#fff7ed', padding: '16px', borderRadius: '8px', border: '1px solid #fed7aa', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <AlertCircle color="#ea580c" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#9a3412' }}>Budget 2024 Updates Applied</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#c2410c' }}>
            Calculations use updated tax rules: STCG is taxed at 20%. LTCG on equity is taxed at 12.5% with an annual exemption limit of ₹1.25 Lakhs. These figures are estimates based on FIFO lot matching; consult your CA for final tax filing.
          </p>
        </div>
      </div>
    </div>
  );
}
