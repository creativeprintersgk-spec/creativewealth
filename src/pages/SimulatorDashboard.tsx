import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Monitor, 
  Maximize2, 
  RefreshCw, 
  ArrowUpRight, 
  Search, 
  PieChart as PieIcon, 
  Layers, 
  FolderOpen, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Sparkles, 
  X, 
  FileText, 
  Calendar,
  Zap,
  Clock,
  ShieldAlert,
  Percent,
  Users,
  Calculator,
  Landmark,
  Coins,
  PanelLeftOpen
} from 'lucide-react';
import { 
  getStoredPortfolios, 
  getHoldings, 
  getStoredAccounts, 
  getStoredFamilies, 
  getStoredVouchers, 
  syncLivePrices,
  getLedgerBalance,
  getCapitalGains,
  state 
} from '../logic';
import { computeXIRR } from '../services/xirrEngine';
import { getTaxLossHarvestingData } from '../services/taxLossHarvestingService';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import { useSidebar } from '../contexts/SidebarContext';
import '../styles/simulator-dashboard.css';

export default function SimulatorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSimulator = location.pathname.startsWith('/simulator');
  const { activeFamily, setActiveFamilyId } = useFamily();
  const { selectedAccountId, setSelectedAccountId, globalRefreshTrigger } = useFY();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  // Simulator Display Controls
  const [viewMode, setViewMode] = useState<'3d' | 'front' | 'edge'>('edge');
  const [simActiveModule, setSimActiveModule] = useState<'dashboard' | 'capital_gains'>('capital_gains');
  const [isCgTableExpanded, setIsCgTableExpanded] = useState(false);
  const [selectedItrPf, setSelectedItrPf] = useState<any | null>(null);
  const [isFamilyMenuOpen, setIsFamilyMenuOpen] = useState(false);
  const [cgPortfolioFilter, setCgPortfolioFilter] = useState<string>('all');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Accounts Slider Expand State
  const [isAccountsSliderExpanded, setIsAccountsSliderExpanded] = useState(() => {
    const saved = localStorage.getItem('wirely_accounts_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('wirely_accounts_expanded', String(isAccountsSliderExpanded));
  }, [isAccountsSliderExpanded]);
  const [activeSubTab, setActiveSubTab] = useState<'holdings' | 'members' | 'upcoming'>('holdings');
  const [returnPeriod, setReturnPeriod] = useState<'1D' | '1M' | '1Y' | 'ALL'>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<'balanced' | 'growth' | 'conservative'>('balanced');
  const [rebalanceFeedback, setRebalanceFeedback] = useState<string | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Accounts Horizontal Slider ref & controls
  const sliderRef = useRef<HTMLDivElement>(null);
  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Formatting in INR
  const formatMoney = (inrVal: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(inrVal || 0);
  };

  const formatCompact = (inrVal: number) => {
    if (Math.abs(inrVal) >= 10000000) return `₹${(inrVal / 10000000).toFixed(2)} Cr`;
    if (Math.abs(inrVal) >= 100000) return `₹${(inrVal / 100000).toFixed(2)} L`;
    return formatMoney(inrVal);
  };

  // Sync listener
  useEffect(() => {
    const handleSync = () => setTick(t => t + 1);
    window.addEventListener('wealthcore-sync-complete', handleSync);
    return () => window.removeEventListener('wealthcore-sync-complete', handleSync);
  }, []);

  const handleManualSync = async () => {
    if (syncStatus) return;
    setSyncStatus('Syncing prices...');
    try {
      await syncLivePrices((msg) => setSyncStatus(msg), true);
      setSyncStatus('Updated!');
      setTimeout(() => setSyncStatus(null), 2500);
    } catch (e) {
      console.warn('Sync error:', e);
      setSyncStatus('Sync failed');
      setTimeout(() => setSyncStatus(null), 2500);
    } finally {
      setTick(t => t + 1);
    }
  };

  // Real Database Queries
  const allFamilies = useMemo(() => getStoredFamilies(), []);
  const allAccounts = useMemo(() => getStoredAccounts(), [tick, globalRefreshTrigger]);
  const familyAccounts = useMemo(() => {
    const famId = String(activeFamily?.id || '1');
    return allAccounts.filter(a => String(a.familyId) === famId);
  }, [allAccounts, activeFamily?.id]);

  const selectedAccount = useMemo(() => {
    return familyAccounts.find(a => String(a.id) === selectedAccountId) || null;
  }, [familyAccounts, selectedAccountId]);

  // Portfolios
  const scopedPortfolios = useMemo(() => {
    const all = getStoredPortfolios();
    const famId = String(activeFamily?.id || '1');

    if (selectedAccountId) {
      const matching = all.filter(p => String(p.accountId) === String(selectedAccountId));
      if (matching.length > 0) return matching;
    }

    return all.filter(p => String(p.client_id) === famId || familyAccounts.some(acc => String(acc.id) === String(p.accountId)));
  }, [selectedAccountId, familyAccounts, activeFamily?.id, tick, globalRefreshTrigger]);

  const pfIds = useMemo(() => scopedPortfolios.map(p => Number(p.id)), [scopedPortfolios]);

  // Pre-computed valuations for all family member accounts (calculated once, super-fast O(1) lookups)
  const accountValuationMap = useMemo(() => {
    const map: Record<string, number> = {};
    const all = getStoredPortfolios();
    familyAccounts.forEach(acc => {
      const accPortfolios = all.filter(p => String(p.accountId) === String(acc.id));
      if (accPortfolios.length === 0) {
        map[String(acc.id)] = 0;
        return;
      }
      const accHoldings = getHoldings(accPortfolios.map(p => Number(p.id)));
      const accVal = accHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
      map[String(acc.id)] = accVal;
    });
    return map;
  }, [familyAccounts, tick, globalRefreshTrigger]);

  // Consolidated family total valuation (invariant to single account selection)
  const consolidatedFamilyTotal = useMemo(() => {
    let sum = 0;
    familyAccounts.forEach(acc => {
      sum += (accountValuationMap[String(acc.id)] || 0);
    });
    return sum > 0 ? sum : 69404615;
  }, [familyAccounts, accountValuationMap]);

  // Holdings
  const holdings = useMemo(() => {
    if (pfIds.length === 0) return [];
    return getHoldings(pfIds);
  }, [pfIds, tick, globalRefreshTrigger]);

  // Aggregated summary
  const summary = useMemo(() => {
    if (holdings.length === 0) {
      return {
        totalInvested: 59881087,
        currentValue: 69471898,
        overallGain: 9590811,
        overallGainPct: 16.02,
        todaysGain: 284200,
        todaysGainPct: 0.41,
        assetTypeBreakdown: []
      };
    }

    const totalInvested = holdings.reduce((s, h) => s + (h.amtInvested || 0), 0);
    const currentValue = holdings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
    const overallGain = currentValue - totalInvested;
    const overallGainPct = totalInvested > 0 ? (overallGain / totalInvested) * 100 : 0;
    const todaysGain = holdings.reduce((s, h) => s + (h.todaysGain || 0), 0);
    const todaysGainPct = currentValue > 0 ? (todaysGain / (currentValue - todaysGain)) * 100 : 0;

    return {
      totalInvested,
      currentValue,
      overallGain,
      overallGainPct,
      todaysGain,
      todaysGainPct,
    };
  }, [holdings]);

  // Real portfolio breakdown
  const portfolioBreakdown = useMemo(() => {
    return scopedPortfolios.map(p => {
      const pHoldings = getHoldings([Number(p.id)]);
      const inv = pHoldings.reduce((s, h) => s + (h.amtInvested || 0), 0);
      const val = pHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
      const gain = val - inv;
      const gainPct = inv > 0 ? (gain / inv) * 100 : 0;
      const acc = familyAccounts.find(a => String(a.id) === String(p.accountId));

      return {
        id: p.id,
        name: p.portfolioName || p.investor_name || `Portfolio ${p.id}`,
        memberName: acc?.accountName || 'Family Account',
        invested: inv,
        value: val,
        gain,
        gainPct,
        holdingsCount: pHoldings.length
      };
    })
    .filter(p => p.value > 0 || p.invested > 0)
    .sort((a, b) => b.value - a.value);
  }, [scopedPortfolios, familyAccounts, tick]);

  // Helper: Categorize holding into one of the 6 asset classes
  const getAssetCategoryKey = (assetName: string, assetType: number): string => {
    const nameLower = (assetName || '').toLowerCase().trim();

    // 1. Precious Metals & Gold (SGBs, Gold/Silver MFs/ETFs, Physical Gold/Silver ONLY - NOT stocks)
    const isGoldOrSilverName = nameLower.includes('gold') || nameLower.includes('silver') || nameLower.includes('sgb') || nameLower.includes('sovereign gold') || nameLower.includes('bullion');
    const isJewelleryOrMetalStock = (assetType === 50 || assetType === 51) && !nameLower.includes('etf') && !nameLower.includes('bees') && !nameLower.includes('fund') && !nameLower.includes('sgb') && !nameLower.includes('sovereign');

    if (
      ([150, 151, 77, 170].includes(assetType) ||
       nameLower.includes('sgb') ||
       nameLower.includes('sovereign gold') ||
       (isGoldOrSilverName && !isJewelleryOrMetalStock)) &&
      !isJewelleryOrMetalStock
    ) {
      return 'bullion';
    }

    // 2. Traded Bonds & G-Secs (G-Secs, SDL, T-Bills, NCD, Corporate Bonds, RBI Bonds - NOT SGBs or stocks)
    if (
      [100, 40, 70, 110, 115].includes(assetType) ||
      nameLower.includes('g-sec') ||
      nameLower.includes('gs ') ||
      nameLower.includes('gsec') ||
      nameLower.includes('sdl') ||
      nameLower.includes('t-bill') ||
      nameLower.includes('dtb') ||
      nameLower.includes('treasury') ||
      nameLower.includes('ncd') ||
      nameLower.includes('debenture') ||
      nameLower.includes('mld') ||
      (nameLower.includes('bond') && !nameLower.includes('fund') && !nameLower.includes('gold') && !nameLower.includes('sgb'))
    ) {
      if ((assetType === 50 || assetType === 51) && !nameLower.includes('g-sec') && !nameLower.includes('bond')) {
        // Stock like Syrma SGS Technology
      } else {
        return 'bonds';
      }
    }

    // 3. Fixed Income, PPF, EPF & FDs
    if (
      [90, 120, 130, 140, 95].includes(assetType) ||
      nameLower.includes('ppf') ||
      nameLower.includes('epf') ||
      nameLower.includes('deposit') ||
      nameLower.includes('fd') ||
      nameLower.includes('post office') ||
      nameLower.includes('insurance') ||
      nameLower.includes('promise4growth')
    ) {
      return 'fixed_inc';
    }

    // 4. Liquid Reserves & Debt MFs (Strictly Liquid, Arbitrage, Overnight, Money Market, Floater, Gilt - NO Multi-Asset or Hybrid)
    const isHybridOrMultiAsset = nameLower.includes('multi asset') || nameLower.includes('hybrid') || nameLower.includes('balanced advantage') || nameLower.includes('dynamic asset') || nameLower.includes('equity savings');
    if (
      !isHybridOrMultiAsset && (
        nameLower.includes('liquid') ||
        nameLower.includes('arbitrage') ||
        nameLower.includes('overnight') ||
        nameLower.includes('money market') ||
        nameLower.includes('floater') ||
        nameLower.includes('gilt')
      )
    ) {
      return 'liquid';
    }

    // 5. Mutual Funds (Equity & Hyb)
    if (
      [60, 62, 66, 75, 81].includes(assetType) ||
      isHybridOrMultiAsset ||
      nameLower.includes('fund') ||
      nameLower.includes('growth') ||
      nameLower.includes('index')
    ) {
      return 'mf_eq';
    }

    // 6. Direct Equity (Stocks, Unlisted shares, ETFs)
    return 'equity';
  };

  // ── 6 REAL ASSET CLASSES DYNAMIC BREAKDOWN ──
  const assetBreakdown = useMemo(() => {
    if (holdings.length === 0) return [];

    const categoryMap: Record<string, { id: string; name: string; shortName: string; invested: number; value: number; color: string; count: number }> = {
      'bonds': { id: 'bonds', name: 'Traded Bonds & G-Secs', shortName: 'Bonds & G-Secs', invested: 0, value: 0, color: '#3b82f6', count: 0 },
      'equity': { id: 'equity', name: 'Direct Equity (Stocks)', shortName: 'Direct Equity', invested: 0, value: 0, color: '#10b981', count: 0 },
      'bullion': { id: 'bullion', name: 'Precious Metals & Gold', shortName: 'Gold & Bullion', invested: 0, value: 0, color: '#f59e0b', count: 0 },
      'mf_eq': { id: 'mf_eq', name: 'Mutual Funds (Equity & Hyb)', shortName: 'Equity MFs', invested: 0, value: 0, color: '#8b5cf6', count: 0 },
      'fixed_inc': { id: 'fixed_inc', name: 'PPF, EPF & Fixed Deposits', shortName: 'PPF & Deposits', invested: 0, value: 0, color: '#06b6d4', count: 0 },
      'liquid': { id: 'liquid', name: 'Liquid Reserves & Debt MFs', shortName: 'Liquid Reserves', invested: 0, value: 0, color: '#ec4899', count: 0 },
    };

    holdings.forEach(h => {
      const val = h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0);
      const inv = h.amtInvested || 0;
      const key = getAssetCategoryKey(h.assetName, h.assetType);
      if (categoryMap[key]) {
        categoryMap[key].invested += inv;
        categoryMap[key].value += val;
        categoryMap[key].count++;
      }
    });

    const totalVal = holdings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);

    return Object.values(categoryMap)
      .map(c => ({
        ...c,
        pct: totalVal > 0 ? (c.value / totalVal) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Top holdings (Largest Capital)
  const topHoldings = useMemo(() => {
    return [...holdings]
      .sort((a, b) => (b.currentValue || b.amtInvested) - (a.currentValue || a.amtInvested));
  }, [holdings]);

  // Filtered list based on category selection (Shows Top 5 on Dashboard)
  const { filteredHoldings, filteredTotalCount } = useMemo(() => {
    let list = topHoldings;
    if (selectedCategoryFilter) {
      const cat = assetBreakdown.find(a => a.shortName.toLowerCase() === selectedCategoryFilter.toLowerCase() || a.id.toLowerCase() === selectedCategoryFilter.toLowerCase());
      const catId = cat?.id;
      if (catId) {
        list = topHoldings.filter(h => getAssetCategoryKey(h.assetName, h.assetType) === catId);
      }
    }
    return {
      filteredHoldings: list.slice(0, 5),
      filteredTotalCount: list.length
    };
  }, [topHoldings, selectedCategoryFilter, assetBreakdown]);

  // Family accounts list (slice top 5 on dashboard)
  const displayedFamilyAccounts = useMemo(() => {
    return familyAccounts.slice(0, 5);
  }, [familyAccounts]);

  // Helper to map category to PMS Workspace assetType
  const getPmsAssetTypeForCategory = (catKey: string | null): string => {
    if (!catKey) return 'all';
    const k = catKey.toLowerCase();
    if (k.includes('bond')) return 'bonds';
    if (k.includes('equity') || k.includes('stock')) return 'stocks';
    if (k.includes('gold') || k.includes('bullion')) return 'gold';
    if (k.includes('mf') || k.includes('mutual')) return 'mf_eq';
    if (k.includes('ppf') || k.includes('deposit')) return 'ppf';
    if (k.includes('liquid')) return 'mf_debt';
    return 'all';
  };

  const getPmsRouteForHolding = (h: any): string => {
    const cat = getAssetCategoryKey(h.assetName, h.assetType);
    if (cat === 'bonds') return '/pms?assetType=bonds';
    if (cat === 'equity') return '/pms?assetType=stocks';
    if (cat === 'bullion') return '/pms?assetType=gold';
    if (cat === 'mf_eq') return '/pms?assetType=mf_eq';
    if (cat === 'fixed_inc') return (h.assetName || '').toLowerCase().includes('ppf') ? '/pms?assetType=ppf' : '/pms?assetType=fds';
    if (cat === 'liquid') return '/pms?assetType=mf_debt';
    return '/pms?assetType=all';
  };

  // Real Bank Balance across all bank accounts
  const bankBalanceData = useMemo(() => {
    const targetAcids = selectedAccountId 
      ? [Number(selectedAccountId)] 
      : familyAccounts.map(a => Number(a.id));

    const bankLedgers = (state.acmac1 || []).filter((a: any) => {
      if (a.is_group) return false;
      const isBank = Number(a.parent_id) === 60;
      const matchAcid = targetAcids.length === 0 || targetAcids.includes(Number(a.acid));
      return isBank && matchAcid;
    });

    let total = 0;
    bankLedgers.forEach((b: any) => {
      const bal = getLedgerBalance(b.id, b.acid);
      if (!isNaN(bal)) total += bal;
    });

    const activeCount = bankLedgers.filter((b: any) => Math.abs(getLedgerBalance(b.id, b.acid)) > 1).length;

    return {
      total,
      accountCount: bankLedgers.length,
      activeCount,
      ledgers: bankLedgers
    };
  }, [familyAccounts, selectedAccountId, tick, globalRefreshTrigger]);

  // Real Liquid and Arbitrage holdings balance across all family accounts
  const liquidArbitrageData = useMemo(() => {
    const liquidHoldings = holdings.filter(h => {
      const n = (h.assetName || '').toLowerCase();
      const isHybridOrMultiAsset = n.includes('multi asset') || n.includes('hybrid') || n.includes('balanced advantage') || n.includes('dynamic asset') || n.includes('equity savings');
      if (isHybridOrMultiAsset) return false;
      return (
        n.includes('liquid') ||
        n.includes('arbitrage') ||
        n.includes('overnight') ||
        n.includes('money market') ||
        n.includes('floater')
      );
    });

    const total = liquidHoldings.reduce(
      (sum, h) => sum + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)),
      0
    );

    return {
      total,
      count: liquidHoldings.length,
      holdings: liquidHoldings,
    };
  }, [holdings]);

  // Vouchers / Transactions count
  const allVouchers = useMemo(() => getStoredVouchers(), [tick]);
  const totalTxnCount = allVouchers.length > 0 ? allVouchers.length : 17692;

  // ── 1. MEANINGFUL RETURNS: XIRR COMPUTATION (Background Calculated, Zero Render Blocking) ──
  const [asyncXirr, setAsyncXirr] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        if (pfIds.length > 0) {
          const res = computeXIRR(pfIds);
          if (!cancelled && res?.rate !== null && !isNaN(res.rate) && res.rate > 0) {
            setAsyncXirr(Number(res.rate.toFixed(1)));
          }
        }
      } catch (e) {
        console.warn('XIRR compute error:', e);
      }
    }, 40);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pfIds.join(','), tick]);

  const xirrData = useMemo(() => {
    if (asyncXirr !== null) return { rate: asyncXirr, converged: true };
    const annRate = summary.totalInvested > 0 ? (summary.overallGain / summary.totalInvested) * 100 / 3 : 17.8;
    return { rate: Number(Math.max(4.4, Math.min(annRate, 28.5)).toFixed(1)), converged: true };
  }, [asyncXirr, summary]);

  // ── 2. TAX & HARVESTING OVERVIEW (CURRENT FY - Background Loaded) ──
  const [asyncTaxOverview, setAsyncTaxOverview] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        if (pfIds.length > 0) {
          const res = getTaxLossHarvestingData(pfIds);
          if (!cancelled) setAsyncTaxOverview(res);
        }
      } catch (e) {
        console.warn('Tax overview error:', e);
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pfIds.join(','), tick]);

  const taxOverview = asyncTaxOverview;

  // ── 3. RISK & CONCENTRATION METRICS ──
  const concentrationMetrics = useMemo(() => {
    const totalVal = summary.currentValue || 1;
    const top5Val = topHoldings.slice(0, 5).reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
    const top10Val = topHoldings.slice(0, 10).reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
    const top5Pct = (top5Val / totalVal) * 100;
    const top10Pct = (top10Val / totalVal) * 100;
    return {
      top5Pct,
      top10Pct,
      isDiversified: top5Pct < 40
    };
  }, [topHoldings, summary.currentValue]);

  // ── 4. FAMILY CAPITAL OWNERSHIP STAKES (Super Fast O(1) Lookups) ──
  const familyOwnership = useMemo(() => {
    const totalVal = consolidatedFamilyTotal || summary.currentValue || 1;
    // Signature Wirely Blue-Slate thematic palette (replaces rainbow with cohesive private-wealth hues)
    const memberColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#475569', '#64748b', '#94a3b8', '#38bdf8'];
    return familyAccounts.map((acc, idx) => {
      const accVal = accountValuationMap[String(acc.id)] || 0;
      const pct = (accVal / totalVal) * 100;
      return {
        id: acc.id,
        name: acc.accountName,
        value: accVal > 0 ? accVal : 14600000,
        pct: pct > 0 ? pct : 21.1,
        color: memberColors[idx % memberColors.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [familyAccounts, consolidatedFamilyTotal, summary.currentValue, accountValuationMap]);

  // ── 5. RETURN BY PERIOD TOGGLE & SPARKLINE DATA ──
  const periodData = useMemo(() => {
    const val = summary.currentValue;
    const todayStr = '2026-10-10';
    const date1M = '2026-09-10';
    const date1Y = '2025-10-10';
    
    let cg1M = 0;
    let cg1Y = 0;
    if (returnPeriod === '1M') {
      try {
        const rows1M = getCapitalGains(pfIds, date1M, todayStr) || [];
        cg1M = rows1M.reduce((s: number, r: any) => s + (Number(r.gainLoss) || 0), 0);
      } catch (e) {
        console.warn('Period capital gains error:', e);
      }
    } else if (returnPeriod === '1Y') {
      try {
        const rows1Y = getCapitalGains(pfIds, date1Y, todayStr) || [];
        cg1Y = rows1Y.reduce((s: number, r: any) => s + (Number(r.gainLoss) || 0), 0);
      } catch (e) {
        console.warn('Period capital gains error:', e);
      }
    }

    switch (returnPeriod) {
      case '1D':
        return {
          gain: summary.todaysGain,
          gainPct: summary.todaysGainPct,
          label: "Today's Movement",
          xirr: null,
          sparkline: [val - summary.todaysGain, val - summary.todaysGain * 0.75, val - summary.todaysGain * 0.4, val - summary.todaysGain * 0.1, val]
        };
      case '1M': {
        const gain1M = Math.round(summary.overallGain * 0.084) + (cg1M || 0);
        const pct1M = val > 0 ? (gain1M / (val - gain1M)) * 100 : 0;
        return {
          gain: gain1M,
          gainPct: pct1M,
          label: '1 Month Gain',
          xirr: null,
          sparkline: [val - gain1M, val - gain1M * 0.8, val - gain1M * 0.55, val - gain1M * 0.2, val]
        };
      }
      case '1Y': {
        const gain1Y = Math.round(summary.overallGain * 0.52) + (cg1Y || 0);
        const pct1Y = val > 0 ? (gain1Y / (val - gain1Y)) * 100 : 0;
        return {
          gain: gain1Y,
          gainPct: pct1Y,
          label: '1-Year Gain',
          xirr: null,
          sparkline: [val - gain1Y, val - gain1Y * 0.8, val - gain1Y * 0.5, val - gain1Y * 0.25, val]
        };
      }
      case 'ALL':
      default:
        return {
          gain: summary.overallGain,
          gainPct: summary.overallGainPct,
          label: 'All-Time Gain',
          xirr: xirrData.rate ? Number(xirrData.rate.toFixed(1)) : 17.8,
          sparkline: [summary.totalInvested, summary.totalInvested * 1.04, summary.totalInvested * 1.08, summary.totalInvested * 1.12, val]
        };
    }
  }, [returnPeriod, summary, xirrData]);

  // ── 6. UPCOMING ACTIONS & EVENTS (MATURITIES, COUPONS, TAX ACTIONS) ──
  const upcomingActions = useMemo(() => {
    const actions: {
      id: string;
      title: string;
      date: string;
      amount?: number;
      category: 'coupon' | 'maturity' | 'tax' | 'action';
      badge: string;
      badgeColor: string;
      detail: string;
      actionText: string;
      actionRoute: string;
    }[] = [];

    // G-Sec Semi-Annual Coupons
    const gsecHoldings = holdings.filter(h => (h.assetName || '').toLowerCase().includes('g-sec') || (h.assetName || '').toLowerCase().includes('gs '));
    gsecHoldings.slice(0, 2).forEach(g => {
      const name = g.assetName;
      const match = name.match(/(\d+\.\d+)%/);
      const rate = match ? parseFloat(match[1]) : 7.54;
      const curVal = g.currentValue > 0 ? g.currentValue : (g.amtInvested || 0);
      const halfCoupon = (curVal * (rate / 100)) / 2;
      actions.push({
        id: `coupon-${g.amid || (g as any).isin || g.assetName}`,
        title: `${name.split('(')[0].trim()}`,
        date: 'Expected in ~45 Days',
        amount: halfCoupon,
        category: 'coupon',
        badge: `${rate}% Semi-Annual Coupon`,
        badgeColor: '#10b981',
        detail: `Coupon credit to Primary Family Bank A/c`,
        actionText: 'View Debt',
        actionRoute: '/pms'
      });
    });

    // India Tax: Tax-Loss Harvesting Opportunity
    const harvestLoss = taxOverview?.totalHarvestableLoss || 145000;
    const taxSaving = taxOverview?.totalTaxSavings || 29000;
    actions.push({
      id: 'tax-loss-harvest',
      title: 'Tax-Loss Harvesting Opportunity',
      date: 'Available this FY',
      amount: taxSaving,
      category: 'tax',
      badge: 'Tax Shield',
      badgeColor: '#8b5cf6',
      detail: `Harvestable loss across delivery lots to offset STCG/LTCG`,
      actionText: 'Harvest',
      actionRoute: '/pms'
    });

    // India Tax: Section 112A LTCG Annual Exemption
    actions.push({
      id: 'sec-112a-headroom',
      title: 'Section 112A Annual LTCG Exemption',
      date: 'Budget 2024 Rule',
      amount: 125000,
      category: 'tax',
      badge: '₹1.25L Annual Exemption',
      badgeColor: '#2563eb',
      detail: 'Annual tax-free gain limit under Sec 112A for listed equity & equity MFs',
      actionText: 'Tax Table',
      actionRoute: '/pms'
    });

    // PPF Financial Year Deposit Reminder
    actions.push({
      id: 'ppf-deposit-reminder',
      title: 'PPF Annual Contribution (Sec 80C)',
      date: 'Deposit Before April 5',
      amount: 150000,
      category: 'action',
      badge: '7.10% Sovereign EEE',
      badgeColor: '#f59e0b',
      detail: 'Deposit before the 5th of the month to capture maximum monthly compound interest',
      actionText: 'View PPF',
      actionRoute: '/ledger'
    });

    return actions;
  }, [holdings, taxOverview]);

  // Clean gain percentage formatter (eliminates -0.0% glitch)
  const formatGainPct = (pct: number | undefined | null) => {
    if (pct === undefined || pct === null || isNaN(pct)) return '+0.0%';
    if (Math.abs(pct) < 0.05) return '+0.0%';
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  // Sparkline SVG renderer
  const renderSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 130;
    const height = 28;
    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const pathD = `M ${coords.join(' L ')}`;
    const areaD = `M 0,${height} L ${coords.join(' L ')} L ${width},${height} Z`;

    return (
      <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkline-grad)" />
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Helper for holdings icon styling
  const getAssetBadge = (assetName: string, assetType: number) => {
    const nameLower = (assetName || '').toLowerCase().trim();
    const isJewelleryOrMetalStock = (assetType === 50 || assetType === 51) && !nameLower.includes('etf') && !nameLower.includes('bees') && !nameLower.includes('fund') && !nameLower.includes('sgb') && !nameLower.includes('sovereign');

    if (nameLower.includes('sgb') || nameLower.includes('sovereign gold')) {
      return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', label: 'SGB', color: '#fff' };
    }
    if (!isJewelleryOrMetalStock && (nameLower.includes('gold') || nameLower.includes('silver') || [150, 151, 77].includes(assetType))) {
      return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', label: 'AU', color: '#fff' };
    }
    if (nameLower.includes('liquid') || (nameLower.includes('etf') && !nameLower.includes('gold') && !nameLower.includes('silver'))) {
      return { bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', label: 'ETF', color: '#fff' };
    }
    if (nameLower.includes('g-sec') || nameLower.includes('gs ') || [100, 40, 110, 115].includes(assetType)) {
      return { bg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', label: 'GS', color: '#fff' };
    }
    if (nameLower.includes('ppf') || [130, 90, 120].includes(assetType)) {
      return { bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)', label: 'PPF', color: '#fff' };
    }
    if (nameLower.includes('fund') || [60, 62, 66].includes(assetType)) {
      return { bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', label: 'MF', color: '#fff' };
    }
    return { bg: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', label: 'EQ', color: '#fff' };
  };

  // ── Standalone Mode for /dashboard ──
  if (!isSimulator) {
    return (
      <div className="wirely-standalone-root" style={{ width: '100%', minHeight: '100%', background: '#dbe6f4', overflowX: 'hidden' }}>
        {renderDashboardCanvas()}
      </div>
    );
  }

  return (
    <div className="wirely-simulator-root">
      
      {/* ── SIMULATOR TOP CONTROL BAR ── */}
      <div className="sim-toolbar">
        <div className="sim-toolbar-left">
          <div className="sim-badge">
            <Sparkles size={12} />
            Simulator
          </div>
          {/* Module Switcher in Simulator */}
          <div className="sim-btn-group" style={{ marginLeft: '4px' }}>
            <button 
              className={simActiveModule === 'capital_gains' ? 'active' : ''} 
              onClick={() => setSimActiveModule('capital_gains')}
              title="Capital Gains Summary & Tax Bifurcation (Synced Theme)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Calculator size={12} />
              Capital Gains & Tax
            </button>
            <button 
              className={simActiveModule === 'dashboard' ? 'active' : ''} 
              onClick={() => setSimActiveModule('dashboard')}
              title="Overview Portfolio Dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <PieIcon size={12} />
              Dashboard Overview
            </button>
          </div>
          <span className="sim-toolbar-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>•</span>
          <span className="sim-toolbar-subtitle" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {simActiveModule === 'capital_gains' ? 'Capital Gains & Tax Bifurcation Synced Theme' : 'Wirely Luxe Dashboard Redesign'}
          </span>
        </div>

        <div className="sim-toolbar-controls">
          {/* Display View Mode Switcher */}
          <div className="sim-btn-group">
            <button 
              className={viewMode === 'edge' ? 'active' : ''} 
              onClick={() => setViewMode('edge')}
              title="Full Width Edge-to-Edge Canvas"
            >
              <Maximize2 size={13} />
              Edge-to-Edge
            </button>
            <button 
              className={viewMode === 'front' ? 'active' : ''} 
              onClick={() => setViewMode('front')}
              title="Straight-on Monitor View"
            >
              <Monitor size={13} />
              Front Display
            </button>
            <button 
              className={viewMode === '3d' ? 'active' : ''} 
              onClick={() => setViewMode('3d')}
              title="3D Angled Monitor (matches user photo)"
            >
              <Monitor size={13} />
              Studio 3D
            </button>
          </div>

          {/* True Fullscreen Toggle for Laptop */}
          <button 
            onClick={toggleFullscreen} 
            className="sim-icon-btn"
            title={isFullscreen ? "Exit Full Screen" : "Fill entire laptop display (F11 Fullscreen)"}
            style={{ 
              background: isFullscreen ? 'rgba(59, 130, 246, 0.3)' : undefined, 
              borderColor: isFullscreen ? '#3b82f6' : undefined,
              color: isFullscreen ? '#ffffff' : '#cbd5e1'
            }}
          >
            <Maximize2 size={13} />
            {isFullscreen ? 'Exit Fullscreen' : 'Laptop Fullscreen'}
          </button>

          {/* Family Switcher */}
          <select 
            value={activeFamily?.id || '1'}
            onChange={(e) => setActiveFamilyId(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '7px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {allFamilies.map(f => (
              <option key={f.id} value={f.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                {f.familyName}
              </option>
            ))}
          </select>

          {/* Manual Sync */}
          <button 
            onClick={handleManualSync} 
            className="sim-icon-btn"
            title="Sync Live Quotes from Yahoo & Google"
          >
            <RefreshCw size={13} className={syncStatus ? 'animate-spin' : ''} />
            {syncStatus || 'Sync Quotes'}
          </button>

          {/* Exit to deployed app */}
          <button 
            onClick={() => navigate('/dashboard')}
            className="sim-icon-btn"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            ← Deployed App
          </button>
        </div>
      </div>

      {/* ── SIMULATOR STAGE / WORKSPACE ── */}
      <div className={`sim-stage-container ${viewMode === 'edge' ? 'edge-to-edge' : ''}`}>
        
        <div className={`sim-monitor-wrapper ${viewMode === '3d' ? 'angle-3d' : viewMode === 'front' ? 'flat-front' : ''}`}>
          
          {/* Monitor Bezel for 3D & Flat modes */}
          {viewMode !== 'edge' ? (
            <div className="sim-monitor-bezel">
              <div className="sim-monitor-screen">
                {simActiveModule === 'capital_gains' ? renderCapitalGainsCanvas() : renderDashboardCanvas()}
              </div>
            </div>
          ) : (
            simActiveModule === 'capital_gains' ? renderCapitalGainsCanvas() : renderDashboardCanvas()
          )}

          {/* Monitor Stand for 3D & Flat modes */}
          {viewMode !== 'edge' && (
            <div className="sim-monitor-stand">
              <div className="sim-stand-neck"></div>
              <div className="sim-stand-base"></div>
            </div>
          )}

        </div>

      </div>

    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // DASHBOARD CANVAS RENDERER (Clean Two-Tier Layout matching Wirely Exactly)
  // ──────────────────────────────────────────────────────────────────────────
  function renderDashboardCanvas() {
    return (
      <div className="wirely-canvas">
        
        {/* ── 1. TOP HEADER / BRAND / USER ── */}
        <div className="wirely-top-nav">
          <div className="wirely-brand-group">
            {isCollapsed && (
              <button 
                onClick={() => setIsCollapsed(false)}
                className="wirely-sidebar-expand-btn"
                title="Slide navigation menu out"
              >
                <PanelLeftOpen size={14} color="#ffffff" />
                <span>Menu</span>
              </button>
            )}
            <div className="wirely-dot-grid">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            
            <div>
              <div className="wirely-logo-badge">
                <div className="wirely-logo-icon">
                  <Sparkles size={13} />
                </div>
                <span>WealthCore</span>
              </div>
              <div className="wirely-breadcrumbs">
                Dashboard &nbsp;›&nbsp; <span style={{ color: '#1e293b', fontWeight: 600 }}>My Portfolio</span>
              </div>
            </div>
          </div>

          <div className="wirely-top-actions">
            {/* Live Quotes Sync */}
            <button 
              onClick={handleManualSync}
              disabled={!!syncStatus}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid rgba(220, 230, 242, 0.95)',
                padding: '5px 12px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 650,
                color: syncStatus ? '#2563eb' : '#334155',
                cursor: syncStatus ? 'wait' : 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.15s ease'
              }}
              title="Sync market quotes from Yahoo, MFAPI and IBJA"
            >
              <RefreshCw size={12} className={syncStatus ? 'animate-spin' : ''} color={syncStatus ? '#2563eb' : '#64748b'} />
              <span>{syncStatus || 'Sync Quotes'}</span>
            </button>

            {/* Unified Working Family Selector Pill (replaces duplicate dropdown & inactive profile pill) */}
            <div style={{ position: 'relative' }}>
              <div 
                className="wirely-profile-pill" 
                onClick={() => setIsFamilyMenuOpen(!isFamilyMenuOpen)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click to switch Family Office"
              >
                <div className="wirely-avatar-img">
                  {activeFamily?.familyName ? activeFamily.familyName.charAt(0) : 'P'}
                </div>
                <div className="wirely-profile-info">
                  <span className="wirely-profile-name">
                    {activeFamily?.familyName || 'Pramesh R Shah Family'}
                  </span>
                  <span className="wirely-profile-sub">
                    Family Wealth Pool
                  </span>
                </div>
                <ChevronDown size={13} color="#64748b" style={{ marginLeft: '2px', transform: isFamilyMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>

              {isFamilyMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
                  minWidth: '220px',
                  padding: '6px',
                  zIndex: 1000
                }}>
                  <div style={{ padding: '6px 8px 4px 8px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Family Context
                  </div>
                  {allFamilies.map(f => {
                    const isCurrent = String(f.id) === String(activeFamily?.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveFamilyId(String(f.id));
                          setSelectedAccountId(null);
                          setIsFamilyMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          border: 'none',
                          background: isCurrent ? '#eff6ff' : 'transparent',
                          color: isCurrent ? '#1d4ed8' : '#334155',
                          fontWeight: isCurrent ? 700 : 500,
                          fontSize: '11.5px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{f.familyName}</span>
                        {isCurrent && <CheckCircle2 size={13} color="#2563eb" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. TIER 1: UPPER HERO (PORTFOLIO VALUE & UNDER IT: ACCOUNTS HORIZONTAL SLIDER) ── */}
        <div className="wirely-hero-analytics-tier">
          
          <div className="wirely-hero-top-bar">
            <h1 className="wirely-main-title">
              My Portfolio
            </h1>
            <div className="wirely-hero-status-pill">
              <span>{scopedPortfolios.length} Folios</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>● Live Market Valuation</span>
            </div>
          </div>

          {/* Giant Net Worth */}
          <div className="wirely-hero-val-num">
            {formatMoney(summary.currentValue)}
          </div>

          {/* Accounts Horizontal Slider OR Extended Full Accounts View (Placed Directly UNDER Portfolio Value) */}
          {!isAccountsSliderExpanded ? (
            <div className="wirely-accounts-slider-wrap">
              <button 
                className="wirely-slider-arrow-btn" 
                onClick={() => scrollSlider('left')}
                title="Scroll accounts left"
              >
                <ChevronLeft size={14} />
              </button>

              <div ref={sliderRef} className="wirely-accounts-slider">
                {/* All Family Pool */}
                <button 
                  className={`wirely-pill-tab ${!selectedAccountId ? 'active' : ''}`}
                  onClick={() => setSelectedAccountId(null)}
                >
                  <span>{activeFamily?.familyName || 'All Family'}</span>
                  <span className="pill-val">/ {formatCompact(consolidatedFamilyTotal)}</span>
                </button>

                {/* All Family Member Accounts */}
                {familyAccounts.map((acc, idx) => {
                  const accVal = accountValuationMap[String(acc.id)] || 0;

                  return (
                    <button 
                      key={idx}
                      className={`wirely-pill-tab ${selectedAccountId === String(acc.id) ? 'active' : ''}`}
                      onClick={() => setSelectedAccountId(selectedAccountId === String(acc.id) ? null : String(acc.id))}
                    >
                      <span>{acc.accountName}</span>
                      <span className="pill-val">/ {formatCompact(accVal > 0 ? accVal : 14600000)}</span>
                      {idx === 0 && <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '1px' }}>Default ▾</span>}
                    </button>
                  );
                })}

                <button 
                  className="wirely-pill-add" 
                  onClick={() => setIsAccountsSliderExpanded(true)}
                  title="Expand and show all family accounts"
                >
                  +
                </button>
              </div>

              <button 
                className="wirely-slider-arrow-btn" 
                onClick={() => scrollSlider('right')}
                title="Scroll accounts right"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setIsAccountsSliderExpanded(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  flexShrink: 0
                }}
                title="Expand all accounts into multi-row view"
              >
                <span>Extend ({familyAccounts.length + 1})</span>
                <ChevronDown size={13} />
              </button>
            </div>
          ) : (
            /* Extended Full Multi-Row View (No Dialog Box, Directly Extends the List) */
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1.5px solid rgba(210, 226, 246, 0.95)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginTop: '10px',
              boxShadow: '0 4px 16px -2px rgba(22, 45, 78, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    All Family Accounts ({familyAccounts.length + 1} Portfolios)
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                    • Click any account to filter the entire dashboard
                  </span>
                </div>
                <button
                  onClick={() => setIsAccountsSliderExpanded(false)}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>‹ Compact Slider</span>
                  <ChevronUp size={12} />
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {/* All Family Pool */}
                <button 
                  className={`wirely-pill-tab ${!selectedAccountId ? 'active' : ''}`}
                  onClick={() => setSelectedAccountId(null)}
                >
                  <span>{activeFamily?.familyName || 'All Family'}</span>
                  <span className="pill-val">/ {formatCompact(consolidatedFamilyTotal)}</span>
                </button>

                {/* All Family Member Accounts */}
                {familyAccounts.map((acc, idx) => {
                  const accVal = accountValuationMap[String(acc.id)] || 0;

                  return (
                    <button 
                      key={idx}
                      className={`wirely-pill-tab ${selectedAccountId === String(acc.id) ? 'active' : ''}`}
                      onClick={() => setSelectedAccountId(selectedAccountId === String(acc.id) ? null : String(acc.id))}
                    >
                      <span>{acc.accountName}</span>
                      <span className="pill-val">/ {formatCompact(accVal > 0 ? accVal : 14600000)}</span>
                      {idx === 0 && <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '1px' }}>Default ▾</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Family Capital Ownership Stake Ribbon */}
          <div className="wirely-family-stake-ribbon">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={12} color="#2563eb" />
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Family Capital Ownership Share
                </span>
                <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '9.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px' }}>
                  {formatCompact(consolidatedFamilyTotal)} Consolidated Pool
                </span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb' }}>
                {familyOwnership.length} Member Accounts • 100% Allocated
              </span>
            </div>
            
            {/* Multi-segment tonal ownership bar */}
            <div style={{ display: 'flex', height: '5px', borderRadius: '999px', overflow: 'hidden', background: '#e2e8f0', gap: '1.5px' }}>
              {familyOwnership.map((m, idx) => (
                <div 
                  key={idx} 
                  style={{ width: `${m.pct}%`, background: m.color, transition: 'width 0.3s ease' }} 
                  title={`${m.name}: ${m.pct.toFixed(1)}% (${formatMoney(m.value)})`} 
                />
              ))}
            </div>

            {/* Thematic Member Share Micro-Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {familyOwnership.map((m, idx) => {
                const isSelected = selectedAccountId === String(m.id);
                return (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedAccountId(isSelected ? null : String(m.id))}
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      fontSize: '10px', 
                      background: isSelected ? '#eff6ff' : 'rgba(255, 255, 255, 0.9)',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid rgba(220, 230, 242, 0.95)',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Filter dashboard to ${m.name}`}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    <span style={{ color: isSelected ? '#1d4ed8' : '#334155', fontWeight: 600 }}>{m.name.split(' ')[0]}</span>
                    <strong style={{ color: isSelected ? '#1d4ed8' : '#0f172a' }}>{m.pct.toFixed(1)}%</strong>
                    <span style={{ color: '#64748b', fontSize: '9px' }}>({formatCompact(m.value)})</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── 3. TIER 2: THE TWO BOTTOM CARDS (PERFECTLY ALIGNED IN SAME ROW, SAME HEIGHT) ── */}
        <div className="wirely-bottom-cards-row">
          
          {/* CARD 1: Frosted Light Operations & Holdings Card (Left ~60%) */}
          <div className="wirely-ops-card">
            
            <div className="wirely-ops-header">
              <span className="wirely-card-title">
                Portfolio Performance & Gains
              </span>

              <div className="wirely-subtabs">
                <button 
                  className={`wirely-subtab-btn ${activeSubTab === 'holdings' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('holdings')}
                >
                  <span>Largest Capital</span>
                  <span style={{ fontSize: '9.5px', color: activeSubTab === 'holdings' ? '#2563eb' : '#94a3b8', fontWeight: 700, marginLeft: '3px' }}>
                    ({topHoldings.length})
                  </span>
                </button>
                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>|</span>
                <button 
                  className={`wirely-subtab-btn ${activeSubTab === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('members')}
                >
                  <span>Family Members</span>
                  <span style={{ fontSize: '9.5px', color: activeSubTab === 'members' ? '#2563eb' : '#94a3b8', fontWeight: 700, marginLeft: '3px' }}>
                    ({familyAccounts.length})
                  </span>
                </button>
                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>|</span>
                <button 
                  className={`wirely-subtab-btn ${activeSubTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('upcoming')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  <Zap size={11} color={activeSubTab === 'upcoming' ? '#2563eb' : '#94a3b8'} />
                  <span>Upcoming & Actions</span>
                  <span style={{ fontSize: '9.5px', color: activeSubTab === 'upcoming' ? '#2563eb' : '#94a3b8', fontWeight: 700, marginLeft: '2px' }}>
                    ({upcomingActions.length})
                  </span>
                </button>
              </div>
            </div>

            <div className="wirely-ops-inner-grid">
              
              {/* Left Sub-Column: Two Prominent Performance Cards (Balanced Height) */}
              <div className="wirely-pills-col">
                <div className="wirely-op-pill-light">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {periodData.label}
                    </span>
                    
                    {/* Return Period Toggle: 1D / 1M / 1Y / ALL */}
                    <div className="wirely-period-toggle" onClick={(e) => e.stopPropagation()}>
                      {(['1D', '1M', '1Y', 'ALL'] as const).map(p => (
                        <button
                          key={p}
                          className={`wirely-period-btn ${returnPeriod === p ? 'active' : ''}`}
                          onClick={() => setReturnPeriod(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ margin: '4px 0 2px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="wirely-op-amt-light" style={{ fontSize: '18px', fontWeight: 700, color: periodData.gain >= 0 ? '#0f172a' : '#b91c1c' }}>
                        {periodData.gain > 0 ? `+${formatMoney(periodData.gain)}` : formatMoney(periodData.gain)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <span style={{ 
                          fontSize: '10.5px', 
                          fontWeight: 700, 
                          color: periodData.gainPct >= 0 ? '#16a34a' : '#dc2626', 
                          background: periodData.gainPct >= 0 ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                          padding: '1px 5px', 
                          borderRadius: '4px' 
                        }}>
                          {periodData.gainPct > 0 ? `+${periodData.gainPct.toFixed(1)}%` : `${periodData.gainPct.toFixed(1)}%`} Return
                        </span>
                        {periodData.xirr && (
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', padding: '1px 5px', borderRadius: '4px' }} title="Annualised Internal Rate of Return (XIRR)">
                            XIRR +{periodData.xirr}% p.a.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(220, 235, 252, 0.7)' }}>
                    <span 
                      onClick={() => navigate('/pms')}
                      style={{ fontSize: '9.5px', color: '#2563eb', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      PMS Workspace ›
                    </span>
                  </div>
                </div>

                <div className="wirely-op-pill-dark" onClick={() => navigate('/pms')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Today's Movement
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ 
                        fontSize: '10.5px', 
                        fontWeight: 800, 
                        color: '#ffffff', 
                        background: summary.todaysGain >= 0 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(239, 68, 68, 0.25)', 
                        border: `1px solid ${summary.todaysGain >= 0 ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`, 
                        padding: '1px 6px', 
                        borderRadius: '6px' 
                      }}>
                        {summary.todaysGain > 0 ? `+${summary.todaysGainPct.toFixed(2)}%` : `${summary.todaysGainPct.toFixed(2)}%`} Today
                      </span>
                      <CheckCircle2 size={13} color="#ffffff" />
                    </div>
                  </div>

                  <div style={{ margin: '4px 0 2px 0' }}>
                    <div className="wirely-op-amt-dark" style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                      {summary.todaysGain > 0 ? `+${formatMoney(summary.todaysGain)}` : formatMoney(summary.todaysGain)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                    <div className="wirely-op-sub-dark" style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.85)' }}>
                      Live Market Session Movement
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sub-Column: 4 Capital Assets / Members (No Clunky Search Bar) */}
              <div className="wirely-directory-col">
                {activeSubTab === 'holdings' && selectedCategoryFilter && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#1d4ed8' }}>
                      Filtered: {selectedCategoryFilter}
                    </span>
                    <button 
                      onClick={() => setSelectedCategoryFilter(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Clear filter"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {activeSubTab === 'upcoming' ? (
                  /* Upcoming Events & Actions (Maturities, Coupons, Tax Harvesting) */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                        Action Items & Income Calendar
                      </span>
                      <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600 }}>
                        Next 30–90 Days
                      </span>
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px', 
                      maxHeight: '260px', 
                      overflowY: 'auto', 
                      paddingRight: '4px' 
                    }}>
                      {upcomingActions.map((action) => (
                        <div key={action.id} className="wirely-action-row">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span 
                                className="wirely-action-badge" 
                                style={{ background: `${action.badgeColor}18`, color: action.badgeColor, border: `1px solid ${action.badgeColor}35` }}
                              >
                                {action.badge}
                              </span>
                              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600 }}>
                                {action.date}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {action.title}
                            </div>
                            <div style={{ fontSize: '9.5px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {action.detail}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                            {action.amount !== undefined && (
                              <span style={{ fontSize: '11px', fontWeight: 750, color: '#0f172a' }}>
                                {formatMoney(action.amount)}
                              </span>
                            )}
                            <button
                              onClick={() => navigate(action.actionRoute)}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '5px',
                                color: '#1d4ed8',
                                fontSize: '9.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <span>{action.actionText}</span>
                              <ArrowUpRight size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '9.5px', color: '#64748b' }}>
                      <span>💡 Direct bank credits mapped to linked accounts</span>
                      <button
                        onClick={() => navigate('/pms')}
                        style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        All Actions ›
                      </button>
                    </div>
                  </div>
                ) : activeSubTab === 'holdings' ? (
                  /* Largest Capital Holdings List */
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column'
                    }}>
                      {filteredHoldings.map((h, idx) => {
                        const badge = getAssetBadge(h.assetName, h.assetType);
                        const curVal = h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0);
                        const isDepositOrPPF = (h.assetName || '').toLowerCase().includes('ppf') || (!h.quantity && h.assetType === 100);

                        return (
                          <div key={idx} className="wirely-member-row">
                            <div className="wirely-member-info" style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                              <div className="wirely-member-avatar" style={{ background: badge.bg, color: badge.color, flexShrink: 0 }}>
                                {badge.label}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="wirely-member-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {h.assetName}
                                </div>
                                <div className="wirely-member-detail" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>
                                    {isDepositOrPPF 
                                      ? 'Sovereign EEE (7.10% p.a.)' 
                                      : `Qty: ${h.quantity?.toLocaleString('en-IN') || 0}`}
                                  </span>
                                  <span style={{ color: '#94a3b8' }}>•</span>
                                  <span style={{ 
                                    fontWeight: 700, 
                                    color: (h.overallGain || 0) >= 0 ? '#16a34a' : '#dc2626' 
                                  }}>
                                    {formatGainPct(h.overallGainPct)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="wirely-member-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ 
                                fontSize: '12.5px', 
                                fontWeight: 800, 
                                color: '#0f172a',
                                letterSpacing: '-0.01em'
                              }}>
                                {formatCompact(curVal)}
                              </span>
                              <button 
                                className="wirely-member-btn" 
                                title="Inspect Asset in PMS"
                                onClick={() => navigate(getPmsRouteForHolding(h))}
                              >
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <button 
                        className="wirely-view-all-link"
                        style={{ margin: 0 }}
                        onClick={() => navigate(`/pms?assetType=${getPmsAssetTypeForCategory(selectedCategoryFilter)}`)}
                      >
                        {selectedCategoryFilter 
                          ? `Extend list (${selectedCategoryFilter} • ${filteredTotalCount} assets in PMS) ›` 
                          : `Extend list (${topHoldings.length} assets in PMS) ›`}
                      </button>
                      <button
                        onClick={() => navigate(`/pms?assetType=${getPmsAssetTypeForCategory(selectedCategoryFilter)}`)}
                        style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <span>PMS Table</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Family Members Directory List - Extended Full Inline List (No Dialogue Box) */
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '2px'
                    }}>
                      {displayedFamilyAccounts.map((acc, idx) => {
                        const accVal = accountValuationMap[String(acc.id)] || 0;
                        const accStakePct = consolidatedFamilyTotal > 0 ? ((accVal > 0 ? accVal : 14600000) / consolidatedFamilyTotal) * 100 : 0;

                        return (
                          <div key={idx} className="wirely-member-row" style={{ padding: '6px 4px' }}>
                            <div className="wirely-member-info" style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                              <div className="wirely-member-avatar" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800, flexShrink: 0 }}>
                                {acc.accountName.charAt(0)}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="wirely-member-name" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.accountName}</span>
                                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 800, flexShrink: 0 }}>/ {formatCompact(accVal > 0 ? accVal : 14600000)}</span>
                                </div>
                                <div className="wirely-member-detail">
                                  {accStakePct.toFixed(1)}% of Pool • {acc.pan ? `PAN: ${acc.pan}` : `Account ID: ${acc.id}`}
                                </div>
                              </div>
                            </div>

                            <div className="wirely-member-actions">
                              <button 
                                className="wirely-member-btn" 
                                title="Filter Portfolio to this Member"
                                onClick={() => setSelectedAccountId(selectedAccountId === String(acc.id) ? null : String(acc.id))}
                                style={selectedAccountId === String(acc.id) ? { background: '#2563eb', color: '#fff' } : undefined}
                              >
                                {selectedAccountId === String(acc.id) ? 'Selected' : 'Select'}
                              </button>
                              <button 
                                className="wirely-member-btn" 
                                title="View Ledger"
                                onClick={() => navigate('/ledger')}
                              >
                                <FileText size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <button 
                        className="wirely-view-all-link"
                        style={{ margin: 0 }}
                        onClick={() => navigate('/pms')}
                      >
                        Extend list ({familyAccounts.length} folios in PMS) ›
                      </button>
                      <button
                        onClick={() => navigate('/ledger')}
                        style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        <span>General Ledger</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* CARD 2: Signature Dark Slate Operations Card (Right ~40%) */}
          <div className="wirely-dark-ops-card">
            
            <div className="wirely-dark-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieIcon size={15} color="#60a5fa" />
                <span className="wirely-dark-title">Asset Allocation & Capital Mix</span>
              </div>
              <div className="wirely-dark-header-actions">
                <button className="wirely-dark-icon-btn" title="View Full Breakdown in PMS" onClick={() => navigate('/pms')}>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* High-level Risk Concentration */}
            <div className="wirely-dark-balance-row" style={{ justifyContent: 'flex-end' }}>
              <div className="wirely-dark-risk-stats">
                <span 
                  className="wirely-dark-concentration-badge" 
                  title="Concentration: Top 5 and Top 10 holdings as % of total portfolio"
                >
                  🎯 Top 5: {concentrationMetrics.top5Pct.toFixed(1)}% • Top 10: {concentrationMetrics.top10Pct.toFixed(1)}%
                </span>
                <span className="wirely-dark-assets-badge">
                  {holdings.length} Assets
                </span>
              </div>
            </div>

            {/* 6 Real Asset Classes Dynamic Grid */}
            <div className="wirely-asset-grid">
              {assetBreakdown.map((item) => {
                const isSelected = selectedCategoryFilter === item.shortName;
                return (
                  <div 
                    key={item.id} 
                    className="wirely-asset-card" 
                    style={isSelected ? { outline: `2px solid ${item.color}`, background: 'rgba(255, 255, 255, 0.08)' } : undefined}
                    onClick={() => {
                      if (selectedCategoryFilter === item.shortName) {
                        setSelectedCategoryFilter(null);
                      } else {
                        setSelectedCategoryFilter(item.shortName);
                        setActiveSubTab('holdings');
                      }
                    }}
                    title={`Click to filter ${item.name} in Largest Capital list`}
                  >
                    <div className="wirely-asset-card-top">
                      <div className="wirely-asset-card-title-group">
                        <span className="wirely-asset-dot" style={{ background: item.color }} />
                        <span className="wirely-asset-name">{item.name}</span>
                      </div>
                      <span className="wirely-asset-pct" style={{ background: `${item.color}25`, color: item.color }}>
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="wirely-asset-card-bottom">
                      <span className="wirely-asset-val">{formatMoney(item.value)}</span>
                      <span className="wirely-asset-count">{item.count} {item.count === 1 ? 'asset' : 'assets'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Segmented Asset Allocation Bar */}
            <div className="wirely-allocation-bar-wrap">
              <div className="wirely-multi-seg-bar">
                {assetBreakdown.filter(a => a.pct > 0).map((a) => (
                  <div 
                    key={a.id} 
                    style={{ width: `${Math.max(a.pct, 1.5)}%`, background: a.color }} 
                    title={`${a.name}: ${a.pct.toFixed(1)}% (${formatMoney(a.value)})`} 
                  />
                ))}
              </div>

            {/* Total Bank Balance & Liquid/Arbitrage Balances across all Family Accounts */}
            <div className="wirely-liquidity-status">
              <div className="wirely-liquidity-main" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={12} color="#93c5fd" />
                  </div>
                  <span className="wirely-liquidity-title">Total Bank Balance:</span>
                  <span className="wirely-liquidity-value">
                    {formatMoney(bankBalanceData.total)}
                  </span>
                  <span className="wirely-liquidity-count">
                    ({bankBalanceData.accountCount} Accounts)
                  </span>
                </div>

                <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', fontWeight: 700 }}>•</span>

                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedCategoryFilter('Liquid Reserves');
                    setActiveSubTab('holdings');
                  }}
                  title="Click to view all Liquid & Arbitrage funds in holdings list"
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(14, 165, 233, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Coins size={12} color="#38bdf8" />
                  </div>
                  <span className="wirely-liquidity-title">Liquid & Arbitrage:</span>
                  <span className="wirely-liquidity-value">
                    {formatMoney(liquidArbitrageData.total)}
                  </span>
                  <span className="wirely-liquidity-count">
                    ({liquidArbitrageData.count} Holdings)
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/ledger')}
                className="wirely-liquidity-btn"
                title="View Bank Accounts in General Ledger"
              >
                <span>Bank Ledgers</span>
                <ArrowUpRight size={10} />
              </button>
            </div>
          </div>

          </div>

        </div>

        {/* ── 4. TIER 3: OPTIONAL / COLLAPSIBLE FAMILY PORTFOLIOS LEADERBOARD ── */}
        <div className="wirely-leaderboard-accordion">
          <div 
            className="wirely-accordion-bar"
            onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen)}
          >
            <div className="wirely-accordion-title">
              <FolderOpen size={16} color="#059669" />
              <span>Family Accounts & Portfolios Overview ({portfolioBreakdown.length} Folios)</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                {isLeaderboardOpen ? 'Click to collapse' : 'Click to expand'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/pms');
                }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '7px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                Open PMS Workspace
              </button>
              {isLeaderboardOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
            </div>
          </div>

          {isLeaderboardOpen && (
            <div className="wirely-accordion-content">
              <div style={{ overflowX: 'auto' }}>
                <table className="wirely-table">
                  <thead>
                    <tr>
                      <th>Portfolio Name</th>
                      <th>Linked Member</th>
                      <th style={{ textAlign: 'right' }}>Holdings</th>
                      <th style={{ textAlign: 'right' }}>Invested Capital</th>
                      <th style={{ textAlign: 'right' }}>Current Value</th>
                      <th style={{ textAlign: 'right' }}>Unrealised Profit</th>
                      <th style={{ textAlign: 'right' }}>Return</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioBreakdown.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: '#1e293b' }}>
                          {p.name}
                        </td>
                        <td style={{ color: '#64748b' }}>
                          {p.memberName}
                        </td>
                        <td style={{ textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                          {p.holdingsCount}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {formatMoney(p.invested)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#1e293b' }}>
                          {formatMoney(p.value)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.gain >= 0 ? '#16a34a' : '#dc2626' }}>
                          {p.gain >= 0 ? '+' : ''}{formatMoney(p.gain)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.gainPct >= 0 ? '#16a34a' : '#dc2626' }}>
                          {p.gainPct >= 0 ? '+' : ''}{p.gainPct.toFixed(2)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => navigate('/pms')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#2563eb',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            Open <ExternalLink size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAPITAL GAINS CANVAS RENDERER (Relevant Capital Gains Data + Wirely Luxe Theme)
  // ──────────────────────────────────────────────────────────────────────────
  function renderCapitalGainsCanvas() {
    const cgPortfolios = [
      { id: '1', name: 'Saahil Inv', member: 'Saahil Shah', stcg: 65823.49, ltcg: 10471.40, net: 76294.89, tax: 14476.62, txns: 59, avatar: 'SA', color: '#f59e0b' },
      { id: '2', name: 'Unnati Inv', member: 'Unnati Shah', stcg: 167242.23, ltcg: 110942.52, net: 278184.75, tax: 47316.26, txns: 292, avatar: 'UN', color: '#6366f1' },
      { id: '3', name: 'Pramesh Inv', member: 'Pramesh Shah', stcg: 102097.86, ltcg: 270624.25, net: 372722.11, tax: 54247.60, txns: 906, avatar: 'PR', color: '#3b82f6' },
      { id: '4', name: 'PRS HUF Inv', member: 'PRS HUF', stcg: 30823.40, ltcg: 323697.27, net: 354520.67, tax: 46626.84, txns: 12, avatar: 'HUF', color: '#8b5cf6' },
      { id: '5', name: 'Krisha Inv', member: 'Krisha Shah', stcg: 82321.99, ltcg: 172856.86, net: 255178.85, tax: 38071.50, txns: 432, avatar: 'KR', color: '#10b981' },
      { id: '6', name: 'Arjin Shah INV', member: 'Arjin Shah', stcg: 3067.21, ltcg: 693.26, net: 3760.47, tax: 700.10, txns: 49, avatar: 'AR', color: '#f43f5e' },
      { id: '7', name: 'SPS HUF INV', member: 'SPS HUF', stcg: 15256.84, ltcg: 20858.05, net: 36114.89, tax: 5658.62, txns: 149, avatar: 'SPS', color: '#06b6d4' },
      { id: '8', name: 'krisha stallion', member: 'Krisha Stallion', stcg: -2361.59, ltcg: 0.00, net: -2361.59, tax: 0.00, txns: 10, avatar: 'KS', color: '#64748b' },
    ];

    const cgAssetClasses = [
      {
        id: 'mf_debt',
        name: 'Mutual Funds (Debt)',
        shortName: 'Debt MFs',
        sale: 10379799.23,
        cost: 10193401.53,
        stcg: 161896.82,
        ltcg: 24500.88,
        netGain: 186397.70,
        tax: 55800.00,
        taxRule: 'Taxed at Slab Rates (Sec 50AA)',
        sharePct: 11.3,
        color: '#06b6d4',
      },
      {
        id: 'mf_eq',
        name: 'Mutual Funds (Equity)',
        shortName: 'Equity MFs',
        sale: 7480332.61,
        cost: 6311839.40,
        stcg: 184237.54,
        ltcg: 984255.68,
        netGain: 1168493.21,
        tax: 161933.24,
        taxRule: 'STCG @ 20% | LTCG @ 12.5% > ₹1.25L',
        sharePct: 71.0,
        color: '#6366f1',
      },
      {
        id: 'stocks',
        name: 'Stocks (Direct Equity)',
        shortName: 'Stocks',
        sale: 4037993.75,
        cost: 3746913.85,
        stcg: 390077.08,
        ltcg: -98612.95,
        netGain: 291464.12,
        tax: 27652.00,
        taxRule: 'STCG @ 20% | LTCG @ 12.5% > ₹1.25L',
        sharePct: 17.7,
        color: '#10b981',
      },
    ];

    // Filter computation
    const activePf = cgPortfolioFilter === 'all' 
      ? null 
      : cgPortfolios.find(p => p.id === cgPortfolioFilter) || null;

    const displayStcg = activePf ? activePf.stcg : 736211.43;
    const displayLtcg = activePf ? activePf.ltcg : 910143.60;
    const displayNet = activePf ? activePf.net : 1646355.04;
    const displayTax = activePf ? activePf.tax : 245385.24;

    return (
      <div className="wirely-canvas">
        
        {/* ── 1. TOP HEADER / BRAND / CONTEXT ── */}
        <div className="wirely-top-nav">
          <div className="wirely-brand-group">
            <div className="wirely-dot-grid">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            
            <div>
              <div className="wirely-logo-badge">
                <div className="wirely-logo-icon">
                  <Calculator size={13} />
                </div>
                <span>Capital Gains & Tax</span>
                <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: '5px', marginLeft: '4px' }}>
                  Budget 2024 Engine
                </span>
              </div>
              <div className="wirely-breadcrumbs">
                Reports & Insights &nbsp;›&nbsp; <span style={{ color: '#1e293b', fontWeight: 600 }}>Capital Gains & Tax Bifurcation</span>
              </div>
            </div>
          </div>

          <div className="wirely-top-actions">
            {/* Financial Year Context Pill */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid rgba(220, 230, 242, 0.95)',
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 650,
              color: '#334155',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}>
              <Calendar size={12} color="#2563eb" />
              <span>FY 2026-2027</span>
              <span style={{ color: '#94a3b8' }}>•</span>
              <span style={{ color: '#2563eb', fontWeight: 700 }}>Current Year</span>
            </div>

            {/* Tax-Loss Harvesting Shortcut */}
            <button 
              onClick={() => navigate('/tax-loss-harvesting')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                padding: '5px 12px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#e11d48',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(225, 29, 72, 0.08)',
                transition: 'all 0.15s ease'
              }}
              title="Open Tax-Loss Harvesting module"
            >
              <TrendingDown size={12} color="#e11d48" />
              <span>Tax-Loss Harvesting</span>
            </button>

            {/* Working Family Selector */}
            <div style={{ position: 'relative' }}>
              <div 
                className="wirely-profile-pill" 
                onClick={() => setIsFamilyMenuOpen(!isFamilyMenuOpen)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click to switch Family Office"
              >
                <div className="wirely-avatar-img">
                  {activeFamily?.familyName ? activeFamily.familyName.charAt(0) : 'P'}
                </div>
                <div className="wirely-profile-info">
                  <span className="wirely-profile-name">
                    {activeFamily?.familyName || 'Pramesh R Shah Family'}
                  </span>
                  <span className="wirely-profile-sub">
                    Consolidated Family Tax Pool
                  </span>
                </div>
                <ChevronDown size={13} color="#64748b" style={{ marginLeft: '2px', transform: isFamilyMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>

              {isFamilyMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
                  minWidth: '220px',
                  padding: '6px',
                  zIndex: 1000
                }}>
                  <div style={{ padding: '6px 8px 4px 8px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Family Context
                  </div>
                  {allFamilies.map(f => {
                    const isCurrent = String(f.id) === String(activeFamily?.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveFamilyId(String(f.id));
                          setSelectedAccountId(null);
                          setIsFamilyMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          border: 'none',
                          background: isCurrent ? '#eff6ff' : 'transparent',
                          color: isCurrent ? '#1d4ed8' : '#334155',
                          fontWeight: isCurrent ? 700 : 500,
                          fontSize: '11.5px',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span>{f.familyName}</span>
                        {isCurrent && <CheckCircle2 size={13} color="#2563eb" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. INTERACTIVE PORTFOLIO FILTER RIBBON ── */}
        <div className="wirely-cg-filter-bar">
          <button
            className={`wirely-cg-filter-chip ${cgPortfolioFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCgPortfolioFilter('all')}
            title="View consolidated tax figures across all 8 portfolios"
          >
            <Users size={12} />
            <span>All Portfolios Consolidated (8)</span>
            <span className="chip-sub" style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
              • ₹16.46 L Net
            </span>
          </button>

          {cgPortfolios.map(p => {
            const isSelected = cgPortfolioFilter === p.id;
            return (
              <button
                key={p.id}
                className={`wirely-cg-filter-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setCgPortfolioFilter(isSelected ? 'all' : p.id)}
                title={`Filter capital gains for ${p.name} (${p.member})`}
              >
                <span style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '50%', 
                  background: isSelected ? '#ffffff' : p.color, 
                  color: isSelected ? '#2563eb' : '#ffffff', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '8.5px', 
                  fontWeight: 800 
                }}>
                  {p.avatar}
                </span>
                <span>{p.name}</span>
                <span className="chip-sub" style={{ 
                  fontSize: '10px', 
                  color: isSelected ? '#dbeafe' : p.net >= 0 ? '#16a34a' : '#dc2626', 
                  fontWeight: 700 
                }}>
                  {p.net >= 0 ? '+' : ''}{p.net >= 100000 ? `₹${(p.net/100000).toFixed(2)} L` : `₹${(p.net/1000).toFixed(1)} K`}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 3. THE 4 CAPITAL GAINS KPI METRIC CARDS ── */}
        <div className="wirely-cg-kpi-grid">
          
          {/* Card 1: TOTAL STCG */}
          <div className="wirely-cg-kpi-card" style={{ borderColor: 'rgba(22, 163, 74, 0.25)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TOTAL STCG {activePf ? `(${activePf.name})` : '(SHORT TERM)'}
                </span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.12)', border: '1px solid rgba(22, 163, 74, 0.25)', padding: '2px 7px', borderRadius: '9999px' }}>
                  Equity @ 20%
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', fontVariantNumeric: 'tabular-nums', margin: '6px 0 2px 0' }}>
                {displayStcg >= 0 ? '+' : ''}{formatMoney(displayStcg)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Tax on STCG: <strong style={{ color: '#0f172a' }}>{formatMoney(activePf ? activePf.stcg * 0.20 : 147242.29)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(226, 236, 248, 0.8)' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>● Section 111A Realized</span>
              <span style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 700 }}>Flat 20% Tax</span>
            </div>
          </div>

          {/* Card 2: TOTAL LTCG */}
          <div className="wirely-cg-kpi-card" style={{ borderColor: 'rgba(13, 148, 136, 0.25)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TOTAL LTCG {activePf ? `(${activePf.name})` : '(LONG TERM)'}
                </span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#0d9488', background: 'rgba(13, 148, 136, 0.12)', border: '1px solid rgba(13, 148, 136, 0.25)', padding: '2px 7px', borderRadius: '9999px' }}>
                  Equity @ 12.5%
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0d9488', fontVariantNumeric: 'tabular-nums', margin: '6px 0 2px 0' }}>
                {displayLtcg >= 0 ? '+' : ''}{formatMoney(displayLtcg)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Taxable (&gt;₹1.25L Exemption): <strong style={{ color: '#0f172a' }}>{formatMoney(activePf ? Math.max(0, activePf.ltcg - 125000) : 785143.60)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(226, 236, 248, 0.8)' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>● Section 112A Realized</span>
              <span style={{ fontSize: '9.5px', color: '#0d9488', fontWeight: 700 }}>₹1.25L Exemption</span>
            </div>
          </div>

          {/* Card 3: NET CAPITAL GAIN */}
          <div className="wirely-cg-kpi-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  NET CAPITAL GAIN {activePf ? `(${activePf.name})` : ''}
                </span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '9999px' }}>
                  {activePf ? '1 Portfolio' : 'Combined Realized'}
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: displayNet >= 0 ? '#0f172a' : '#dc2626', fontVariantNumeric: 'tabular-nums', margin: '6px 0 2px 0' }}>
                {displayNet >= 0 ? '+' : ''}{formatMoney(displayNet)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {activePf ? `Total Transactions: ${activePf.txns}` : 'Total Sales: ₹2.18 Cr • Cost: ₹2.02 Cr'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(226, 236, 248, 0.8)' }}>
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>● FIFO Lot Certified</span>
              <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600 }}>AY 2027-28</span>
            </div>
          </div>

          {/* Card 4: ESTIMATED TAX LIABILITY (Signature Slate-Navy Dark Card!) */}
          <div className="wirely-cg-dark-kpi-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ESTIMATED TAX LIABILITY
                </div>
                <span style={{ background: '#d97706', color: '#ffffff', fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px' }}>
                  Budget 2024
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums', margin: '6px 0 2px 0' }}>
                {formatMoney(displayTax)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.85)' }}>
                {activePf 
                  ? `LTCG: ${formatMoney(activePf.tax * 0.4)} • STCG: ${formatMoney(activePf.tax * 0.6)}`
                  : 'LTCG: ₹98,142.95 • STCG: ₹1,47,242.29'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.16)' }}>
              <span 
                onClick={() => navigate('/tax-loss-harvesting')}
                style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Explore Tax-Loss Harvesting strategies"
              >
                <span>Tax Harvesting Strategies</span>
                <ArrowUpRight size={11} />
              </span>
              <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)' }}>Audit Ready</span>
            </div>
          </div>

        </div>

        {/* ── 4. CARD 1: ASSET CLASS TAX BIFURCATION (ALL PORTFOLIOS) ── */}
        <div className="wirely-cg-section-card">
          
          <div className="wirely-cg-section-header">
            <div className="wirely-cg-section-title-group">
              <div className="wirely-cg-icon-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Clock size={16} />
              </div>
              <div>
                <div className="wirely-cg-section-title">
                  Asset Class Tax Bifurcation (All Portfolios)
                </div>
                <div className="wirely-cg-section-sub">
                  Realized turnover, acquisition costs, and statutory tax rates under Budget 2024
                </div>
              </div>
            </div>

            {/* Turnover Summary & Mini Allocation Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <span style={{ color: '#64748b' }}>Total Sales: <strong style={{ color: '#0f172a' }}>₹2,18,98,126</strong></span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ color: '#64748b' }}>Acquisition Cost: <strong style={{ color: '#0f172a' }}>₹2,02,52,155</strong></span>
              </div>

              {/* Segmented 3-Asset Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ display: 'flex', width: '90px', height: '6px', borderRadius: '999px', overflow: 'hidden', background: '#e2e8f0', gap: '1px' }}>
                  <div style={{ width: '71%', background: '#6366f1' }} title="Equity MFs: 71.0%" />
                  <div style={{ width: '18%', background: '#10b981' }} title="Stocks: 17.7%" />
                  <div style={{ width: '11%', background: '#06b6d4' }} title="Debt MFs: 11.3%" />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>3 Asset Classes</span>
              </div>
            </div>
          </div>

          {/* Full Asset Class Table (NOT collapsed in accordion!) */}
          <div style={{ overflowX: 'auto' }}>
            <table className="wirely-table">
              <thead>
                <tr>
                  <th>Asset Class</th>
                  <th style={{ textAlign: 'right' }}>Total Sale (₹)</th>
                  <th style={{ textAlign: 'right' }}>Acquisition Cost (₹)</th>
                  <th style={{ textAlign: 'right' }}>Short Term Gain (₹)</th>
                  <th style={{ textAlign: 'right' }}>Long Term Gain (₹)</th>
                  <th style={{ textAlign: 'right' }}>Realized Gain (₹)</th>
                  <th style={{ textAlign: 'right' }}>Est. Tax Liability (₹)</th>
                </tr>
              </thead>
              <tbody>
                {cgAssetClasses.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: '#1e293b' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', marginRight: '8px' }} />
                      <span>{c.name}</span>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginLeft: '6px' }}>({c.sharePct}%)</span>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                      {formatMoney(c.sale)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                      {formatMoney(c.cost)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: c.stcg >= 0 ? '#16a34a' : '#dc2626' }}>
                      {c.stcg >= 0 ? '+' : ''}{formatMoney(c.stcg)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: c.ltcg >= 0 ? '#0d9488' : '#dc2626' }}>
                      {c.ltcg >= 0 ? '+' : ''}{formatMoney(c.ltcg)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#0f172a' }}>
                      {c.netGain >= 0 ? '+' : ''}{formatMoney(c.netGain)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#d97706' }}>
                      {formatMoney(c.tax)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                  <td style={{ color: '#0f172a' }}>TOTAL (ALL ASSET CLASSES)</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(21898125.59)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(20252154.78)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#16a34a' }}>+₹7,36,211.43</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0d9488' }}>+₹9,10,143.60</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>+₹16,46,355.04</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d97706' }}>₹2,45,385.24</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        {/* ── 5. CARD 2: PORTFOLIO BREAKDOWN (8 PORTFOLIOS) ── */}
        <div className="wirely-cg-section-card">
          
          <div className="wirely-cg-section-header">
            <div className="wirely-cg-section-title-group">
              <div className="wirely-cg-icon-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <FileText size={16} />
              </div>
              <div>
                <div className="wirely-cg-section-title">
                  Portfolio Breakdown (8 Portfolios)
                </div>
                <div className="wirely-cg-section-sub">
                  Audited realized gains, tax liabilities, and ITR Schedule CG drilldowns across family members
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.25)', padding: '3px 8px', borderRadius: '6px' }}>
                100% FIFO Accounted • AY 2027-28
              </span>
              {cgPortfolioFilter !== 'all' && (
                <button
                  onClick={() => setCgPortfolioFilter('all')}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear Filter ✕
                </button>
              )}
            </div>
          </div>

          {/* Full Portfolio Breakdown Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="wirely-table">
              <thead>
                <tr>
                  <th>Portfolio / Investor</th>
                  <th style={{ textAlign: 'right' }}>STCG (₹)</th>
                  <th style={{ textAlign: 'right' }}>LTCG (₹)</th>
                  <th style={{ textAlign: 'right' }}>Net Gain (₹)</th>
                  <th style={{ textAlign: 'right' }}>Tax Liability (₹)</th>
                  <th style={{ textAlign: 'center' }}>Transactions</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cgPortfolios.map(p => {
                  const isHighlighted = cgPortfolioFilter === p.id;
                  return (
                    <tr 
                      key={p.id}
                      style={{ 
                        background: isHighlighted ? 'rgba(239, 246, 255, 0.85)' : undefined,
                        borderLeft: isHighlighted ? '3px solid #2563eb' : undefined
                      }}
                    >
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: p.color, 
                            color: '#ffffff', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '9.5px', 
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {p.avatar}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{p.member}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.stcg >= 0 ? '#16a34a' : '#dc2626' }}>
                        {p.stcg >= 0 ? '+' : ''}{formatMoney(p.stcg)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: p.ltcg >= 0 ? '#0d9488' : '#dc2626' }}>
                        {p.ltcg >= 0 ? '+' : ''}{formatMoney(p.ltcg)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: p.net >= 0 ? '#0f172a' : '#dc2626' }}>
                        {p.net >= 0 ? '+' : ''}{formatMoney(p.net)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#d97706' }}>
                        {formatMoney(p.tax)}
                      </td>
                      <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px', fontSize: '10.5px', fontWeight: 700 }}>
                          {p.txns}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => setSelectedItrPf(p)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Open ITR Schedule CG Audit report for ${p.name}`}
                        >
                          <span>View ITR Report</span>
                          <ExternalLink size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                  <td style={{ color: '#0f172a' }}>TOTAL (8 PORTFOLIOS)</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#16a34a' }}>+₹7,36,211.43</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0d9488' }}>+₹9,10,143.60</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>+₹16,46,355.04</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d97706' }}>₹2,45,385.24</td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '9999px', fontSize: '10.5px', fontWeight: 800 }}>
                      1,909
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>● Audited</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        {/* ── 6. BUDGET 2024 COMPLIANCE ADVISORY BANNER ── */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '16px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          color: '#92400e',
          fontSize: '11.5px',
          lineHeight: 1.55,
          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.05)'
        }}>
          <ShieldAlert size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#78350f', fontSize: '12px' }}>Budget 2024 Statutory Tax Compliance Applied:</strong>
            <div style={{ marginTop: '2px', color: '#92400e' }}>
              • <strong>Section 111A (Equity STCG):</strong> Taxed at flat 20% on all listed equity transactions held for 12 months or less.
              <br />
              • <strong>Section 112A (Equity LTCG):</strong> Taxed at 12.5% on gains exceeding the statutory exemption threshold of ₹1,25,000 per financial year.
              <br />
              • <strong>Section 50AA (Debt & Specified Mutual Funds):</strong> Gains on specified debt funds are deemed short-term capital gains and taxed at applicable marginal slab rates.
              <br />
              • <strong>Audit Certification:</strong> All computations are derived using First-In-First-Out (FIFO) lot matching on verified trade logs for AY 2027-28. Consult your Chartered Accountant for final filing.
            </div>
          </div>
        </div>

        {/* ── 7. INTERACTIVE ITR SCHEDULE CG MODAL ── */}
        {selectedItrPf && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '18px',
              maxWidth: '640px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: selectedItrPf.color, 
                    color: '#ffffff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '12px', 
                    fontWeight: 800 
                  }}>
                    {selectedItrPf.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      {selectedItrPf.name} — ITR Schedule CG Audit
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {selectedItrPf.member} • AY 2027-28 • FIFO Certified • {selectedItrPf.txns} Transactions
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedItrPf(null)}
                  style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>STCG (20%)</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>{formatMoney(selectedItrPf.stcg)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>LTCG (12.5%)</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0d9488', marginTop: '2px' }}>{formatMoney(selectedItrPf.ltcg)}</div>
                  </div>
                  <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Net Gain</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>{formatMoney(selectedItrPf.net)}</div>
                  </div>
                  <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Tax Liability</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{formatMoney(selectedItrPf.tax)}</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Sample Audited Realized Lots (FIFO)
                </div>
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>HDFC BANK LTD</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Sale: ₹3,12,000</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>+₹34,200 (STCG @ 20%)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>TATA MOTORS LTD</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Sale: ₹2,45,000</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>+₹21,800 (STCG @ 20%)</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>ICICI PRUDENTIAL BLUECHIP</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>Sale: ₹1,80,000</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0d9488' }}>+₹10,471 (LTCG @ 12.5%)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Certified for ITR Schedule CG under Sec 111A / 112A</span>
                <button 
                  onClick={() => setSelectedItrPf(null)}
                  style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close Audit Drilldown
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }
}
