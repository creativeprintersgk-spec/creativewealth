import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import ReportsModal, { type ReportConfig } from "../components/ReportsModal";
import ReportViewerModal from "../components/ReportViewerModal";
import PMSDashboard from "../components/PMSDashboard";
import AddAssetModal from "../components/pms/AddAssetModal";
import { generatePortfolioSummary, generatePnLDetailed, generateTransactionReport, generateAssetAllocationReport, generateIncomeReport, generate80CReport } from "../services/reportsEngine";
import { generateCapitalGainsDetailed, generateTaxPlanningReport } from "../services/capitalGainsEngine";
import {
  getStoredAccounts,
  getStoredPortfolios,
  getStoredInvestorGroups,
  getHoldings,
  syncLivePrices,
  state,
  formatDateDDMMMYYYY
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
  X,
  ChevronRight
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
import PMSFDInvestmentModal from '../components/pms/PMSFDInvestmentModal';
import PMSPPFModal from '../components/pms/PMSPPFModal';
import PMSNCDBondModal from '../components/pms/PMSNCDBondModal';
import PMSGoldSilverModal from '../components/pms/PMSGoldSilverModal';
import PMSULIPModal from '../components/pms/PMSULIPModal';
import CorporateActionNotificationBanner from '../components/pms/CorporateActionNotificationBanner';

// Keys must match ATTY_MAP in logic.ts (atty numeric IDs in sum_table)
const ASSET_TYPE_TABS = [
  'dashboard', 'all', 'stocks', 'fno', 'mf_eq', 'mf_debt', 'mf_hybrid', 'nps', 'insurance', 'private_equity',
  'fds', 'bonds', 'ncd', 'deposits_loans', 'ppf',
  'gold', 'silver', 'jewellery', 'properties', 'aif', 'loans'
] as const;

const ASSET_TAB_LABELS: Record<string, string> = {
  dashboard:      'Analytics',
  all:              'All Assets',
  stocks:           'Stocks',
  fno:              'F&O / Derivatives',
  mf_eq:            'MF Eq',
  mf_debt:          'MF Debt',
    mf_hybrid:        'MF Hybrid',
  nps:              'NPS / ULiP',
  insurance:        'Insurance',
  fds:              'Fixed Deposits',
  bonds:            'Traded Bonds',
  ncd:              'NCD / Debentures',
  deposits_loans:   'Deposits / Loans',
  ppf:              'PPF / EPF',
  gold:             'Gold',
  silver:           'Silver',
  jewellery:        'Jewellery',
  properties:       'Properties',
  private_equity:   'Private Equity',
  aif:              'AIF',
  loans:            'Loans',
};

// Category labels for HoldingsGrid grouping (based on atty numbers)
const CATEGORY_LABELS: Record<number, string> = {
  30:  'Futures (Stock)',
  31:  'Options (Stock)',
  32:  'Futures (Index)',
  33:  'Options (Index)',
  81:  'Futures (Currency)',
  82:  'Options (Currency)',
  50:  'Stocks',
  51:  'Stocks',
  60:  'Mutual Funds (Equity)',
  61:  'Mutual Funds (Debt)',
  62:  'Mutual Funds (Other)',
  70:  'NCD / Debentures',
  75:  'Mutual Funds (Other)',
  77:  'Silver',
  80:  'Insurance',
  90:  'Fixed Deposits',
  95:  'NPS / ULiP',
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
  stocks:             [50, 51],
  fno:                [30, 31, 32, 33, 81, 82],
  mf_eq:              [60, 66],
  mf_debt:            [61],
    mf_hybrid:          [62, 75],
  nps:                [95],
  insurance:          [80],
  fds:                [90],
  bonds:              [100, 40],
  ncd:                [110, 70],
  deposits_loans:     [120],
  ppf:                [130],
  post:               [140],
  gold:               [150],
  silver:             [151, 77],
  properties:         [160],
  jewellery:          [170],
  art:                [180],
  private_equity:     [190],
  special_inv_funds:  [200],
  aif:                [210],
  loans:              [220],
};

class ModalErrorBoundary extends React.Component<{ onClose: () => void; children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("ModalErrorBoundary caught error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 12px', fontSize: '18px', fontWeight: 800 }}>Unable to Open Transaction</h3>
            <p style={{ color: 'var(--bbg-text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
              {this.state.error?.message || 'An error occurred while loading this transaction.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={this.props.onClose}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PMSWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFamily } = useFamily();
  const { customRange, triggerGlobalRefresh, globalRefreshTrigger } = useFY();
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('pms_activeTab') || 'all');
  const queryAssetType = searchParams.get('assetType');
  const [activeAssetType, setActiveAssetType] = useState<string>(() => {
    if (queryAssetType && (ASSET_TYPE_TABS as readonly string[]).includes(queryAssetType)) {
      return queryAssetType;
    }
    return 'dashboard';
  });

  useEffect(() => {
    const qType = searchParams.get('assetType');
    if (qType && (ASSET_TYPE_TABS as readonly string[]).includes(qType)) {
      setActiveAssetType(qType);
    }
  }, [searchParams]);
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

  const lastFamilyIdRef = useRef<string | null>(activeFamily?.id || null);

  useEffect(() => {
    if (activeFamily?.id !== lastFamilyIdRef.current) {
      setOpenTabIds(['all']);
      setActiveTab('all');
      lastFamilyIdRef.current = activeFamily?.id || null;
    }
  }, [activeFamily?.id]);

  const [selectedHolding, setSelectedHolding] = useState<AssetHolding | null>(null);
  const [selectedAssetForLedger, setSelectedAssetForLedger] = useState<{ id: string; name: string; portIds: string[]; atty?: number; } | null>(null);
  const [isFamilySelectorOpen, setIsFamilySelectorOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<'port' | 'group' | null>(null);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [incomeAsset, setIncomeAsset] = useState<{ id: string; name: string; portIds: string[] } | null>(null);
  const [priceAsset, setPriceAsset] = useState<{ id: string; name: string; currentPrice: number } | null>(null);
  const [specialModal, setSpecialModal] = useState<{
    type: 'fd' | 'ppf' | 'bond' | 'ncd' | 'gold_buy' | 'gold_sell' | 'silver_buy' | 'silver_sell' | 'ulip' | 'ulip_renewal';
    voucherId?: string;
    assetId?: string;
    assetName?: string;
  } | null>(null);
  const [addAssetModalType, setAddAssetModalType] = useState<'stock' | 'mf' | 'bond' | null>(null);
  
  // Reports State
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [reportData, setReportData] = useState<any[] | null>(null);

  const handleGenerateReport = (config: ReportConfig) => {
    setReportConfig(config);
    
    let pIds: string[] = [];
    const passedPorts = config.options.portfolioIds || config.options.portfolios || [];
    if (passedPorts.length > 0 && !passedPorts.includes('all') && !passedPorts.includes('All Portfolios')) {
      // passedPorts can contain IDs (e.g. "4") or names
      pIds = passedPorts.map((item: string) => {
        const found = portfolios.find(p => String(p.id) === item || p.investor_name === item);
        return found ? String(found.id) : item;
      }).filter(Boolean);
    }
    
    if (pIds.length === 0) {
      pIds = getStoredPortfolios().map(p => String(p.id));
    }
    
    const startDate = config.options.dateRange?.start;
    const endDate = config.options.dateRange?.end;

    // Attach metadata to config for renderers
    const allStored = getStoredPortfolios();
    const portfolioName = pIds.length === 1
      ? (allStored.find(p => String(p.id) === pIds[0])?.investor_name || portfolios.find(p => String(p.id) === pIds[0])?.investor_name || `Portfolio ${pIds[0]}`)
      : (currentTab?.label && currentTab.id !== 'all' ? currentTab.label : 'Pramesh R Shah Family');
    config.options.portfolioName = portfolioName;
    config.options.portfolioIds = pIds;

    let data: any[] = [];
    if (config.reportName === 'Portfolio Summary') {
      data = generatePortfolioSummary(pIds, config.options.assetTypes, startDate, endDate);
    } else if (config.reportName === 'P&L Detailed' || config.reportName === 'P&L Summary') {
      data = generatePnLDetailed(pIds, config.options.assetTypes, startDate, endDate);
    } else if (
      config.reportName === 'Realised Capital Gains' ||
      config.reportName === 'Capital Gains - Income Tax Return Format' ||
      config.reportName === 'Capital Gain/Loss Detailed' ||
      config.reportName === 'Capital Gain/Loss Summary'
    ) {
      data = generateCapitalGainsDetailed(pIds, config.options.assetTypes, startDate, endDate);
    } else if (config.category === 'Transactions') {
      data = generateTransactionReport(pIds, config.options.assetTypes, startDate, endDate);
    } else {
      data = [{ message: `Report '${config.reportName}' is not implemented in Phase 1.` }];
    }
    
    setReportData(data);
    setIsViewerOpen(true);
  };

  const [isViewsMenuOpen, setIsViewsMenuOpen] = useState(false);
  const [isActivityMenuOpen, setIsActivityMenuOpen] = useState(false);
  const [isOtherTxMenuOpen, setIsOtherTxMenuOpen] = useState(false);
  const [areAllExpanded, setAreAllExpanded] = useState(false);
  const [showZeroQty, setShowZeroQty] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'todaysGainPct' | 'overallGainPct' | 'overallGain' | 'todaysGain'>('value');

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);

  // Helper: is it NSE market hours right now?
  const isMarketOpen = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const h = now.getHours(), m = now.getMinutes(), day = now.getDay();
    const mins = h * 60 + m;
    return day >= 1 && day <= 5 && mins >= 555 && mins < 930; // 9:15am to 3:30pm IST
  };

  const runSync = (label: string, force = false) => {
    if (syncStatus) return; // already syncing
    setSyncStatus(label);
    syncLivePrices((msg: string) => setSyncStatus(msg), force)
      .catch(e => console.warn('Sync error:', e))
      .finally(() => {
        setSyncStatus(null);
        setLastSyncTime(Date.now());
        setTick(t => t + 1);
      });
  };

  // Sync immediately on mount
  useEffect(() => {
    runSync('Syncing prices...');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync every 15 mins during market hours
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMarketOpen()) runSync('Auto-Syncing...');
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  useEffect(() => {
    const handleClick = () => {
      setIsViewsMenuOpen(false);
      setIsActivityMenuOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Listen for database sync completion (e.g. initial snapshot load) to trigger price sync and refresh UI
  useEffect(() => {
    const handleSyncComplete = () => {
      setTick(t => t + 1);
      if (isMarketOpen()) runSync('Syncing prices...');
    };
    window.addEventListener('wealthcore-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('wealthcore-sync-complete', handleSyncComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = useMemo(() => getStoredAccounts().filter(a => a.familyId === activeFamily?.id), [activeFamily?.id, tick, globalRefreshTrigger]);
  const portfolios = useMemo(() => getStoredPortfolios().filter(p => String(p.client_id) === activeFamily?.id), [activeFamily?.id, tick, globalRefreshTrigger]);
  const groups = useMemo(() => getStoredInvestorGroups(), [tick, globalRefreshTrigger]);

  const allPossibleTabs = useMemo(() => {
    const res: any[] = [{ id: 'all', label: 'All Gadgets', portfolioIds: portfolios.map(p => p.id), isGroup: true }];
    groups.forEach(g => res.push({ id: `group-${g.id}`, label: `${g.groupName}(G)`, portfolioIds: g.portfolioIds, isGroup: true }));
    portfolios.forEach(p => res.push({ id: `port-${p.id}`, label: p.portfolioName.trim(), portfolioIds: [p.id] }));
    return res;
  }, [portfolios, groups]);

  const tabs = useMemo(() => allPossibleTabs.filter(t => openTabIds.includes(t.id)), [allPossibleTabs, openTabIds]);
  const currentTab = useMemo(() => tabs.find(t => t.id === activeTab) || tabs[0] || null, [tabs, activeTab]);

  const defaultPort = useMemo(() => {
    if (currentTab && !currentTab.isGroup && currentTab.portfolioIds?.length === 1) {
      return String(currentTab.portfolioIds[0]);
    }
    const primary = portfolios.find(p => {
      const n = (p.portfolioName || p.investor_name || '').toLowerCase();
      return n.includes('pramesh') && !n.includes('huf') && !n.includes('curr') && !n.includes('fo') && !n.includes('mf');
    }) || portfolios[0];
    return primary ? String(primary.id) : undefined;
  }, [currentTab, portfolios]);
  
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
    const filterIds = activeAssetType === 'all' ? undefined : (ATTY_MAP[activeAssetType] || []);
    return getHoldings(currentTab.portfolioIds.map(Number), filterIds, showZeroQty, true);
  }, [currentTab, activeAssetType, customRange.end, tick, globalRefreshTrigger, showZeroQty]);

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

  const handleDrilldown = (assetId: string, assetName: string, portIds: string[], atty?: number) => {
    setSelectedHolding(null);
    setSelectedAssetForLedger({ id: assetId, name: assetName, portIds, atty });
  };

  const handleHoldingRowClick = (h: AssetHolding) => {
    if ((h as any).isGroup) return;
    const splits = h.portfolioSplits || [];
    if (currentTab?.portfolioIds.length === 1 || splits.length === 1) {
      const portId = splits[0] ? String(splits[0].portfolioId) : String(currentTab?.portfolioIds[0]);
      handleDrilldown(String(h.assetId), h.assetName, [portId], h.assetType);
    } else {
      setSelectedHolding(h);
    }
  };
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const gainColor = (n: number) => n >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bbg-bg)', overflow: 'hidden' }}>
            {/* ── TOP BAR ── */}
      <div style={{ height: '60px', background: 'var(--bbg-surface)', borderBottom: '1px solid var(--bbg-border)', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between', flexShrink: 0, zIndex: 9999, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setIsSelectorOpen('port')} className="btn-primary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', gap: '6px' }}>
              <FolderOpen size={14} /> Open Portfolio
            </button>
            <button onClick={() => setIsSelectorOpen('group')} className="btn-primary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', gap: '6px' }}>
              <LayoutGrid size={14} /> Open Group
            </button>
            <div style={{ width: '1px', height: '22px', background: 'var(--bbg-border)', margin: '0 4px', alignSelf: 'center' }} />
            <button className="pms-topbar-btn" onClick={() => setIsReportsModalOpen(true)}><FileText size={14} /> Reports <ChevronDown size={12} /></button>
            <button className="pms-topbar-btn"><Plus size={14} /> Import</button>
            <button 
              className="pms-topbar-btn" 
              style={{ opacity: syncStatus ? 0.7 : 1, cursor: syncStatus ? 'wait' : 'pointer' }}
              onClick={() => runSync('Syncing...', true)}
              title={`Last synced at ${new Date(lastSyncTime).toLocaleTimeString()}`}
            >
              <RefreshCw size={14} className={syncStatus ? 'animate-spin' : ''} /> 
              {syncStatus || 'Sync'}
            </button>

            <div style={{ width: '1px', height: '22px', background: 'var(--bbg-border)', margin: '0 4px', alignSelf: 'center' }} />

            
              
              {/* VIEWS DROPDOWN */}
            <div style={{ position: 'relative', zIndex: 10000 }}>
              <button onClick={(e) => { e.stopPropagation(); setIsViewsMenuOpen(!isViewsMenuOpen); setIsActivityMenuOpen(false); }} className="btn-secondary" style={{ height: '34px', padding: '0 12px', gap: '6px', fontSize: '12px' }}>
                Views <ChevronDown size={13} />
              </button>
              {isViewsMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'var(--bbg-surface)', border: '1px solid var(--bbg-border)', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 10000, padding: '4px' }}>
                  <button className="dropdown-item" onClick={() => setAreAllExpanded(!areAllExpanded)}>
                    {areAllExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                  <button className="dropdown-item" onClick={() => setShowZeroQty(!showZeroQty)}>
                    {showZeroQty ? 'Hide 0 Qty Assets' : 'Show 0 Qty Assets'}
                  </button>
                  <button className="dropdown-item">Views of Summary Table</button>
                  <div style={{ height: '1px', background: 'var(--bbg-border)', margin: '4px 0' }} />
                  <button className="dropdown-item" onClick={() => setSortBy('name')} style={{ fontWeight: sortBy === 'name' ? 700 : 500 }}>Sort By Name</button>
                  <button className="dropdown-item" onClick={() => setSortBy('value')} style={{ fontWeight: sortBy === 'value' ? 700 : 500 }}>Sort By Current Value</button>
                  <button className="dropdown-item" onClick={() => setSortBy('todaysGainPct')} style={{ fontWeight: sortBy === 'todaysGainPct' ? 700 : 500 }}>Sort By Today's Gain %</button>
                  <button className="dropdown-item" onClick={() => setSortBy('overallGainPct')} style={{ fontWeight: sortBy === 'overallGainPct' ? 700 : 500 }}>Sort By Overall Gain %</button>
                  <button className="dropdown-item" onClick={() => setSortBy('overallGain')} style={{ fontWeight: sortBy === 'overallGain' ? 700 : 500 }}>Sort By Overall Gain</button>
                  <button className="dropdown-item" onClick={() => setSortBy('todaysGain')} style={{ fontWeight: sortBy === 'todaysGain' ? 700 : 500 }}>Sort By Today's Gain</button>
                </div>
              )}
            </div>

            {/* ACTIVITY MENU DROPDOWN */}
            <div style={{ position: 'relative', zIndex: 10000 }}>
              <button onClick={(e) => { e.stopPropagation(); setIsActivityMenuOpen(!isActivityMenuOpen); setIsViewsMenuOpen(false); }} className="btn-amber" style={{ height: '34px', padding: '0 12px', gap: '6px', fontSize: '12px' }}>
                <Activity size={14} /> Activity Menu <ChevronDown size={13} />
              </button>
              {isActivityMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'var(--bbg-surface)', border: '1px solid var(--bbg-border)', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', minWidth: '240px', zIndex: 10000, padding: '4px' }}>
                  <button className="dropdown-item" onClick={() => { setIsActivityOpen(true); setIsActivityMenuOpen(false); }}>View Transactions</button>
                  <button className="dropdown-item" onClick={() => { setEditingVoucherId('new'); setIsActivityMenuOpen(false); }}>Add Transaction (Stocks / MF)</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'fd' }); setIsActivityMenuOpen(false); }}>+ Add Fixed Deposit (FD)</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'ppf' }); setIsActivityMenuOpen(false); }}>+ Add PPF / EPF Contribution</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'ncd' }); setIsActivityMenuOpen(false); }}>+ Add NCD / Debenture Buy</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'bond' }); setIsActivityMenuOpen(false); }}>+ Add Traded Bond Buy</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'gold_buy' }); setIsActivityMenuOpen(false); }}>+ Add Gold / Silver Purchase</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'gold_sell' }); setIsActivityMenuOpen(false); }}>+ Add Gold / Silver Sale</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'ulip' }); setIsActivityMenuOpen(false); }}>+ Add ULIP Policy</button>
                  <button className="dropdown-item" onClick={() => { setSpecialModal({ type: 'ulip_renewal' }); setIsActivityMenuOpen(false); }}>+ Add ULIP Renewal Premium</button>
                  <div style={{ height: '1px', background: 'var(--bbg-border)', margin: '4px 0' }} />
                  <div 
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setIsOtherTxMenuOpen(true)}
                    onMouseLeave={() => setIsOtherTxMenuOpen(false)}
                  >
                    <button className="dropdown-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Other Transactions <ChevronRight size={14} />
                    </button>
                    {isOtherTxMenuOpen && (
                      <div style={{ position: 'absolute', top: 0, right: '100%', marginRight: '4px', background: 'var(--bbg-surface)', border: '1px solid var(--bbg-border)', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', minWidth: '240px', zIndex: 10001, padding: '4px' }}>
                        <button className="dropdown-item">Add Bonus Received</button>
                        <button className="dropdown-item">Add Stock Split Details</button>
                        <button className="dropdown-item">Add Stock D'Merger Details</button>
                        <button className="dropdown-item">Add Merger Details</button>
                        <button className="dropdown-item">IPO, Installation Payment, Co.Fd...</button>
                        <button className="dropdown-item">Buyback</button>
                        <button className="dropdown-item">Dividend Reinvest</button>
                        <button className="dropdown-item">Repayment of Debt</button>
                      </div>
                    )}
                  </div>
                  <div style={{ height: '1px', background: 'var(--bbg-border)', margin: '4px 0' }} />
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
                  <div style={{ height: '1px', background: 'var(--bbg-border)', margin: '4px 0' }} />
                  <button className="dropdown-item">Advance</button>
                  <button className="dropdown-item">Edit Selected Asset</button>
                </div>
              )}
            </div>

            {/* REFRESH BUTTON */}
            <button onClick={() => window.location.reload()} className="btn-secondary" style={{ height: '34px', width: '34px', padding: 0, justifyContent: 'center' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748b', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} color="#64748b" />
            As of: {formatDateDDMMMYYYY(customRange.end)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
        
        {/* AUTOMATED CORPORATE ACTIONS NOTIFICATION BANNER */}
        <CorporateActionNotificationBanner 
          portfolioIds={currentTab ? currentTab.portfolioIds.map(String) : []} 
          onActionApplied={() => setTick(t => t + 1)}
        />

        {/* ── PORTFOLIO TABS (MODERN FOLDER / CARD TAB BAR) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '4px',
          marginBottom: '16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: '2px',
          borderBottom: '2px solid #e2e8f0'
        }}>
          {tabs.map(tab => {
            const isActiveTab = activeTab === tab.id;
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: isActiveTab ? 700 : 500,
                  color: isActiveTab ? '#1e293b' : '#64748b',
                  background: isActiveTab ? '#ffffff' : '#e2e8f0',
                  borderRadius: '10px 10px 0 0',
                  border: isActiveTab ? '1px solid #cbd5e1' : '1px solid transparent',
                  borderBottom: isActiveTab ? '3px solid #3b82f6' : '1px solid transparent',
                  boxShadow: isActiveTab ? '0 -2px 10px rgba(0, 0, 0, 0.04)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: isActiveTab ? '-2px' : '0',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.isGroup ? <LayoutGrid size={14} color={isActiveTab ? '#3b82f6' : '#64748b'} /> : <Users size={14} color={isActiveTab ? '#3b82f6' : '#64748b'} />}
                <span>{tab.label}</span>
                {tab.id !== 'all' && (
                  <span 
                    onClick={(e) => handleCloseTab(e, tab.id)} 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'transparent',
                      color: '#94a3b8',
                      marginLeft: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#cbd5e1'; e.currentTarget.style.color = '#1e293b'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── MAIN CARD ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            
            {/* ── CARD HEADER (ASSET TYPES) ── */}
            <div style={{ padding: '2px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfd', minHeight: '28px' }}>
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
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

              {/* Quick Action Button for the active asset type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingLeft: '12px' }}>
                {activeAssetType === 'stocks' && (
                  <button
                    onClick={() => setAddAssetModalType('stock')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add Stock (ISIN)
                  </button>
                )}
                {(activeAssetType === 'mf_eq' || activeAssetType === 'mf_debt') && (
                  <button
                    onClick={() => setAddAssetModalType('mf')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add Mutual Fund (ISIN)
                  </button>
                )}
                {activeAssetType === 'bonds' && (
                  <button
                    onClick={() => setAddAssetModalType('bond')}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#1e40af', background: 'var(--bbg-active-bg)', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add Traded Bond (ISIN)
                  </button>
                )}
                {activeAssetType === 'nps' && (
                  <>
                    <button
                      onClick={() => setSpecialModal({ type: 'ulip' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add ULIP Policy
                    </button>
                    <button
                      onClick={() => setSpecialModal({ type: 'ulip_renewal' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Renewal Premium
                    </button>
                  </>
                )}
                {activeAssetType === 'fds' && (
                  <button
                    onClick={() => setSpecialModal({ type: 'fd' })}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#1d4ed8', background: 'var(--bbg-active-bg)', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add FD
                  </button>
                )}
                {activeAssetType === 'ppf' && (
                  <button
                    onClick={() => setSpecialModal({ type: 'ppf' })}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add PPF / EPF
                  </button>
                )}
                {activeAssetType === 'ncd' && (
                  <button
                    onClick={() => setSpecialModal({ type: 'ncd' })}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add NCD
                  </button>
                )}
                {activeAssetType === 'gold' && (
                  <>
                    <button
                      onClick={() => setSpecialModal({ type: 'gold_buy' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Gold Purchase
                    </button>
                    <button
                      onClick={() => setSpecialModal({ type: 'gold_sell' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Gold Sale
                    </button>
                  </>
                )}
                {activeAssetType === 'silver' && (
                  <>
                    <button
                      onClick={() => setSpecialModal({ type: 'silver_buy' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: 'var(--bbg-text-muted)', background: 'var(--bbg-hover-bg)', border: '1px solid var(--bbg-border)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Silver Purchase
                    </button>
                    <button
                      onClick={() => setSpecialModal({ type: 'silver_sell' })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Add Silver Sale
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── GRID ── */}
            <div style={{ minHeight: '500px', overflow: 'hidden' }}>
              {activeAssetType === 'dashboard' && currentTab ? <PMSDashboard portfolioIds={currentTab.portfolioIds.map(Number)} /> : <HoldingsGrid 
                data={holdings} 
                onHoldingClick={handleHoldingRowClick} 
                onSetPriceClick={(h) => setPriceAsset({ id: String(h.assetId), name: h.assetName, currentPrice: h.currentPrice })}
                groupByCategory={activeAssetType === 'all'} 
                categoryLabels={CATEGORY_LABELS} 
                onDataChange={setEnrichedHoldings} 
                areAllExpanded={areAllExpanded}
                sortBy={sortBy}
              />}
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
        <ModalErrorBoundary onClose={() => setSelectedAssetForLedger(null)}>
          <AssetLedgerModal 
            open={!!selectedAssetForLedger} 
            assetId={selectedAssetForLedger.id} 
            assetName={selectedAssetForLedger.name} 
            portfolioIds={selectedAssetForLedger.portIds}
            atty={selectedAssetForLedger.atty}
            onClose={() => setSelectedAssetForLedger(null)} 
            onEditTransaction={setEditingVoucherId}
          />
        </ModalErrorBoundary>
      )}
      {editingVoucherId && (
        <ModalErrorBoundary onClose={() => setEditingVoucherId(null)}>
          <PMSTransactionModal 
            voucherId={editingVoucherId}
            onClose={() => setEditingVoucherId(null)}
            onSaved={() => {
              setEditingVoucherId(null);
              setTick(t => t + 1);
              triggerGlobalRefresh();
            }}
          />
        </ModalErrorBoundary>
      )}

      {/* ── SPECIAL ASSET MODALS (DIRECT ACCESS) ── */}
      {specialModal?.type === 'fd' && (
        <PMSFDInvestmentModal
          assetId={specialModal.assetId || '0'}
          assetName={specialModal.assetName || ''}
          portfolioIds={currentTab?.portfolioIds.map(String) || (portfolios[0] ? [String(portfolios[0].id)] : [])}
          voucherId={specialModal.voucherId}
          onClose={() => setSpecialModal(null)}
          onSaved={() => {
            setSpecialModal(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}
      {specialModal?.type === 'ppf' && (
        <PMSPPFModal
          assetId={specialModal.assetId || '0'}
          assetName={specialModal.assetName || ''}
          portfolioIds={currentTab?.portfolioIds.map(String) || (portfolios[0] ? [String(portfolios[0].id)] : [])}
          voucherId={specialModal.voucherId}
          onClose={() => setSpecialModal(null)}
          onSaved={() => {
            setSpecialModal(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}
      {(specialModal?.type === 'ncd' || specialModal?.type === 'bond') && (
        <PMSNCDBondModal
          assetId={specialModal.assetId || '0'}
          assetName={specialModal.assetName || ''}
          portfolioIds={currentTab?.portfolioIds.map(String) || (portfolios[0] ? [String(portfolios[0].id)] : [])}
          voucherId={specialModal.voucherId}
          assetCategory={specialModal.type === 'ncd' ? 'ncd' : 'bonds'}
          onClose={() => setSpecialModal(null)}
          onSaved={() => {
            setSpecialModal(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}
      {(specialModal?.type === 'gold_buy' || specialModal?.type === 'gold_sell' || specialModal?.type === 'silver_buy' || specialModal?.type === 'silver_sell') && (
        <PMSGoldSilverModal
          assetId={specialModal.assetId || '0'}
          assetName={specialModal.assetName || (specialModal.type.startsWith('gold') ? 'Gold' : 'Silver')}
          portfolioIds={currentTab?.portfolioIds.map(String) || (portfolios[0] ? [String(portfolios[0].id)] : [])}
          voucherId={specialModal.voucherId}
          metal={specialModal.type.startsWith('gold') ? 'gold' : 'silver'}
          initialMode={specialModal.type.endsWith('sell') ? 'sale' : 'addition'}
          onClose={() => setSpecialModal(null)}
          onSaved={() => {
            setSpecialModal(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}
      {(specialModal?.type === 'ulip' || specialModal?.type === 'ulip_renewal') && (
        <PMSULIPModal
          assetId={specialModal.assetId}
          assetName={specialModal.assetName}
          portfolioIds={currentTab?.portfolioIds.map(String) || (portfolios[0] ? [String(portfolios[0].id)] : [])}
          voucherId={specialModal.voucherId}
          initialMode={specialModal.type === 'ulip_renewal' ? 'renewal' : 'new_policy'}
          onClose={() => setSpecialModal(null)}
          onSaved={() => {
            setSpecialModal(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}
      {isSelectorOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setIsSelectorOpen(null); setTempSelectedIds([]); }}>
          <div className="modal-box" style={{ padding: '24px', width: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Select {isSelectorOpen === 'port' ? 'Portfolios' : 'Investor Groups'}</h3>
              <button onClick={() => { setIsSelectorOpen(null); setTempSelectedIds([]); }} style={{ background: 'none', border: 'none', color: 'var(--bbg-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
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
                      background: isChecked ? 'var(--bbg-active-bg)' : 'var(--bbg-bg)', 
                      border: isChecked ? '1px solid #3b82f6' : '1px solid var(--bbg-border)', 
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
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isChecked ? '#2563eb' : 'var(--bbg-text-main)' }}>
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
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}

      {/* Add Security Master Modal */}
      {addAssetModalType && (
        <AddAssetModal
          initialType={addAssetModalType}
          defaultPortfolioId={defaultPort}
          onClose={() => setAddAssetModalType(null)}
          onAssetCreated={(asset, price) => {
            setAddAssetModalType(null);
            setTick(t => t + 1);
            triggerGlobalRefresh();
          }}
        />
      )}

      {/* Reports Modals */}
      <ReportsModal 
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        activeFamily={activeFamily}
        activePortfolio={currentTab?.isGroup ? null : portfolios.find(p => `port-${p.id}` === currentTab?.id)}
        onGenerateReport={handleGenerateReport}
      />

      <ReportViewerModal 
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        reportConfig={reportConfig}
        reportData={reportData}
      />
      
      <style>{`
        .btn-active-tab { height: 32px; padding: 0 16px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3); background: linear-gradient(to bottom, var(--bbg-bg), var(--bbg-surface)); color: #2563eb; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.15); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); transform: translateY(-1px); }
        .btn-inactive-tab { height: 32px; padding: 0 16px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--bbg-text-muted); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .btn-inactive-tab:hover { background: rgba(255, 255, 255, 0.8); color: #334155; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.05); }
        .asset-type-btn { padding: 3px 10px; font-size: 11.5px; font-weight: 600; color: var(--bbg-text-muted); border: 1px solid var(--bbg-border); background: var(--bbg-hover-bg); cursor: pointer; border-radius: 6px; transition: all 0.15s ease; white-space: nowrap; height: 24px; display: inline-flex; align-items: center; }
        .asset-type-btn:hover { color: var(--bbg-text-main); background: var(--bbg-border); border-color: var(--bbg-text-muted); }
        .asset-type-btn-active { padding: 3px 10px; font-size: 11.5px; font-weight: 700; color: var(--bbg-bg); border: 1px solid #1d4ed8; background: #2563eb; cursor: pointer; border-radius: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25); transition: all 0.15s ease; white-space: nowrap; height: 24px; display: inline-flex; align-items: center; }
        
        .tab-close-icon { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bbg-text-muted); transition: all 0.2s; }
        .tab-close-icon:hover { background: #fee2e2; color: #ef4444; }

        .btn-amber { display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.12s; line-height: 1; }
        .btn-amber:hover { background: #fef08a; }

        .table-row { border-bottom: 1px solid var(--bbg-hover-bg); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: white; cursor: pointer; position: relative; }
        .table-row:hover { background: #fafafa; transform: translateX(2px) scale(1.002); box-shadow: 0 4px 12px rgba(0,0,0,0.03); z-index: 10; border-left: 2px solid #4f46e5; }
        .table-row-group { background: var(--bbg-surface); font-weight: 700; border-bottom: 2px solid var(--bbg-border); border-top: 1px solid var(--bbg-border); }

        .pms-selector-item { padding: 14px; text-align: left; background: var(--bbg-surface); border: 1px solid var(--bbg-border); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--bbg-text-main); transition: all 0.2s; }
        .pms-selector-item:hover { background: var(--bbg-active-bg); border-color: #3b82f6; color: #2563eb; transform: translateX(4px); }

        .dropdown-item { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: var(--bbg-text-muted); border-radius: 6px; cursor: pointer; transition: background 0.1s; }
        .dropdown-item:hover { background: var(--bbg-hover-bg); color: var(--bbg-text-main); }
      `}</style>
    </div>
  );
}

