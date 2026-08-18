import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Activity } from 'lucide-react';
import { getStoredPortfolios, getHoldings, getStoredAccounts } from '../logic';
import { useFamily } from '../contexts/FamilyContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
        <div className="glass-panel glass-card-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--accent-bg)', borderRadius: '50%', filter: 'blur(30px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', position: 'relative' }}>
            <Wallet size={20} color="#6366f1" />
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Worth</div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            {formatCurrency(totalValue)}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: todaysGain >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> {todaysGain >= 0 ? '+' : ''}{formatCurrency(todaysGain)} Today
          </div>
        </div>

        <div className="glass-panel glass-card-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', position: 'relative' }}>
            <Activity size={20} color="#38bdf8" />
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Portfolios</div>
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            {portfolios.length}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Family Investment Accounts</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#4f46e5" />
            Recent Performance
          </div>
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { name: 'Jan', value: totalValue * 0.7 },
                  { name: 'Feb', value: totalValue * 0.75 },
                  { name: 'Mar', value: totalValue * 0.72 },
                  { name: 'Apr', value: totalValue * 0.8 },
                  { name: 'May', value: totalValue * 0.85 },
                  { name: 'Jun', value: totalValue * 0.95 },
                  { name: 'Jul', value: totalValue || 100000 }
                ]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Value']}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#ec4899" />
            Asset Allocation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: 8, height: 8, borderRadius: '50%', background: '#3b82f6'}} />Mutual Funds</span>
                <span>65%</span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '65%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '4px' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: 8, height: 8, borderRadius: '50%', background: '#10b981'}} />Direct Equity</span>
                <span>25%</span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '25%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: 8, height: 8, borderRadius: '50%', background: '#f59e0b'}} />Bonds & FDs</span>
                <span>10%</span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '10%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
