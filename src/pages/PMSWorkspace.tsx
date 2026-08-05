import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import {
  getStoredAccounts,
  getStoredPortfolios,
  getStoredInvestorGroups,
  getHoldings,
  syncLivePrices,
  state
} from '../logic';
import type { AssetHolding } from '../logic';

import { 
  PieChart, 
  Plus, 
  Users, 
  Settings, 
  RefreshCw, 
  ChevronDown, 
  FileText, 
  FolderOpen,
  LayoutGrid,
  Activity,
  X
} from 'lucide-react';

import HoldingsGrid from '../components/pms/HoldingsGrid';
import HoldingBreakupModal from '../components/pms/HoldingBreakupModal';
import LedgerDrilldownModal from '../LedgerDrilldownModal';
import AssetLedgerModal from '../components/pms/AssetLedgerModal';
import FamilySelectorModal from '../components/FamilySelectorModal';
import PortfolioActivityModal from '../components/pms/PortfolioActivityModal';
import PMSTransactionModal from '../components/pms/PMSTransactionModal';
import PMSIncomeModal from '../components/pms/PMSIncomeModal';
import PMSPriceModal from '../components/pms/PMSPriceModal';

// Keys must match ATTY_MAP in logic.ts (atty numeric IDs in sum_table)
const ASSET_TYPE_TABS = [
  'all', 'stocks', 'mf', 'nps', 'insurance', 'private_equity',
  'fds', 'bonds', 'ncd', 'deposits_loans', 'ppf', 'post',
  'gold', 'silver', 'jewellery', 'properties', 'art', 'aif', 'loans', 'special_inv_funds'
] as const;

const ASSET_TAB_LABELS: Record<string, string> = {
  all:              'All Assets',
  stocks:           'Stocks',
  mf:               'Mutual Funds',
  nps:              'NPS / ULiP',
  insurance:        'Insurance',
  fds:              'Fixed Deposits',
  bonds:            'Traded Bonds',
  ncd:              'NCD / Debentures',
  deposits_loans:   'Deposits / Loans',
  ppf:              'PPF / EPF',
  post:             'Post Office',
  gold:             'Gold',
  silver:           'Silver',
  jewellery:        'Jewellery',
  properties:       'Properties',
  art:              'Art',
  private_equity:   'Private Equity',
  special_inv_funds:'Special Inv. Funds',
  aif:              'AIF',
  loans:            'Loans',
};

// Category labels for HoldingsGrid grouping (based on atty numbers)
const CATEGORY_LABELS: Record<number, string> = {
  50:  'Stocks',
  60:  'Mutual Funds (Equity)',
  61:  'Mutual Funds (Debt)',
  62:  'Mutual Funds (Other)',
  70:  'NPS / ULiP',
  80:  'Insurance',
  90:  'Fixed Deposits',
  100: 'Traded Bonds',
  110: 'NCD / Debentures',
  120: 'Deposits / Loans',
  130: 'PPF / EPF',
  140: 'Post Office',
  150: 'Gold',
  151: 'Silver',
  160: 'Properties',
  170: 'Jewellery',
  180: 'Art',
  190: 'Private Equity',
  200: 'Special Inv. Funds',
  210: 'AIF',
  220: 'Loans',
};

const ATTY_MAP: Record<string, number[] | undefined> = {
  stocks:             [50],
  mf:                 [60, 66, 81],
  nps:                [95],
  fds:                [30],
  bonds:              [40],
  gold:               [70],
  silver:             [75],
  jewellery:          [77],
  properties:         [115],
  ppf:                [120],
  aif:                [140],
};

