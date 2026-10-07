import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, CheckCircle2, AlertCircle, TrendingUp, ShieldCheck, Database, ArrowRight, Loader2, DollarSign, Wallet, Calendar, Building } from 'lucide-react';
import {
  validateIsin,
  lookupIsinDetails,
  createManualAsset,
  type AssetMaster,
  type ManualAssetInput
} from '../../services/assetMasterService';
import {
  registerNewAssetInState,
  getStoredPortfolios,
  getStoredAccounts,
  getAccountForPortfolio,
  getStoredLedgers,
  getStoredGroups,
  ensureLedgerExists,
  createVoucher
} from '../../logic';
import { useFamily } from '../../contexts/FamilyContext';

interface Props {
  isOpen?: boolean;
  initialType?: 'stock' | 'mf' | 'bond';
  defaultPortfolioId?: string;
  hideTransactionSection?: boolean;
  onClose: () => void;
  onAssetCreated: (asset: AssetMaster, price?: number) => void;
}

export default function AddAssetModal({
  isOpen = true,
  initialType = 'stock',
  defaultPortfolioId,
  hideTransactionSection = false,
  onClose,
  onAssetCreated
}: Props) {
  if (!isOpen) return null;
  const [assetType, setAssetType] = useState<'stock' | 'mf' | 'bond'>(initialType);

  // Form Fields
  const [isin, setIsin] = useState('');
  const [name, setName] = useState('');
  
  // Stock Fields
  const [nseSymbol, setNseSymbol] = useState('');
  const [bseCode, setBseCode] = useState<string>('');
  const [exchangeGroup, setExchangeGroup] = useState('A');

  // Mutual Fund Fields
  const [amfiCode, setAmfiCode] = useState<string>('');
  const [mfCategory, setMfCategory] = useState<'equity' | 'debt' | 'hybrid' | 'liquid'>('equity');
  const [planOption, setPlanOption] = useState<'Growth' | 'IDCW'>('Growth');

  // Bond Fields
  const [bondCategory, setBondCategory] = useState<'gsec' | 'sgb' | 'ncd'>('gsec');
  const [faceValue, setFaceValue] = useState<number>(100);
  const [couponRate, setCouponRate] = useState<string>('');
  const [maturityDate, setMaturityDate] = useState<string>('');
  const [interestFrequency, setInterestFrequency] = useState<string>('Half-Yearly');
  const [bondSymbol, setBondSymbol] = useState('');

  // UI / Status State
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [livePricePreview, setLivePricePreview] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Portfolio Allocation & Transaction State
  const { activeFamily } = useFamily();
  const allAccounts = getStoredAccounts();
  const familyAccounts = allAccounts.filter(a => a.familyId === activeFamily?.id);
  const allPortfolios = useMemo(() => getStoredPortfolios(), []);
  const portfolios = useMemo(() => {
    const filtered = allPortfolios.filter(p => familyAccounts.some(acc => acc.id === p.accountId) || String(p.client_id) === activeFamily?.id);
    const list = filtered.length > 0 ? filtered : allPortfolios;
    return [...list].sort((a, b) => {
      const aName = (a.portfolioName || a.investor_name || '').toLowerCase();
      const bName = (b.portfolioName || b.investor_name || '').toLowerCase();
      const famName = (activeFamily?.familyName || '').toLowerCase();
      const aPrimary = (famName.includes('pramesh') && aName.includes('pramesh') && !aName.includes('curr') && !aName.includes('fo') && !aName.includes('mf'));
      const bPrimary = (famName.includes('pramesh') && bName.includes('pramesh') && !bName.includes('curr') && !bName.includes('fo') && !bName.includes('mf'));
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return aName.localeCompare(bName);
    });
  }, [allPortfolios, familyAccounts, activeFamily?.id, activeFamily?.familyName]);

  const [recordTransaction, setRecordTransaction] = useState(Boolean(defaultPortfolioId));
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    defaultPortfolioId || (portfolios[0]?.id ? String(portfolios[0].id) : '')
  );
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tradeQty, setTradeQty] = useState<number>(1);
  const [tradePrice, setTradePrice] = useState<number>(0);
  const [paymentLedgerId, setPaymentLedgerId] = useState<string>('');

  // Sync selectedPortfolioId only if defaultPortfolioId prop explicitly changes
  const prevDefaultRef = React.useRef(defaultPortfolioId);
  useEffect(() => {
    if (defaultPortfolioId && defaultPortfolioId !== prevDefaultRef.current) {
      setSelectedPortfolioId(defaultPortfolioId);
      setRecordTransaction(true);
      prevDefaultRef.current = defaultPortfolioId;
    }
  }, [defaultPortfolioId]);

  useEffect(() => {
    if (!selectedPortfolioId && portfolios.length > 0) {
      setSelectedPortfolioId(String(portfolios[0].id));
    }
  }, [portfolios, selectedPortfolioId]);

  const targetAccountId = useMemo(() => {
    if (!selectedPortfolioId) return undefined;
    const p = portfolios.find(p => String(p.id) === String(selectedPortfolioId));
    if (p?.accountId) return p.accountId;
    return getAccountForPortfolio(Number(selectedPortfolioId)) || undefined;
  }, [selectedPortfolioId, portfolios]);

  const ledgers = useMemo(() => getStoredLedgers(targetAccountId), [targetAccountId]);
  const groups = useMemo(() => getStoredGroups(targetAccountId), [targetAccountId]);

  const settlementLedgers = useMemo(() => {
    return ledgers.filter((l: any) => {
      const g = groups.find((g: any) => String(g.id) === String(l.groupId));
      const gIdStr = g ? String(g.id) : '';
      const gNameLower = (g?.name || '').toLowerCase();
      const lNameLower = (l?.name || '').toLowerCase();
      return (
        gIdStr === '60' || gIdStr === '75' || gIdStr === '55' ||
        gIdStr === 'sundry_creditors' || gIdStr === 'bank' || gIdStr === 'cash' ||
        gNameLower.includes('bank') || gNameLower.includes('cash') || gNameLower.includes('creditor') || gNameLower.includes('broker') ||
        lNameLower.includes('bank') || lNameLower.includes('zerodha') || lNameLower.includes('upstox')
      );
    });
  }, [ledgers, groups]);

  useEffect(() => {
    if (!paymentLedgerId && settlementLedgers.length > 0) {
      setPaymentLedgerId(settlementLedgers[0].id);
    }
  }, [settlementLedgers, paymentLedgerId]);

  // Auto-switch defaults when bond category changes
  useEffect(() => {
    if (assetType === 'bond') {
      if (bondCategory === 'gsec') {
        setFaceValue(100);
        setInterestFrequency('Half-Yearly');
      } else if (bondCategory === 'sgb') {
        setFaceValue(1);
        setCouponRate('2.50');
        setInterestFrequency('Half-Yearly');
      } else if (bondCategory === 'ncd') {
        setFaceValue(1000);
        setInterestFrequency('Annual');
      }
    }
  }, [bondCategory, assetType]);

  const handleLookup = async (forcedIsin?: string) => {
    const targetIsin = (forcedIsin || isin).trim().toUpperCase();
    const check = validateIsin(targetIsin);
    if (!check.valid) {
      setLookupStatus('error');
      setLookupMessage(check.error || 'Invalid ISIN');
      return;
    }

    setIsLookingUp(true);
    setLookupMessage(null);
    setLookupStatus('idle');

    try {
      const res = await lookupIsinDetails(targetIsin);
      if (res.found) {
        setLookupStatus('success');
        setLookupMessage(res.message || '✓ Security details auto-fetched successfully.');
        if (res.name) setName(res.name);
        if (res.symbol) {
          setNseSymbol(res.symbol);
          setBondSymbol(res.symbol);
        }
        if (res.bseCode) setBseCode(String(res.bseCode));
        if (res.amfiCode) setAmfiCode(String(res.amfiCode));
        if (res.price) {
          setLivePricePreview(res.price);
          setTradePrice(res.price);
        } else if (res.faceValue) {
          setTradePrice(res.faceValue);
        }
        if (res.assetType) setAssetType(res.assetType);
        if (res.mfCategory) setMfCategory(res.mfCategory as any);
        if (res.bondCategory) setBondCategory(res.bondCategory as any);
        if (res.couponRate !== undefined && res.couponRate !== null) setCouponRate(String(res.couponRate));
        if (res.maturityDate) setMaturityDate(res.maturityDate);
        if (res.faceValue) {
          setFaceValue(res.faceValue);
          if (!res.price) setTradePrice(res.faceValue);
        }
        if (res.interestFrequency) setInterestFrequency(res.interestFrequency);
      } else {
        setLookupStatus('warning');
        setLookupMessage(res.message || 'Valid ISIN format. Please enter details manually.');
      }
    } catch (e: any) {
      setLookupStatus('warning');
      setLookupMessage('Online lookup timed out. You may continue entering details manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isinCheck = validateIsin(isin);
    if (!isinCheck.valid) {
      setFormError(isinCheck.error || 'ISIN is mandatory.');
      return;
    }

    if (!name.trim()) {
      setFormError('Security Name / Title is required.');
      return;
    }

    if (recordTransaction && !hideTransactionSection) {
      if (!selectedPortfolioId) {
        setFormError('Please select a target portfolio for this transaction.');
        return;
      }
      if (!tradeQty || tradeQty <= 0) {
        setFormError('Please enter a valid quantity greater than 0.');
        return;
      }
      if (!tradePrice || tradePrice <= 0) {
        setFormError('Please enter a valid purchase price.');
        return;
      }
      if (!paymentLedgerId) {
        setFormError('Please select a settlement bank/broker account.');
        return;
      }
    }

    setIsSubmitting(true);

    const inputData: ManualAssetInput = {
      assetType,
      name: name.trim(),
      isin: isin.trim().toUpperCase(),
      nseSymbol: (assetType === 'bond' ? bondSymbol : nseSymbol)?.trim() || undefined,
      bseCode: bseCode ? parseInt(bseCode, 10) : null,
      amfiCode: amfiCode ? parseInt(amfiCode, 10) : null,
      exchangeGroup: exchangeGroup || null,
      mfCategory: assetType === 'mf' ? mfCategory : undefined,
      bondCategory: assetType === 'bond' ? bondCategory : undefined,
      faceValue: assetType === 'bond' ? Number(faceValue) : undefined,
      couponRate: assetType === 'bond' && couponRate ? parseFloat(couponRate) : undefined,
      maturityDate: assetType === 'bond' ? maturityDate : undefined,
      interestFrequency: assetType === 'bond' ? interestFrequency : undefined
    };

    try {
      const res = await createManualAsset(inputData);
      let assetObj = res.asset;
      if (!res.success) {
        if (res.asset) {
          assetObj = res.asset;
        } else {
          setFormError(res.message || 'Failed to create asset.');
          setIsSubmitting(false);
          return;
        }
      }

      // Register into in-memory state and trigger local sync
      if (assetObj) {
        registerNewAssetInState(
          assetObj,
          (res.price || livePricePreview) ? { curr: res.price || livePricePreview!, prev: res.price || livePricePreview! } : undefined
        );
      }

      // Record Portfolio Purchase Transaction & Accounting Voucher if requested
      if (recordTransaction && !hideTransactionSection && assetObj) {
        const acidNum = targetAccountId ? Number(targetAccountId) : undefined;
        let groupId = 'stocks';
        if (assetType === 'mf') {
          groupId = mfCategory === 'debt' ? 'mf_debt' : 'mf_equity';
        } else if (assetType === 'bond') {
          groupId = bondCategory === 'ncd' ? 'ncd' : 'bonds';
        }

        const assetLedger = await ensureLedgerExists(name.trim(), groupId, acidNum);
        const assetLedgerId = assetLedger?.id || String(assetObj.amid);
        const totalAmount = Number((tradeQty * tradePrice).toFixed(2));

        const lines = [
          {
            ledgerId: assetLedgerId,
            amid: assetObj.amid,
            debit: totalAmount,
            credit: 0,
            quantity: Number(tradeQty),
            price: Number(tradePrice),
            tradeType: 'BUY'
          },
          {
            ledgerId: paymentLedgerId,
            debit: 0,
            credit: totalAmount
          }
        ];

        const voucherData = {
          date: tradeDate,
          type: 'journal' as const,
          accountId: acidNum,
          portfolioId: selectedPortfolioId,
          assetId: String(assetObj.amid),
          narration: `Buy — ${name.trim()} (${tradeQty} @ ₹${tradePrice}) [ISIN: ${isin.trim().toUpperCase()}]`,
          lines
        };

        await createVoucher(voucherData);
      }

      onAssetCreated(assetObj || res.asset!, res.price || livePricePreview || undefined);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error while creating asset.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '680px',
          maxWidth: '100%',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Asset Master Setup
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="#2563eb" /> Add Security / Asset Master
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', borderRadius: '8px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Asset Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
              Select Asset Class
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                { id: 'stock', label: 'Stock (Equity)', desc: 'NSE/BSE Listed Shares' },
                { id: 'mf', label: 'Mutual Fund', desc: 'Equity, Debt & Hybrid Funds' },
                { id: 'bond', label: 'Traded Bond', desc: 'G-Sec, SGB & Corporate NCD' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAssetType(tab.id as any);
                    setFormError(null);
                    setLookupMessage(null);
                    setLookupStatus('idle');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${assetType === tab.id ? '#2563eb' : '#e2e8f0'}`,
                    background: assetType === tab.id ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: assetType === tab.id ? '#1e40af' : '#1e293b' }}>
                    {tab.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {tab.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory ISIN Section (Core Requirement) */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="#2563eb" />
                ISIN (International Securities Identification Number) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>12 Characters (Mandatory for Live Feeds)</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={isin}
                onChange={e => {
                  const val = e.target.value.toUpperCase().replace(/\s+/g, '');
                  setIsin(val);
                  setFormError(null);
                  if (val.length === 12) {
                    handleLookup(val);
                  }
                }}
                placeholder={
                  assetType === 'stock' ? 'e.g. INE002A01018' : (assetType === 'mf' ? 'e.g. INF179K01BE2' : 'e.g. IN0020230051')
                }
                maxLength={12}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${lookupStatus === 'success' ? '#16a34a' : (lookupStatus === 'error' ? '#dc2626' : '#cbd5e1')}`,
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  outline: 'none',
                  background: '#fff'
                }}
              />
              <button
                type="button"
                onClick={() => handleLookup()}
                disabled={isLookingUp || isin.length < 2}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isLookingUp ? 'not-allowed' : 'pointer'
                }}
              >
                {isLookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Verify & Lookup
              </button>
            </div>

            {/* Lookup Status Feedback */}
            {lookupMessage && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: lookupStatus === 'success' ? '#f0fdf4' : (lookupStatus === 'error' ? '#fef2f2' : '#fefce8'),
                  color: lookupStatus === 'success' ? '#166534' : (lookupStatus === 'error' ? '#991b1b' : '#854d0e'),
                  border: `1px solid ${lookupStatus === 'success' ? '#bbf7d0' : (lookupStatus === 'error' ? '#fecaca' : '#fef08a')}`
                }}
              >
                {lookupStatus === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {lookupMessage}
              </div>
            )}
          </div>

          {/* Live Price / NAV Preview Badge */}
          {livePricePreview !== null && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#16a34a" />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    {assetType === 'mf' ? 'Live AMFI NAV' : 'Live Market Price'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#14532d' }}>
                    ₹{livePricePreview.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700, background: '#dcfce7', padding: '4px 10px', borderRadius: '12px' }}>
                Tagged to ISIN
              </span>
            </div>
          )}

          {/* Common Field: Name / Title */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              {assetType === 'stock' ? 'Company Name' : (assetType === 'mf' ? 'Mutual Fund Scheme Name' : 'Bond Title / Security Name')} <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                assetType === 'stock'
                  ? 'e.g. Tata Consultancy Services Ltd'
                  : (assetType === 'mf'
                    ? 'e.g. Parag Parikh Flexi Cap Fund - Direct Plan - Growth'
                    : 'e.g. G-Sec 7.30% GS 2053')
              }
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
            />
          </div>

          {/* ── STOCK SPECIFIC FIELDS ── */}
          {assetType === 'stock' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>NSE Symbol</label>
                <input
                  type="text"
                  value={nseSymbol}
                  onChange={e => setNseSymbol(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="e.g. TCS"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>BSE Scrip Code</label>
                <input
                  type="number"
                  value={bseCode}
                  onChange={e => setBseCode(e.target.value)}
                  placeholder="e.g. 532540"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>BSE Group</label>
                <select
                  value={exchangeGroup}
                  onChange={e => setExchangeGroup(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
                >
                  <option value="A">Group A (Large Cap)</option>
                  <option value="B">Group B (Mid/Small)</option>
                  <option value="T">Group T (Trade-to-Trade)</option>
                  <option value="Z">Group Z</option>
                  <option value="S">Group S (SME)</option>
                </select>
              </div>
            </div>
          )}

          {/* ── MUTUAL FUND SPECIFIC FIELDS ── */}
          {assetType === 'mf' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>AMFI Scheme Code</label>
                <input
                  type="number"
                  value={amfiCode}
                  onChange={e => setAmfiCode(e.target.value)}
                  placeholder="e.g. 122639"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Fund Category</label>
                <select
                  value={mfCategory}
                  onChange={e => setMfCategory(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
                >
                  <option value="equity">Equity Fund (atty 60)</option>
                  <option value="hybrid">Hybrid / Multi-Asset (atty 60)</option>
                  <option value="debt">Debt Fund (atty 61)</option>
                  <option value="liquid">Liquid / Overnight (atty 61)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Option</label>
                <select
                  value={planOption}
                  onChange={e => setPlanOption(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
                >
                  <option value="Growth">Growth</option>
                  <option value="IDCW">IDCW (Dividend Payout/Reinvest)</option>
                </select>
              </div>
            </div>
          )}

          {/* ── TRADED BOND SPECIFIC FIELDS (User requested other fields for bonds) ── */}
          {assetType === 'bond' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#fdfcfb', border: '1px solid #fed7aa', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Bond Specifications & Terms
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Bond Classification</label>
                  <select
                    value={bondCategory}
                    onChange={e => setBondCategory(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
                  >
                    <option value="gsec">Government of India Dated Security (G-Sec)</option>
                    <option value="sgb">Sovereign Gold Bond (SGB)</option>
                    <option value="ncd">Corporate NCD / Listed Debenture</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>NSE Traded Symbol</label>
                  <input
                    type="text"
                    value={bondSymbol}
                    onChange={e => setBondSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. 73GS2053 or SGBNOV26"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Coupon Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={couponRate}
                    onChange={e => setCouponRate(e.target.value)}
                    placeholder="e.g. 7.30"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Face Value (₹)</label>
                  <input
                    type="number"
                    value={faceValue}
                    onChange={e => setFaceValue(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Maturity Date</label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={e => setMaturityDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Interest Payout</label>
                  <select
                    value={interestFrequency}
                    onChange={e => setInterestFrequency(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
                  >
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Annual">Annual</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Cumulative">Cumulative</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── PORTFOLIO ALLOCATION & PURCHASE TRANSACTION (DOUBLE-ENTRY ACCOUNTING) ── */}
          {!hideTransactionSection && (
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: recordTransaction ? '14px' : '0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={recordTransaction}
                    onChange={e => setRecordTransaction(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span>Record Initial Purchase / Portfolio Allocation (Double-Entry Linked)</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  {recordTransaction ? 'Posts Buy Voucher to Accounting' : 'Master Definition Only'}
                </span>
              </div>

              {recordTransaction && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                  {/* Portfolio & Type & Date Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Target Portfolio <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        value={selectedPortfolioId}
                        onChange={e => setSelectedPortfolioId(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                      >
                        {portfolios.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.portfolioName || p.investor_name || `Portfolio ${p.id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Trade Type
                      </label>
                      <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#dcfce7', border: '1px solid #86efac', fontSize: '13px', fontWeight: 700, color: '#166534', textAlign: 'center' }}>
                        BUY (Purchase)
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Buy Date <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={tradeDate}
                        onChange={e => setTradeDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                      />
                    </div>
                  </div>

                  {/* Qty, Unit Price, Total Investment Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Quantity / Units <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={tradeQty}
                        onChange={e => setTradeQty(Number(e.target.value))}
                        placeholder="e.g. 100"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Purchase Price / NAV (₹) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={tradePrice}
                        onChange={e => setTradePrice(Number(e.target.value))}
                        placeholder="e.g. 1000.00"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Total Investment (₹)
                      </label>
                      <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '14px', fontWeight: 800, color: '#1e40af' }}>
                        ₹{(tradeQty * tradePrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Settlement Account & Accounting Preview */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Settlement Account (Paid From) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        value={paymentLedgerId}
                        onChange={e => setPaymentLedgerId(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                      >
                        {settlementLedgers.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ fontSize: '11px', color: '#334155', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                      <div><strong style={{ color: '#16a34a' }}>Dr.</strong> Investment Asset (Balance Sheet Asset)</div>
                      <div><strong style={{ color: '#dc2626' }}>Cr.</strong> {settlementLedgers.find((l: any) => String(l.id) === String(paymentLedgerId))?.name || 'Bank/Broker Account'} (Asset/Creditor)</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                    💡 <strong>Tip for Sale Transactions:</strong> To record a SALE, open the asset in PMS Workspace and click <strong>Sell</strong>, or use <strong>Activity Menu &rarr; Add Transaction</strong> to record Sell Date, Qty, and auto-book Realised Gains/Losses via FIFO.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Error Alert */}
          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  {recordTransaction ? 'Save Security & Record Purchase' : 'Save & Tag Live Price'} <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
