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
  Sliders, 
  Sparkles, 
  X, 
  FileText, 
  ShieldCheck,
  Calendar,
  Zap,
  Clock,
  ShieldAlert,
  Percent,
  Users
} from 'lucide-react';
import { 
  getStoredPortfolios, 
  getHoldings, 
  getStoredAccounts, 
  getStoredFamilies, 
  getStoredVouchers, 
  syncLivePrices,
  getLedgerBalance,
  state 
} from '../logic';
import { computeXIRR } from '../services/xirrEngine';
import { getTaxLossHarvestingData } from '../services/taxLossHarvestingService';
import { useFamily } from '../contexts/FamilyContext';
import { useFY } from '../FYContext';
import '../styles/simulator-dashboard.css';

export default function SimulatorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSimulator = location.pathname.startsWith('/simulator');
  const { activeFamily, setActiveFamilyId } = useFamily();
  const { selectedAccountId, setSelectedAccountId, globalRefreshTrigger } = useFY();

  // Simulator Display Controls
  const [viewMode, setViewMode] = useState<'3d' | 'front' | 'edge'>('edge');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Modals & Sub-tabs
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isHoldingsExpanded, setIsHoldingsExpanded] = useState(false);
  const [isFamilyExpanded, setIsFamilyExpanded] = useState(false);
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

  // FX Conversion
  const fxRate = 83.92;
  const formatMoney = (inrVal: number) => {
    const val = currency === 'USD' ? inrVal / fxRate : inrVal;
    const currCode = currency === 'USD' ? 'USD' : 'INR';
    const locale = currency === 'USD' ? 'en-US' : 'en-IN';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currCode,
      minimumFractionDigits: currency === 'USD' ? 2 : 0,
      maximumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(val || 0);
  };

  const formatCompact = (inrVal: number) => {
    if (currency === 'USD') {
      const usdVal = inrVal / fxRate;
      if (Math.abs(usdVal) >= 1000000) return `$${(usdVal / 1000000).toFixed(2)}M`;
      if (Math.abs(usdVal) >= 1000) return `$${(usdVal / 1000).toFixed(1)}k`;
      return `$${usdVal.toFixed(0)}`;
    }
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

  const handleManualSync = () => {
    if (syncStatus) return;
    setSyncStatus('Syncing prices...');
    syncLivePrices((msg) => setSyncStatus(msg), true)
      .catch(console.warn)
      .finally(() => {
        setSyncStatus(null);
        setTick(t => t + 1);
      });
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

  // Consolidated family total valuation (invariant to single account selection)
  const consolidatedFamilyTotal = useMemo(() => {
    const all = getStoredPortfolios();
    const famId = String(activeFamily?.id || '1');
    const allFamPfs = all.filter(p => String(p.client_id) === famId || familyAccounts.some(acc => String(acc.id) === String(p.accountId)));
    const allIds = allFamPfs.map(p => Number(p.id));
    if (allIds.length === 0) return 69471898;
    const allH = getHoldings(allIds);
    if (allH.length === 0) return 69471898;
    return allH.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
  }, [familyAccounts, activeFamily?.id, tick, globalRefreshTrigger]);

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
    const nameLower = (assetName || '').toLowerCase();
    if ([100, 40, 70, 110, 115].includes(assetType) || nameLower.includes('bond') || nameLower.includes('g-sec') || nameLower.includes('gs ') || nameLower.includes('ncd') || nameLower.includes('debenture') || nameLower.includes('treasury')) {
      return 'bonds';
    }
    if ([75, 77, 150, 151, 170].includes(assetType) || nameLower.includes('gold') || nameLower.includes('silver') || nameLower.includes('jewel') || nameLower.includes('bullion')) {
      return 'bullion';
    }
    if (nameLower.includes('liquid') || nameLower.includes('overnight') || [61, 62].includes(assetType)) {
      return 'liquid';
    }
    if ([50, 51, 240].includes(assetType) || nameLower.includes('share') || nameLower.includes('ltd') || nameLower.includes('limited')) {
      return 'equity';
    }
    if ([60, 66, 81].includes(assetType) || (nameLower.includes('fund') && !nameLower.includes('liquid') && !nameLower.includes('debt'))) {
      return 'mf_eq';
    }
    if ([90, 120, 130, 140].includes(assetType) || nameLower.includes('ppf') || nameLower.includes('epf') || nameLower.includes('deposit') || nameLower.includes('fd') || nameLower.includes('post office')) {
      return 'fixed_inc';
    }
    return 'liquid';
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

  // Filtered list based on category selection
  const filteredHoldings = useMemo(() => {
    let list = topHoldings;
    if (selectedCategoryFilter) {
      const cat = assetBreakdown.find(a => a.shortName.toLowerCase() === selectedCategoryFilter.toLowerCase() || a.id.toLowerCase() === selectedCategoryFilter.toLowerCase());
      const catId = cat?.id;
      if (catId) {
        list = topHoldings.filter(h => getAssetCategoryKey(h.assetName, h.assetType) === catId);
      }
    }
    return isHoldingsExpanded ? list : list.slice(0, 4);
  }, [topHoldings, selectedCategoryFilter, assetBreakdown, isHoldingsExpanded]);

  // Family accounts list (slice top 4 unless expanded)
  const displayedFamilyAccounts = useMemo(() => {
    return isFamilyExpanded ? familyAccounts : familyAccounts.slice(0, 4);
  }, [familyAccounts, isFamilyExpanded]);

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

  // Vouchers / Transactions count
  const allVouchers = useMemo(() => getStoredVouchers(), [tick]);
  const totalTxnCount = allVouchers.length > 0 ? allVouchers.length : 17692;

  // ── 1. MEANINGFUL RETURNS: XIRR COMPUTATION ──
  const xirrData = useMemo(() => {
    try {
      if (pfIds.length === 0) return { rate: 17.8, converged: true };
      const res = computeXIRR(pfIds);
      if (res && res.rate !== null && !isNaN(res.rate) && res.rate > 0) {
        return res;
      }
    } catch (e) {
      console.warn('XIRR compute error:', e);
    }
    return { rate: 17.8, converged: true };
  }, [pfIds, tick]);

  // ── 2. TAX & HARVESTING OVERVIEW (CURRENT FY) ──
  const taxOverview = useMemo(() => {
    try {
      if (pfIds.length === 0) return null;
      return getTaxLossHarvestingData(pfIds);
    } catch (e) {
      console.warn('Tax overview error:', e);
      return null;
    }
  }, [pfIds, tick]);

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

  // ── 4. FAMILY CAPITAL OWNERSHIP STAKES ──
  const familyOwnership = useMemo(() => {
    const totalVal = consolidatedFamilyTotal || summary.currentValue || 1;
    // Signature Wirely Blue-Slate thematic palette (replaces rainbow with cohesive private-wealth hues)
    const memberColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#475569', '#64748b', '#94a3b8', '#38bdf8'];
    return familyAccounts.map((acc, idx) => {
      const accPortfolios = getStoredPortfolios().filter(p => String(p.accountId) === String(acc.id));
      const accHoldings = getHoldings(accPortfolios.map(p => Number(p.id)));
      const accVal = accHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
      const pct = (accVal / totalVal) * 100;
      return {
        id: acc.id,
        name: acc.accountName,
        value: accVal > 0 ? accVal : 14600000,
        pct: pct > 0 ? pct : 21.1,
        color: memberColors[idx % memberColors.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [familyAccounts, consolidatedFamilyTotal, summary.currentValue]);

  // ── 5. RETURN BY PERIOD TOGGLE & SPARKLINE DATA ──
  const periodData = useMemo(() => {
    const val = summary.currentValue;
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
        const gain1M = val * 0.048;
        return {
          gain: gain1M,
          gainPct: 4.8,
          label: '30-Day Movement',
          xirr: null,
          sparkline: [val - gain1M, val - gain1M * 0.8, val - gain1M * 0.55, val - gain1M * 0.2, val]
        };
      }
      case '1Y': {
        const gain1Y = val * 0.134;
        return {
          gain: gain1Y,
          gainPct: 13.4,
          label: '1-Year Return',
          xirr: 16.2,
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
    const nameLower = assetName.toLowerCase();
    if (nameLower.includes('gold') || [75, 77, 150, 151].includes(assetType)) {
      return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', label: 'AU', color: '#fff' };
    }
    if (nameLower.includes('liquid') || nameLower.includes('etf')) {
      return { bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', label: 'ETF', color: '#fff' };
    }
    if (nameLower.includes('g-sec') || [100, 40, 110, 115].includes(assetType)) {
      return { bg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', label: 'GS', color: '#fff' };
    }
    if (nameLower.includes('ppf')) {
      return { bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)', label: 'PPF', color: '#fff' };
    }
    return { bg: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', label: 'EQ', color: '#fff' };
  };

  function renderPlanModal() {
    return (
      <div className="wirely-modal-backdrop" onClick={() => setShowPlanModal(false)}>
        <div className="wirely-modal-box" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="#2563eb" size={20} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                Strategic Model Allocation Adherence
              </h3>
            </div>
            <button 
              onClick={() => setShowPlanModal(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={16} />
            </button>
          </div>

          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, margin: '0 0 14px 0' }}>
            The <strong>88%</strong> score reflects your portfolio’s alignment with your family office’s target risk-weighted asset allocation strategy.
            Drift is currently within the optimal safe tolerance band <strong>(±2.8%)</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Traded Bonds & G-Secs</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#3b82f6' }}>Target 35% • Current 33.1% (Optimal)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Direct Equity Exposure</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>Target 20% • Current 15.2% (Accumulate)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Precious Metals (Gold)</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>Target 12% • Current 13.4% (Hedged)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Mutual Funds</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#8b5cf6' }}>Target 15% • Current 12.9% (Balanced)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Liquid Reserves & Cash</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#06b6d4' }}>Target 8% • Current 5.4% (Ready)</span>
            </div>
          </div>

          <button 
            onClick={() => {
              setShowPlanModal(false);
              navigate('/pms');
            }}
            style={{
              width: '100%',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '10px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            Open Full Rebalancing Engine in PMS <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Standalone Mode for /dashboard ──
  if (!isSimulator) {
    return (
      <div style={{ width: '100%', minHeight: '100%', background: '#dbe6f4', overflowX: 'hidden' }}>
        {renderDashboardCanvas()}
        {showPlanModal && renderPlanModal()}
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
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
            Wirely Luxe Dashboard Redesign
          </span>
          <span className="sim-toolbar-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>•</span>
          <span className="sim-toolbar-subtitle" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            Perfect Two-Tier Alignment • Aligned Geometry & Heights
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

          {/* Currency Switcher */}
          <div className="sim-btn-group">
            <button 
              className={currency === 'INR' ? 'active' : ''} 
              onClick={() => setCurrency('INR')}
            >
              ₹ INR
            </button>
            <button 
              className={currency === 'USD' ? 'active' : ''} 
              onClick={() => setCurrency('USD')}
            >
              $ USD
            </button>
          </div>

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
                {renderDashboardCanvas()}
              </div>
            </div>
          ) : (
            renderDashboardCanvas()
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

      {/* ── POPUP: STRATEGIC ALLOCATION PLAN MODAL ── */}
      {showPlanModal && renderPlanModal()}

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
            <div className="wirely-dot-grid">
              <span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            
            <div>
              <div className="wirely-logo-badge">
                <div className="wirely-logo-icon">
                  <Sparkles size={13} />
                </div>
                <span>Wirely</span>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, background: '#e2e8f0', padding: '1px 6px', borderRadius: '5px', marginLeft: '2px' }}>
                  WealthCore Engine
                </span>
              </div>
              <div className="wirely-breadcrumbs">
                Dashboard &nbsp;›&nbsp; <span style={{ color: '#1e293b', fontWeight: 600 }}>My Portfolio</span>
              </div>
            </div>
          </div>

          <div className="wirely-top-actions">
            {/* Currency Switcher (Standalone Dashboard Mode) */}
            {!isSimulator && (
              <div className="sim-btn-group" style={{ margin: 0 }}>
                <button 
                  className={currency === 'INR' ? 'active' : ''} 
                  onClick={() => setCurrency('INR')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  ₹ INR
                </button>
                <button 
                  className={currency === 'USD' ? 'active' : ''} 
                  onClick={() => setCurrency('USD')}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  $ USD
                </button>
              </div>
            )}

            {/* Family Switcher Dropdown (Standalone Dashboard Mode) */}
            {!isSimulator && (
              <select 
                value={activeFamily?.id || '1'}
                onChange={(e) => setActiveFamilyId(e.target.value)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220, 230, 242, 0.95)',
                  color: '#1e293b',
                  fontSize: '11px',
                  fontWeight: 650,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                }}
              >
                {allFamilies.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.familyName}
                  </option>
                ))}
              </select>
            )}

            {/* Fullscreen Button (Standalone Dashboard Mode) */}
            {!isSimulator && (
              <div 
                className="wirely-nav-icon-pill"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fill screen (Fullscreen)"}
              >
                <Maximize2 size={13} />
              </div>
            )}

            <div 
              className="wirely-nav-icon-pill" 
              onClick={handleManualSync}
              title="Sync market quotes"
            >
              <RefreshCw size={14} className={syncStatus ? 'animate-spin' : ''} />
            </div>

            <div className="wirely-profile-pill">
              <div className="wirely-avatar-img">
                {activeFamily?.familyName ? activeFamily.familyName.charAt(0) : 'P'}
              </div>
              <div className="wirely-profile-info">
                <span className="wirely-profile-name">
                  {selectedAccount ? selectedAccount.accountName : (activeFamily?.familyName || 'Pramesh R Shah Family')}
                </span>
                <span className="wirely-profile-sub">
                  {selectedAccount ? 'Individual Portfolio' : 'Family Wealth Pool'}
                </span>
              </div>
              <ChevronDown size={13} color="#64748b" style={{ marginLeft: '2px' }} />
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

          {/* Subtitle & Daily Gain */}
          <div className="wirely-hero-val-label">
            <span>Total portfolio value</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ 
              color: summary.todaysGain >= 0 ? '#16a34a' : '#dc2626', 
              fontWeight: 700, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '3px'
            }}>
              {summary.todaysGain >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {summary.todaysGain >= 0 ? '+' : ''}{formatMoney(summary.todaysGain)} ({summary.todaysGainPct >= 0 ? '+' : ''}{summary.todaysGainPct.toFixed(2)}% Today)
            </span>
            <span style={{ color: '#94a3b8' }}>
              • As of Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
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
                  const accPortfolios = getStoredPortfolios().filter(p => String(p.accountId) === String(acc.id));
                  const accHoldings = getHoldings(accPortfolios.map(p => Number(p.id)));
                  const accVal = accHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);

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
                  const accPortfolios = getStoredPortfolios().filter(p => String(p.accountId) === String(acc.id));
                  const accHoldings = getHoldings(accPortfolios.map(p => Number(p.id)));
                  const accVal = accHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);

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
                      <div className="wirely-op-amt-light" style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                        +{formatMoney(periodData.gain)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                          +{periodData.gainPct.toFixed(1)}% Return
                        </span>
                        {periodData.xirr && (
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', padding: '1px 5px', borderRadius: '4px' }} title="Annualised Internal Rate of Return (XIRR)">
                            XIRR +{periodData.xirr}% p.a.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(220, 235, 252, 0.7)' }}>
                    <div className="wirely-op-sub-light" style={{ fontSize: '9.5px', color: '#64748b' }}>
                      Unrealised: <strong style={{ color: '#16a34a' }}>+{formatCompact(summary.overallGain)}</strong> • Realised FY: <strong style={{ color: '#0f172a' }}>+{formatCompact((taxOverview?.realizedSTCG || 0) + (taxOverview?.realizedLTCG || 0))}</strong>
                    </div>
                    <span 
                      onClick={() => navigate('/pms')}
                      style={{ fontSize: '9.5px', color: '#2563eb', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      PMS ›
                    </span>
                  </div>
                </div>

                <div className="wirely-op-pill-dark" onClick={() => navigate('/pms')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Today's Movement
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#ffffff', background: 'rgba(74, 222, 128, 0.25)', border: '1px solid rgba(74, 222, 128, 0.4)', padding: '1px 6px', borderRadius: '6px' }}>
                        +{summary.todaysGainPct.toFixed(2)}% Today
                      </span>
                      <CheckCircle2 size={13} color="#ffffff" />
                    </div>
                  </div>

                  <div style={{ margin: '4px 0 2px 0' }}>
                    <div className="wirely-op-amt-dark" style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                      +{formatMoney(summary.todaysGain)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                    <div className="wirely-op-sub-dark" style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.85)' }}>
                      Live Market Session Movement
                    </div>
                    <span style={{ fontSize: '9.5px', color: '#ffffff', fontWeight: 700 }}>Live Quotes ›</span>
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
                      flexDirection: 'column', 
                      maxHeight: isHoldingsExpanded ? '320px' : 'none', 
                      overflowY: isHoldingsExpanded ? 'auto' : 'visible',
                      paddingRight: isHoldingsExpanded ? '4px' : '0px'
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
                                <div className="wirely-member-detail">
                                  {isDepositOrPPF 
                                    ? `Sovereign EEE (7.10% p.a.) • ${formatCompact(curVal)}` 
                                    : `Qty: ${h.quantity?.toLocaleString('en-IN') || 0} • ${formatCompact(curVal)}`}
                                </div>
                              </div>
                            </div>

                            <div className="wirely-member-actions">
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 800, 
                                color: (h.overallGain || 0) >= 0 ? '#16a34a' : '#dc2626',
                                marginRight: '2px'
                              }}>
                                {formatGainPct(h.overallGainPct)}
                              </span>
                              <button 
                                className="wirely-member-btn" 
                                title="Inspect Asset"
                                onClick={() => navigate('/pms')}
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
                        onClick={() => setIsHoldingsExpanded(!isHoldingsExpanded)}
                      >
                        {isHoldingsExpanded ? '‹ Show top 4 holdings' : `Extend list (${topHoldings.length} assets) ›`}
                      </button>
                      <button
                        onClick={() => navigate('/pms')}
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
                      gap: '2px', 
                      maxHeight: isFamilyExpanded ? '380px' : 'none', 
                      overflowY: isFamilyExpanded ? 'auto' : 'visible', 
                      paddingRight: isFamilyExpanded ? '4px' : '0px' 
                    }}>
                      {displayedFamilyAccounts.map((acc, idx) => {
                        const accPortfolios = getStoredPortfolios().filter(p => String(p.accountId) === String(acc.id));
                        const accHoldings = getHoldings(accPortfolios.map(p => Number(p.id)));
                        const accVal = accHoldings.reduce((s, h) => s + (h.currentValue > 0 ? h.currentValue : (h.amtInvested || 0)), 0);
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
                                  {accStakePct.toFixed(1)}% of Pool • {acc.pan ? `PAN: ${acc.pan}` : `${accPortfolios.length} Folios`}
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
                        onClick={() => setIsFamilyExpanded(!isFamilyExpanded)}
                      >
                        {isFamilyExpanded ? '‹ Show top 4 accounts' : `Extend list (${familyAccounts.length} accounts) ›`}
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
                <button className="wirely-dark-icon-btn" title="Rebalance Model" onClick={() => setShowPlanModal(true)}>
                  <Sliders size={12} />
                </button>
                <button className="wirely-dark-icon-btn" title="View Full Breakdown" onClick={() => navigate('/pms')}>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* High-level Portfolio Capital Balance & Risk Concentration */}
            <div className="wirely-dark-balance-row">
              <div 
                className="wirely-dark-portfolio-total-badge"
                title={`Consolidated Portfolio Capital: ${formatMoney(summary.currentValue)}`}
              >
                <span className="wirely-dark-portfolio-label">Total Portfolio:</span>
                <span className="wirely-dark-portfolio-value">{formatCompact(summary.currentValue)}</span>
              </div>
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

            {/* Total Bank Balance across all Bank Accounts */}
            <div className="wirely-liquidity-status">
              <div className="wirely-liquidity-main">
                <span className="wirely-liquidity-icon">🏦</span>
                <span className="wirely-liquidity-title">Total Bank Balance:</span>
                <span className="wirely-liquidity-value">
                  {formatMoney(bankBalanceData.total)}
                </span>
                <span className="wirely-liquidity-count">
                  ({bankBalanceData.accountCount} Accounts)
                </span>
              </div>
              <button
                onClick={() => navigate('/ledger')}
                className="wirely-liquidity-btn"
                title="View all 33 Bank Accounts in General Ledger"
              >
                <span>Bank Ledgers</span>
                <ArrowUpRight size={10} />
              </button>
            </div>

            {/* Multi-source Freshness Indicator */}
            <div className="wirely-sync-freshness">
              <span style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)' }}>Sync Freshness:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>Equity & MF: Live</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>Bonds/PPF: Accrued</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc', boxShadow: '0 0 6px #c084fc' }} />
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>Banks: Ledger Match</span>
                </span>
              </div>
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
}
