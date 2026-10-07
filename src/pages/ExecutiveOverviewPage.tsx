import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  FolderOpen, 
  Users, 
  LayoutGrid, 
  RefreshCw, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Download,
  Filter
} from 'lucide-react';
import { 
  getStoredPortfolios, 
  getStoredInvestorGroups, 
  getHoldings, 
  state, 
  formatDateDDMMMYYYY 
} from '../logic';
import type { AssetHolding } from '../logic';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import ExecutivePortfolioView from '../components/pms/ExecutivePortfolioView';
import HoldingBreakupModal from '../components/pms/HoldingBreakupModal';
import AssetLedgerModal from '../components/pms/AssetLedgerModal';
import LedgerDrilldownModal from '../LedgerDrilldownModal';

export default function ExecutiveOverviewPage() {
  const { activeFamily } = useFamily();
  const { customRange, globalRefreshTrigger } = useFY();

  // Dark / Light Theme state specifically for Executive Overview presentation
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('executive_overview_theme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('executive_overview_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Selected portfolio context
  const [selectedContextId, setSelectedContextId] = useState<string>('all');
  const [tick, setTick] = useState(0);

  // Modals state
  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | null>(null);
  const [selectedAssetForLedger, setSelectedAssetForLedger] = useState<{ id: string; name: string; portIds: string[]; atty?: number; } | null>(null);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Portfolios & Groups for the active family
  const portfolios = useMemo(() => {
    return getStoredPortfolios().filter(p => !activeFamily?.id || String(p.client_id) === activeFamily.id);
  }, [activeFamily?.id, tick, globalRefreshTrigger]);

  const groups = useMemo(() => {
    return getStoredInvestorGroups();
  }, [tick, globalRefreshTrigger]);

  // Available options: All Portfolios, Groups, and Individual Portfolios
  const contextOptions = useMemo(() => {
    const list: Array<{ id: string; label: string; portfolioIds: number[]; type: 'all' | 'group' | 'portfolio' }> = [
      { id: 'all', label: 'All Portfolios (Consolidated)', portfolioIds: portfolios.map(p => Number(p.id)), type: 'all' }
    ];

    groups.forEach(g => {
      list.push({
        id: `group-${g.id}`,
        label: `Group: ${g.groupName}`,
        portfolioIds: g.portfolioIds.map(Number),
        type: 'group'
      });
    });

    portfolios.forEach(p => {
      list.push({
        id: `port-${p.id}`,
        label: p.portfolioName.trim(),
        portfolioIds: [Number(p.id)],
        type: 'portfolio'
      });
    });

    return list;
  }, [portfolios, groups]);

  const activeContext = useMemo(() => {
    return contextOptions.find(c => c.id === selectedContextId) || contextOptions[0];
  }, [contextOptions, selectedContextId]);

  // Holdings for selected portfolio context
  const holdings = useMemo(() => {
    if (!activeContext || activeContext.portfolioIds.length === 0) return [];
    return getHoldings(activeContext.portfolioIds, undefined, false);
  }, [activeContext, tick, globalRefreshTrigger, customRange.end]);

  // Linked bank / cash balance for double-entry reconciliation
  const linkedBankBalance = useMemo(() => {
    if (!activeContext || activeContext.portfolioIds.length === 0) return 0;
    const pIds = activeContext.portfolioIds;
    const linkedAccIds = (state.accPflink || [])
      .filter((l: any) => pIds.includes(Number(l.pfid)))
      .map((l: any) => Number(l.accountId || l.account_id || l.accid));
    
    let totalBank = 0;
    (state.acmac1 || []).forEach((acc: any) => {
      const id = Number(acc.id || acc.account_id || acc.aid);
      if (linkedAccIds.includes(id)) {
        const bal = Number(acc.closing_bal || acc.clbal || acc.current_balance || acc.balance || acc.opbal || 0);
        if (!isNaN(bal)) totalBank += bal;
      }
    });
    return totalBank;
  }, [activeContext, globalRefreshTrigger, tick]);

  const handleDrilldown = (assetId: string, assetName: string, portIds: string[], atty?: number) => {
    setSelectedHolding(null);
    setSelectedAssetForLedger({ id: assetId, name: assetName, portIds, atty });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: isDark ? '#06080d' : '#f8fafc',
      color: isDark ? '#f1f5f9' : '#0f172a',
      transition: 'background-color 0.2s ease, color 0.2s ease'
    }}>
      {/* ── TOP CONTROL BAR ── */}
      <div style={{
        height: '60px',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isDark ? '#0b111e' : '#ffffff',
        borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
        flexShrink: 0
      }}>
        {/* Left: Title & Context Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#eff6ff',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bfdbfe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#38bdf8' : '#2563eb'
            }}>
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: isDark ? '#f8fafc' : '#0f172a' }}>
                Executive Overview
              </h2>
              <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b' }}>
                Presentation & Balance Sheet Analytics
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: isDark ? '#1e293b' : '#e2e8f0', margin: '0 4px' }} />

          {/* Portfolio Context Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: isDark ? '#64748b' : '#94a3b8', letterSpacing: '0.05em' }}>
              Portfolio:
            </label>
            <select
              value={selectedContextId}
              onChange={(e) => setSelectedContextId(e.target.value)}
              style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: isDark ? '#131d31' : '#f8fafc',
                color: isDark ? '#f1f5f9' : '#0f172a',
                border: `1px solid ${isDark ? '#22324e' : '#cbd5e1'}`,
                outline: 'none',
                minWidth: '220px'
              }}
            >
              {contextOptions.map(opt => (
                <option key={opt.id} value={opt.id} style={{ background: isDark ? '#0b111e' : '#ffffff', color: isDark ? '#f1f5f9' : '#0f172a' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Theme Toggle & As of Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Theme Switcher Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: isDark ? '#131d31' : '#f1f5f9',
            padding: '3px',
            borderRadius: '10px',
            border: `1px solid ${isDark ? '#22324e' : '#e2e8f0'}`
          }}>
            <button
              onClick={() => setIsDark(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: !isDark ? '#ffffff' : 'transparent',
                color: !isDark ? '#0f172a' : (isDark ? '#94a3b8' : '#64748b'),
                boxShadow: !isDark ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Sun size={13} color={!isDark ? '#d97706' : '#94a3b8'} />
              Light Mode
            </button>
            <button
              onClick={() => setIsDark(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: isDark ? '#1e293b' : 'transparent',
                color: isDark ? '#38bdf8' : '#64748b',
                boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Moon size={13} color={isDark ? '#38bdf8' : '#64748b'} />
              Dark Terminal
            </button>
          </div>

          {/* As Of Date Badge */}
          <div style={{
            background: isDark ? '#131d31' : '#f8fafc',
            border: `1px solid ${isDark ? '#22324e' : '#e2e8f0'}`,
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: isDark ? '#94a3b8' : '#64748b'
          }}>
            As of: {formatDateDDMMMYYYY(customRange.end)}
          </div>
        </div>
      </div>

      {/* ── MAIN EXECUTIVE VIEW CONTENT ── */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <ExecutivePortfolioView
          holdings={holdings}
          portfolioName={activeContext.label}
          isDark={isDark}
          onHoldingClick={setSelectedHolding}
          onDrilldown={handleDrilldown}
          portfolioIds={activeContext.portfolioIds}
          linkedBankBalance={linkedBankBalance}
        />
      </div>

      {/* ── DRILLDOWN MODALS ── */}
      {selectedHolding && (
        <HoldingBreakupModal 
          open={!!selectedHolding} 
          holding={selectedHolding} 
          onClose={() => setSelectedHolding(null)} 
          onDrilldown={handleDrilldown} 
        />
      )}

      {selectedAssetForLedger && Number(selectedAssetForLedger.id) < 0 && (
        <div style={{ position: 'relative', zIndex: 10000 }}>
          <LedgerDrilldownModal
            ledgerId={String(Math.abs(Number(selectedAssetForLedger.id)))}
            accountId={
              String(state.accPflink.find((l: any) => l.pfid === Number(selectedAssetForLedger.portIds[0]))?.accountId)
            }
            onClose={() => setSelectedAssetForLedger(null)}
            onVoucherClick={setEditingVoucherId}
            onNewVoucher={() => {}}
          />
        </div>
      )}

      {selectedAssetForLedger && Number(selectedAssetForLedger.id) >= 0 && (
        <AssetLedgerModal 
          open={!!selectedAssetForLedger} 
          assetId={selectedAssetForLedger.id} 
          assetName={selectedAssetForLedger.name} 
          portfolioIds={selectedAssetForLedger.portIds}
          atty={selectedAssetForLedger.atty}
          onClose={() => setSelectedAssetForLedger(null)} 
          onEditTransaction={setEditingVoucherId}
        />
      )}
    </div>
  );
}
