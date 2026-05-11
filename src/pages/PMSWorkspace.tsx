import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import {
  getStoredAccounts,
  getStoredPortfolios,
  getStoredInvestorGroups,
  getHoldings
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
import AssetLedgerModal from '../components/pms/AssetLedgerModal';
import FamilySelectorModal from '../components/FamilySelectorModal';
import PortfolioActivityModal from '../components/pms/PortfolioActivityModal';
import PMSTransactionModal from '../components/pms/PMSTransactionModal';
import PMSIncomeModal from '../components/pms/PMSIncomeModal';
import PMSPriceModal from '../components/pms/PMSPriceModal';

const ASSET_TYPE_MAP: Record<string, string | string[] | undefined> = {
  all: undefined,
  stocks: 'stocks',
  mf: ['mf_equity', 'mf_debt'], 
  special_inv_funds: 'special_inv_funds',
  nps: 'nps_uup',
  insurance: 'insurance_asset',
  private_equity: 'private_equity',
  fds: 'fds',
  bonds: 'traded_bonds',
  ncd: 'ncd_debentures',
  deposits_loans: 'deposits_loans',
  ppf: 'ppf_epf',
  post: 'post_office',
  gold: 'gold',
  silver: 'silver',
  jewellery: 'jewellery',
  properties: 'property',
  art: 'art',
  aif: 'aif',
  loans: 'loans_asset',
};

const CATEGORY_LABELS: Record<string, string> = {
  stocks: 'Stocks',
  mf_equity: 'Mutual Funds (Equity)',
  mf_debt: 'Mutual Funds (Debt)',
  pms_aif: 'PMS / AIF',
  aif: 'AIF',
  nps_uup: 'NPS / ULiP',
  insurance_asset: 'Insurance',
  fds: 'Fixed Deposits',
  traded_bonds: 'Traded Bonds',
  ncd_debentures: 'NCD / Debentures',
  deposits_loans: 'Deposits / Loans',
  ppf_epf: 'PPF / EPF',
  post_office: 'Post Office',
  gold: 'Gold',
  silver: 'Silver',
  property: 'Properties',
  jewellery: 'Jewellery',
  art: 'Art',
  private_equity: 'Private Equity',
  special_inv_funds: 'Special Inv. Funds',
  stock_in_trade: 'Stock in Trade',
  loans_asset: 'Loans',
};

export default function PMSWorkspace() {
  const navigate = useNavigate();
  const { activeFamily } = useFamily();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeAssetType, setActiveAssetType] = useState<string>('all');
  const [openTabIds, setOpenTabIds] = useState<string[]>(['all']);

  useEffect(() => {
    setActiveTab('all');
    setOpenTabIds(['all']);
  }, [activeFamily?.id]);

  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | null>(null);
  const [selectedAssetForLedger, setSelectedAssetForLedger] = useState<{ id: string; name: string; portIds: string[]; } | null>(null);
  const [isFamilySelectorOpen, setIsFamilySelectorOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<'port' | 'group' | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [incomeAsset, setIncomeAsset] = useState<{ id: string; name: string; portIds: string[] } | null>(null);
  const [priceAsset, setPriceAsset] = useState<{ id: string; name: string; currentPrice: number } | null>(null);

  const [isViewsMenuOpen, setIsViewsMenuOpen] = useState(false);
  const [isActivityMenuOpen, setIsActivityMenuOpen] = useState(false);

  useEffect(() => {
    const handleClick = () => {
      setIsViewsMenuOpen(false);
      setIsActivityMenuOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const accounts = useMemo(() => getStoredAccounts().filter(a => a.familyId === activeFamily?.id), [activeFamily?.id]);
  const portfolios = useMemo(() => getStoredPortfolios().filter(p => accounts.some(acc => acc.id === p.accountId)), [accounts]);
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

  const holdings = useMemo(() => {
    if (!currentTab) return [];
    return getHoldings(currentTab.portfolioIds, ASSET_TYPE_MAP[activeAssetType]);
  }, [currentTab, activeAssetType]);

  const totals = useMemo(() => {
    if (!holdings.length) return { invested: 0, today: 0, overall: 0, value: 0 };
    return holdings.reduce((acc, h) => ({
      invested: acc.invested + h.amtInvested,
      today: acc.today + h.todaysGain,
      overall: acc.overall + h.overallGain,
      value: acc.value + h.currentValue
    }), { invested: 0, today: 0, overall: 0, value: 0 });
  }, [holdings]);

  const handleDrilldown = (assetId: string, assetName: string, portIds: string[]) => setSelectedAssetForLedger({ id: assetId, name: assetName, portIds });
  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* ── TOP BAR ── */}
      <div style={{ height: '60px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="pms-topbar-btn"><FileText size={14} /> Reports <ChevronDown size={12} /></button>
            <button className="pms-topbar-btn"><Plus size={14} /> Import</button>
            <button className="pms-topbar-btn"><RefreshCw size={14} /> Sync</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Family Context:</div>
          <button onClick={() => setIsFamilySelectorOpen(true)} className="btn-secondary" style={{ height: '32px', padding: '0 12px' }}>
            <Users size={14} color="#64748b" />
            {activeFamily?.familyName || 'Select Family'}
            <ChevronDown size={12} color="#94a3b8" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
        
        {/* ── PORTFOLIO TABS (PILL CONTAINER STYLE) ── */}
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

        {/* ── MAIN CARD ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {/* ── CARD HEADER (ASSET TYPES) ── */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfd' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {Object.keys(ASSET_TYPE_MAP).map(type => (
                <button 
                  key={type} 
                  onClick={() => setActiveAssetType(type)} 
                  className={activeAssetType === type ? 'asset-type-btn-active' : 'asset-type-btn'}
                >
                  {type === 'all' ? 'All Assets' : type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* ── ACTION BAR (IN-CARD) ── */}
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
                    <button className="dropdown-item">Collapse All</button>
                    <button className="dropdown-item">Views of Summary Table</button>
                    <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                    <button className="dropdown-item">Sort By Current Value</button>
                    <button className="dropdown-item">Sort By Today's Gain %</button>
                    <button className="dropdown-item">Sort By Overall Gain %</button>
                    <button className="dropdown-item">Sort By Overall Gain</button>
                    <button className="dropdown-item">Sort By Today's Gain</button>
                    <button className="dropdown-item">Show 0 Values</button>
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
                          id: selectedHolding.assetId,
                          name: selectedHolding.assetName,
                          portIds: currentTab?.portfolioIds || []
                        });
                      } else {
                        alert("Please select an asset from the grid first.");
                      }
                    }}>Add Income for the Asset</button>
                    <button className="dropdown-item" onClick={() => {
                      if (selectedHolding) {
                        setPriceAsset({
                          id: selectedHolding.assetId,
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
            <HoldingsGrid data={holdings} onHoldingClick={setSelectedHolding} groupByCategory={activeAssetType === 'all'} categoryLabels={CATEGORY_LABELS} />
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
      {selectedAssetForLedger && (
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setIsSelectorOpen(null)}>
          <div className="modal-box" style={{ padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>Select {isSelectorOpen === 'port' ? 'Portfolio' : 'Investor Group'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(isSelectorOpen === 'port' ? portfolios : groups).map((item: any) => (
                <button key={item.id} onClick={() => { handleOpenContext(isSelectorOpen === 'port' ? 'port-' + item.id : 'group-' + item.id); setIsSelectorOpen(null); }} className="pms-selector-item">
                  {isSelectorOpen === 'port' ? item.portfolioName : item.groupName}
                </button>
              ))}
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
