import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Activity } from 'lucide-react';
import { getStoredPortfolios, getHoldings, getStoredAccounts } from '../logic';
import { useFamily } from '../contexts/FamilyContext';

export default function Dashboard() {
  const { activeFamily } = useFamily();
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [todaysGain, setTodaysGain] = useState(0);

  useEffect(() => {
    const checkData = () => {
      const allAccounts = getStoredAccounts();
      const familyAccounts = allAccounts.filter(a => a.familyId === activeFamily?.id);
      const familyPortfolios = getStoredPortfolios().filter(p => familyAccounts.some(acc => acc.id === p.accountId));
      
      if (familyPortfolios.length > 0) {
        setPortfolios(familyPortfolios);
        const pfIds = familyPortfolios.map(p => Number(p.id));
        const holdings = getHoldings(pfIds);
        let val = 0;
        let gain = 0;
        holdings.forEach(h => {
          val += h.currentValue || 0;
          gain += h.todaysGain || 0;
        });
        setTotalValue(val);
        setTodaysGain(gain);
      } else {
        setPortfolios([]);
        setTotalValue(0);
        setTodaysGain(0);
      }
    };
    checkData();
    const interval = setInterval(checkData, 1000);
    return () => clearInterval(interval);
  }, [activeFamily?.id]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#0f172a' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard size={32} color="#2563eb" />
          Wealth Overview
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>High-level dashboard of your family's net worth and asset allocation.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Wallet size={18} color="#64748b" />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Worth</div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>
            {formatCurrency(totalValue)}
          </div>
          <div style={{ fontSize: '12px', color: todaysGain >= 0 ? '#10b981' : '#ef4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> {todaysGain >= 0 ? '+' : ''}{formatCurrency(todaysGain)} Today
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Activity size={18} color="#64748b" />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Portfolios</div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>
            {portfolios.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Family Investment Accounts</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#64748b" />
            Recent Performance
          </div>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
            Performance Chart Placeholder
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#64748b" />
            Asset Allocation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                <span>Mutual Funds</span>
                <span>65%</span>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '65%', background: '#3b82f6' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                <span>Direct Equity</span>
                <span>25%</span>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '25%', background: '#10b981' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                <span>Bonds & FDs</span>
                <span>10%</span>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '10%', background: '#f59e0b' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