export default function PMSWorkspace() {
  const navigate = useNavigate();
  const { activeFamily } = useFamily();
  const { customRange } = useFY();
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('pms_activeTab') || 'all');
  const [activeAssetType, setActiveAssetType] = useState<string>('all');
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('pms_openTabs');
    return saved ? JSON.parse(saved) : ['all'];
  });

  useEffect(() => {
    localStorage.setItem('pms_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('pms_openTabs', JSON.stringify(openTabIds));
  }, [openTabIds]);

  useEffect(() => {
    setOpenTabIds(['all']);
    setActiveTab('all');
  }, [activeFamily?.id]);

  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | null>(null);
  const [selectedAssetForLedger, setSelectedAssetForLedger] = useState<{ id: string; name: string; portIds: string[]; } | null>(null);
  const [isFamilySelectorOpen, setIsFamilySelectorOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<'port' | 'group' | null>(null);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [incomeAsset, setIncomeAsset] = useState<{ id: string; name: string; portIds: string[] } | null>(null);
  const [priceAsset, setPriceAsset] = useState<{ id: string; name: string; currentPrice: number } | null>(null);

  const [isViewsMenuOpen, setIsViewsMenuOpen] = useState(false);
  const [isActivityMenuOpen, setIsActivityMenuOpen] = useState(false);
  const [areAllExpanded, setAreAllExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'todaysGainPct' | 'overallGainPct' | 'overallGain' | 'todaysGain'>('value');

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!syncStatus) {
        setSyncStatus('Auto-Syncing...');
        syncLivePrices((msg: string) => setSyncStatus(msg))
          .finally(() => {
            setSyncStatus(null);
            setLastSyncTime(Date.now());
            setTick(t => t + 1);
          });
      }
    }, 15 * 60 * 1000); // 15 mins
    return () => clearInterval(interval);
  }, [syncStatus]);

  useEffect(() => {
    const handleClick = () => {
      setIsViewsMenuOpen(false);
      setIsActivityMenuOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const accounts = useMemo(() => getStoredAccounts().filter(a => a.familyId === activeFamily?.id), [activeFamily?.id]);
  const portfolios = useMemo(() => getStoredPortfolios().filter(p => String(p.client_id) === activeFamily?.id), [activeFamily?.id]);
  const groups = useMemo(() => getStoredInvestorGroups(), []);

  const allPossibleTabs = useMemo(() => {
    const res: any[] = [{ id: 'all', label: 'All Gadgets', portfolioIds: portfolios.map(p => p.id) }];
    groups.forEach(g => res.push({ id: `group-${g.id}`, label: `${g.groupName}(G)`, portfolioIds: g.portfolioIds, isGroup: true }));
    portfolios.forEach(p => res.push({ id: `port-${p.id}`, label: p.portfolioName.trim(), portfolioIds: [p.id] }));
    return res;
  }, [portfolios, groups]);

  const tabs = useMemo(() => allPossibleTabs.filter(t => openTabIds.includes(t.id)), [allPossibleTabs, openTabIds]);
  const currentTab = useMemo(() => tabs.find(t => t.id === activeTab) || tabs[0] || null, [tabs, activeTab]);
  
  const handleOpenContext = (id: string) => {
    if (!openTabIds.includes(id)) setOpenTabIds(prev => [...prev, id]);
    setActiveTab(id);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === 'all') return;
    const newIds = openTabIds.filter(tid => tid !== id);
    setOpenTabIds(newIds);
    if (activeTab === id) setActiveTab('all');
  };

  // Compute base holdings from MProfit data
  const holdings = useMemo(() => {
    if (!currentTab) return [];
    const filterIds = activeAssetType === 'all' ? undefined : (ATTY_MAP[activeAssetType] || []);
    return getHoldings(currentTab.portfolioIds.map(Number), filterIds);
  }, [currentTab, activeAssetType, customRange.end, tick]); // Re-compute when tick changes (after sync)

  const [enrichedHoldings, setEnrichedHoldings] = useState<any[]>([]);

  useEffect(() => {
    setEnrichedHoldings(holdings);
  }, [holdings]);

  // Aggregate totals from enriched holdings (which are populated by HoldingsGrid async fetch)
  const totals = useMemo(() => {
    if (!enrichedHoldings.length) return { invested: 0, today: 0, overall: 0, value: 0 };
    return enrichedHoldings.filter(r => !r.isGroup).reduce((acc, h) => ({
      invested: acc.invested + (h.amtInvested || 0),
      today: acc.today + (h.todaysGain || 0),
      overall: acc.overall + (h.overallGain || 0),
      value: acc.value + (h.currentValue || 0)
    }), { invested: 0, today: 0, overall: 0, value: 0 });
  }, [enrichedHoldings]);

  const handleDrilldown = (assetId: string, assetName: string, portIds: string[]) => setSelectedAssetForLedger({ id: assetId, name: assetName, portIds });
  const fmt = (n: number) => '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* ── TOP BAR ── */}
      <div style={{ height: '60px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="pms-topbar-btn"><FileText size={14} /> Reports <ChevronDown size={12} /></button>
            <button className="pms-topbar-btn"><Plus size={14} /> Import</button>
            <button 
              className="pms-topbar-btn" 
              style={{ opacity: syncStatus ? 0.7 : 1, cursor: syncStatus ? 'wait' : 'pointer' }}
              onClick={async () => {
                if (syncStatus) return;
                setSyncStatus('Starting Sync...');
                await syncLivePrices((msg: string) => setSyncStatus(msg));
                setSyncStatus(null);
                setLastSyncTime(Date.now());
                setTick(t => t + 1);
              }}
              title={`Last synced at ${new Date(lastSyncTime).toLocaleTimeString()}`}
            >
              <RefreshCw size={14} className={syncStatus ? 'animate-spin' : ''} /> 
              {syncStatus || 'Sync'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Family Context:</div>
          <button onClick={() => setIsFamilySelectorOpen(true)} className="btn-secondary" style={{ height: '32px', padding: '0 12px' }}>
            <Users size={14} color="#64748b" />
            {activeFamily?.familyName || 'Select Family'}
            <ChevronDown size={12} color="#94a3b8" />
          </button>
          <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} color="#64748b" />
            As of: {new Date(customRange.end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
        
        {/* â”€â”€ PORTFOLIO TABS (PILL CONTAINER STYLE) â”€â”€ */}
        <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'inline-flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={activeTab === tab.id ? 'btn-active-tab' : 'btn-inactive-tab'}
            >
              {tab.isGroup ? <LayoutGrid size={14} /> : <Users size={14} />}
              {tab.label}
              {tab.id !== 'all' && (
                <div onClick={(e) => handleCloseTab(e, tab.id)} className="tab-close-icon"><X size={12} /></div>
              )}
            </button>
          ))}
        </div>

        {/* â”€â”€ MAIN CARD â”€â”€ */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {/* â”€â”€ CARD HEADER (ASSET TYPES) â”€â”€ */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfd' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {ASSET_TYPE_TABS.map(type => (
                <button 
                  key={type} 
                  onClick={() => setActiveAssetType(type)} 
                  className={activeAssetType === type ? 'asset-type-btn-active' : 'asset-type-btn'}
                >
                  {ASSET_TAB_LABELS[type] || type}
                </button>
              ))}
            </div>
          </div>

          {/* â”€â”€ ACTION BAR (IN-CARD) â”€â”€ */}
          <div style={{ height: '72px', background: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => setIsSelectorOpen('port')} className="btn-primary" style={{ height: '40px', padding: '0 16px', justifyContent: 'center' }}>
                <FolderOpen size={16} /> Open Portfolio
              </button>
              <button onClick={() => setIsSelectorOpen('group')} className="btn-primary" style={{ height: '40px', padding: '0 16px', justifyContent: 'center' }}>
                <LayoutGrid size={16} /> Open Group
              </button>
              <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 8px' }} />
              
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setIsViewsMenuOpen(!isViewsMenuOpen); setIsActivityMenuOpen(false); }} className="btn-secondary" style={{ height: '40px', padding: '0 16px', gap: '6px' }}>
                  Views <ChevronDown size={14} />
                </button>
                {isViewsMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', minWidth: '220px', zIndex: 100, padding: '4px' }}>
                    <button className="dropdown-item" onClick={() => setAreAllExpanded(!areAllExpanded)}>
                      {areAllExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                    <button className="dropdown-item">Views of Summary Table</button>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                    <button className="dropdown-item" onClick={() => setSortBy('name')} style={{ fontWeight: sortBy === 'name' ? 700 : 500 }}>Sort By Name</button>
                    <button className="dropdown-item" onClick={() => setSortBy('value')} style={{ fontWeight: sortBy === 'value' ? 700 : 500 }}>Sort By Current Value</button>
                    <button className="dropdown-item" onClick={() => setSortBy('todaysGainPct')} style={{ fontWeight: sortBy === 'todaysGainPct' ? 700 : 500 }}>Sort By Today's Gain %</button>
                    <button className="dropdown-item" onClick={() => setSortBy('overallGainPct')} style={{ fontWeight: sortBy === 'overallGainPct' ? 700 : 500 }}>Sort By Overall Gain %</button>
                    <button className="dropdown-item" onClick={() => setSortBy('overallGain')} style={{ fontWeight: sortBy === 'overallGain' ? 700 : 500 }}>Sort By Overall Gain</button>
                    <button className="dropdown-item" onClick={() => setSortBy('todaysGain')} style={{ fontWeight: sortBy === 'todaysGain' ? 700 : 500 }}>Sort By Today's Gain</button>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setIsActivityMenuOpen(!isActivityMenuOpen); setIsViewsMenuOpen(false); }} className="btn-amber" style={{ height: '40px', padding: '0 16px', gap: '6px' }}>
                  <Activity size={16} /> Activity Menu <ChevronDown size={14} />
                </button>
                {isActivityMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', minWidth: '240px', zIndex: 100, padding: '4px' }}>
                    <button className="dropdown-item" onClick={() => setIsActivityOpen(true)}>View Transactions</button>
                    <button className="dropdown-item" onClick={() => setEditingVoucherId('new')}>Add Transaction</button>
                    <button className="dropdown-item">Other Transactions</button>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                    <button className="dropdown-item" onClick={() => {
                      if (selectedHolding) {
                        setIncomeAsset({
                          id: String(selectedHolding.assetId),
                          name: selectedHolding.assetName,
                          portIds: currentTab?.portfolioIds.map(String) || []
                        });
                      } else {
                        alert("Please select an asset from the grid first.");
                      }
                    }}>Add Income for the Asset</button>
                    <button className="dropdown-item" onClick={() => {
                      if (selectedHolding) {
                        setPriceAsset({
                          id: String(selectedHolding.assetId),
                          name: selectedHolding.assetName,
                          currentPrice: selectedHolding.currentPrice
                        });
                      } else {
                        alert("Please select an asset from the grid first.");
                      }
                    }}>Set Current Price</button>
                    <button className="dropdown-item">Update Prices of the portfolio</button>
                    <button className="dropdown-item">Edit/Delete asset for this portfolio</button>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                    <button className="dropdown-item">Advance</button>
                    <button className="dropdown-item">Edit Selected Asset</button>
                  </div>
                )}
              </div>

              <button onClick={() => window.location.reload()} className="btn-secondary" style={{ height: '40px', width: '40px', padding: 0, justifyContent: 'center' }}>
                <RefreshCw size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>INVESTED</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>{fmt(totals.invested)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>CURRENT VALUE</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#2563eb' }}>{fmt(totals.value)}</div>
              </div>
            </div>
          </div>

          {/* ── GRID ── */}
          <div style={{ minHeight: '500px', overflow: 'hidden' }}>
            <HoldingsGrid 
              data={holdings} 
              onHoldingClick={setSelectedHolding} 
              groupByCategory={activeAssetType === 'all'} 
              categoryLabels={CATEGORY_LABELS} 
              onDataChange={setEnrichedHoldings} 
              areAllExpanded={areAllExpanded}
              sortBy={sortBy}
            />
          </div>

          {/* ── FOOTER ── */}
          <div style={{ height: '40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '20px', fontSize: '11px' }}>
              <div>Invested: <span style={{ fontWeight: 700 }}>{fmt(totals.invested)}</span></div>
              <div>Value: <span style={{ fontWeight: 800, color: '#2563eb' }}>{fmt(totals.value)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '11px' }}>
              <div>Today: <span style={{ fontWeight: 700, color: gainColor(totals.today) }}>{fmt(totals.today)}</span></div>
              <div>Overall: <span style={{ fontWeight: 700, color: gainColor(totals.overall) }}>{fmt(totals.overall)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {selectedHolding && <HoldingBreakupModal open={!!selectedHolding} holding={selectedHolding} onClose={() => setSelectedHolding(null)} onDrilldown={handleDrilldown} />}
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
          onClose={() => setSelectedAssetForLedger(null)} 
          onEditTransaction={setEditingVoucherId}
        />
      )}
      {editingVoucherId && (
        <PMSTransactionModal 
          voucherId={editingVoucherId}
          onClose={() => setEditingVoucherId(null)}
          onSaved={() => {
            setEditingVoucherId(null);
            window.location.reload(); // Quick refresh for now
          }}
        />
      )}
      {isSelectorOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setIsSelectorOpen(null); setTempSelectedIds([]); }}>
          <div className="modal-box" style={{ padding: '24px', width: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Select {isSelectorOpen === 'port' ? 'Portfolios' : 'Investor Groups'}</h3>
              <button onClick={() => { setIsSelectorOpen(null); setTempSelectedIds([]); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {(isSelectorOpen === 'port' ? portfolios : groups).map((item: any) => {
                const id = isSelectorOpen === 'port' ? 'port-' + item.id : 'group-' + item.id;
                const isChecked = tempSelectedIds.includes(id);
                const isOpen = openTabIds.includes(id);

                return (
                  <label 
                    key={item.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                      background: isChecked ? '#eff6ff' : '#f8fafc', 
                      border: isChecked ? '1px solid #3b82f6' : '1px solid #e2e8f0', 
                      borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={(e) => {
                        if (e.target.checked) setTempSelectedIds(prev => [...prev, id]);
                        else setTempSelectedIds(prev => prev.filter(tid => tid !== id));
                      }} 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isChecked ? '#2563eb' : '#1e293b' }}>
                        {isSelectorOpen === 'port' ? item.portfolioName : item.groupName}
                      </div>
                      {isOpen && <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>ALREADY OPEN</div>}
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => { setIsSelectorOpen(null); setTempSelectedIds([]); }} 
                className="btn-secondary" style={{ flex: 1, height: '40px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (tempSelectedIds.length > 0) {
                    const newIds = [...openTabIds];
                    tempSelectedIds.forEach(id => {
                      if (!newIds.includes(id)) newIds.push(id);
                    });
                    setOpenTabIds(newIds);
                    setActiveTab(tempSelectedIds[0]);
                  }
                  setIsSelectorOpen(null);
                  setTempSelectedIds([]);
                }} 
                className="btn-primary" 
                style={{ flex: 1, height: '40px' }}
                disabled={tempSelectedIds.length === 0}
              >
                Open Selected ({tempSelectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
      <FamilySelectorModal isOpen={isFamilySelectorOpen} onClose={() => setIsFamilySelectorOpen(false)} />
      <PortfolioActivityModal open={isActivityOpen} onClose={() => setIsActivityOpen(false)} portfolioIds={currentTab?.portfolioIds || []} title={currentTab?.label || ''} onEditTransaction={setEditingVoucherId} />
      
      {incomeAsset && (
        <PMSIncomeModal 
          assetId={incomeAsset.id}
          assetName={incomeAsset.name}
          portfolioIds={incomeAsset.portIds}
          onClose={() => setIncomeAsset(null)}
          onSaved={() => {
            setIncomeAsset(null);
            window.location.reload();
          }}
        />
      )}

      {priceAsset && (
        <PMSPriceModal 
          assetId={priceAsset.id}
          assetName={priceAsset.name}
          currentPrice={priceAsset.currentPrice}
          onClose={() => setPriceAsset(null)}
          onSaved={() => {
            setPriceAsset(null);
            window.location.reload();
          }}
        />
      )}
      
      <style>{`
        .btn-active-tab { height: 32px; padding: 0 16px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; color: #1d4ed8; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .btn-inactive-tab { height: 32px; padding: 0 16px; border-radius: 6px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .btn-inactive-tab:hover { color: #0f172a; }
        
        .tab-close-icon { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s; }
        .tab-close-icon:hover { background: #fee2e2; color: #ef4444; }

        .asset-type-btn { padding: 6px 12px; border-radius: 6px; border: none; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.1s; }
        .asset-type-btn-active { padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; color: #0f172a; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .btn-amber { display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.12s; line-height: 1; }
        .btn-amber:hover { background: #fef08a; }

        .pms-selector-item { padding: 14px; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 700; color: #1e293b; transition: all 0.2s; }
        .pms-selector-item:hover { background: #eff6ff; border-color: #3b82f6; color: #2563eb; transform: translateX(4px); }

        .dropdown-item { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #475569; border-radius: 6px; cursor: pointer; transition: background 0.1s; }
        .dropdown-item:hover { background: #f1f5f9; color: #0f172a; }
      `}</style>
    </div>
  );
}

