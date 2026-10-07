import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, ShieldCheck, Plus, Calendar, DollarSign, Building, TrendingUp, Clock, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import {
  getStoredPortfolios,
  getStoredLedgers,
  getStoredGroups,
  getStoredAccounts,
  getAccountForPortfolio,
  createVoucher,
  ensureLedgerExists,
  updateAssetPrice,
  state
} from '../../logic';
import { useFamily } from '../../contexts/FamilyContext';

interface Props {
  assetId?: string;
  assetName?: string;
  portfolioIds: string[];
  voucherId?: string;
  initialMode?: 'new_policy' | 'renewal';
  onClose: () => void;
  onSaved: () => void;
}

const COMMON_INSURERS = [
  'HDFC Life Insurance',
  'ICICI Prudential Life Insurance',
  'SBI Life Insurance',
  'Max Life Insurance',
  'Tata AIA Life Insurance',
  'Bajaj Allianz Life Insurance',
  'Kotak Mahindra Life Insurance',
  'Aditya Birla Sun Life Insurance',
  'Life Insurance Corporation of India (LIC)',
  'Canara HSBC Life Insurance',
  'Pramerica Life Insurance',
  'Other Insurer'
];

function addYearsToDate(dateStr: string, years: number): string {
  if (!dateStr || !years || isNaN(Number(years))) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10) + Number(years);
      return `${y}-${parts[1]}-${parts[2]}`;
    }
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + Number(years));
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export default function PMSULIPModal({
  assetId,
  assetName,
  portfolioIds,
  voucherId,
  initialMode = 'new_policy',
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<'new_policy' | 'renewal'>(
    assetId && Number(assetId) > 0 ? 'renewal' : initialMode
  );

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
      const aPrimary = famName.includes('pramesh') && aName.includes('pramesh') && !aName.includes('curr') && !aName.includes('fo') && !aName.includes('mf');
      const bPrimary = famName.includes('pramesh') && bName.includes('pramesh') && !bName.includes('curr') && !bName.includes('fo') && !bName.includes('mf');
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return aName.localeCompare(bName);
    });
  }, [allPortfolios, familyAccounts, activeFamily?.id, activeFamily?.familyName]);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    portfolioIds[0] || (portfolios[0]?.id ? String(portfolios[0].id) : '')
  );

  const targetAccountId = useMemo(() => {
    if (!selectedPortfolioId) return undefined;
    const p = portfolios.find(p => String(p.id) === String(selectedPortfolioId));
    if (p?.accountId) return p.accountId;
    return getAccountForPortfolio(Number(selectedPortfolioId)) || undefined;
  }, [selectedPortfolioId, portfolios]);

  const ledgers = useMemo(() => getStoredLedgers(targetAccountId), [targetAccountId]);
  const groups = useMemo(() => getStoredGroups(targetAccountId), [targetAccountId]);

  const bankLedgers = useMemo(() => {
    return ledgers.filter((l: any) => {
      const g = groups.find((g: any) => String(g.id) === String(l.groupId));
      const gIdStr = g ? String(g.id) : '';
      const gNameLower = (g?.name || '').toLowerCase();
      const lNameLower = (l?.name || '').toLowerCase();
      return (
        gIdStr === '60' || gIdStr === '75' || gIdStr === '55' ||
        gIdStr === 'sundry_creditors' || gIdStr === 'bank' || gIdStr === 'cash' ||
        gNameLower.includes('bank') || gNameLower.includes('cash') ||
        lNameLower.includes('bank') || lNameLower.includes('cash')
      );
    });
  }, [ledgers, groups]);

  // Existing ULIP policies in target portfolio
  const existingUlipLedgers = useMemo(() => {
    return ledgers.filter((l: any) => {
      const g = groups.find((g: any) => String(g.id) === String(l.groupId));
      const isUlipGroup = g && (String(g.id) === '200141' || String(g.id) === '200140' || g.name?.toLowerCase().includes('ulip') || g.name?.toLowerCase().includes('nps'));
      const isUlipName = (l.name || '').toLowerCase().includes('ulip') || (l.name || '').toLowerCase().includes('life') || (l.name || '').toLowerCase().includes('policy');
      return isUlipGroup || isUlipName;
    });
  }, [ledgers, groups]);

  // ── Form State: New Policy ──
  const [policyNumber, setPolicyNumber] = useState('');
  const [insurer, setInsurer] = useState('HDFC Life Insurance');
  const [customInsurer, setCustomInsurer] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [ppt, setPpt] = useState<number | string>(5);
  const [pt, setPt] = useState<number | string>(10);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endOfPaymentDate, setEndOfPaymentDate] = useState(() => addYearsToDate(new Date().toISOString().split('T')[0], 5));
  const [endOfPolicyTerm, setEndOfPolicyTerm] = useState(() => addYearsToDate(new Date().toISOString().split('T')[0], 10));
  const [premiumAmount, setPremiumAmount] = useState<number | string>(100000);
  const [currentValue, setCurrentValue] = useState<number | string>(100000);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentLedgerId, setPaymentLedgerId] = useState('');

  // ── Form State: Renewal ──
  const [selectedPolicyLedgerId, setSelectedPolicyLedgerId] = useState<string>(assetId || '');
  const [renewalAmount, setRenewalAmount] = useState<number | string>(100000);
  const [renewalDate, setRenewalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [updatedFundValue, setUpdatedFundValue] = useState<number | string>('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-calculate PPT End and PT Maturity Date when Start Date, PPT, or PT changes
  useEffect(() => {
    if (startDate && ppt) {
      setEndOfPaymentDate(addYearsToDate(startDate, Number(ppt)));
    }
  }, [startDate, ppt]);

  useEffect(() => {
    if (startDate && pt) {
      setEndOfPolicyTerm(addYearsToDate(startDate, Number(pt)));
    }
  }, [startDate, pt]);

  // Default bank ledger
  useEffect(() => {
    if (!paymentLedgerId && bankLedgers.length > 0) {
      setPaymentLedgerId(bankLedgers[0].id);
    }
  }, [bankLedgers, paymentLedgerId]);

  // Default existing policy in renewal mode
  useEffect(() => {
    if (mode === 'renewal') {
      if (assetId && Number(assetId) > 0) {
        setSelectedPolicyLedgerId(assetId);
      } else if (!selectedPolicyLedgerId && existingUlipLedgers.length > 0) {
        setSelectedPolicyLedgerId(existingUlipLedgers[0].id);
      }
    }
  }, [mode, assetId, existingUlipLedgers, selectedPolicyLedgerId]);

  // Auto-fill fund value when selecting an existing policy for renewal
  const activeExistingPolicy = useMemo(() => {
    if (!selectedPolicyLedgerId) return null;
    return existingUlipLedgers.find((l: any) => String(l.id) === String(selectedPolicyLedgerId)) || null;
  }, [selectedPolicyLedgerId, existingUlipLedgers]);

  const activeExistingStats = useMemo(() => {
    if (!activeExistingPolicy) return { amtinv: 0, currv: 0 };
    const amid = Number(activeExistingPolicy.id);
    const sumRow = state.sumTable?.find((s: any) => Number(s.amid) === amid && Number(s.pfolio_id) === Number(selectedPortfolioId));
    const price = state.priceMap?.[amid]?.curr || 0;
    const amtinv = sumRow ? Number(sumRow.amtinv) || 0 : 0;
    const currv = sumRow ? (Number(sumRow.currv) || price || amtinv) : (price || amtinv);
    return { amtinv, currv };
  }, [activeExistingPolicy, selectedPortfolioId]);

  useEffect(() => {
    if (mode === 'renewal' && activeExistingStats.currv > 0 && !updatedFundValue) {
      setUpdatedFundValue(activeExistingStats.currv);
    }
  }, [mode, activeExistingStats, updatedFundValue]);

  const effectiveInsurer = insurer === 'Other Insurer' ? (customInsurer || 'Insurance Co') : insurer;
  const computedPolicyName = planTitle.trim()
    ? `${effectiveInsurer} — ${planTitle.trim()} (Pol #${policyNumber.trim()})`
    : `${effectiveInsurer} ULIP (Pol #${policyNumber.trim()})`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const acidNum = targetAccountId ? Number(targetAccountId) : undefined;
    if (!acidNum) {
      setErrorMsg('Could not determine accounting entity for selected portfolio.');
      return;
    }
    if (!paymentLedgerId) {
      setErrorMsg('Please select a payment settlement bank account.');
      return;
    }

    setIsSaving(true);

    try {
      if (mode === 'new_policy') {
        if (!policyNumber.trim()) {
          setErrorMsg('Policy Number is required.');
          setIsSaving(false);
          return;
        }
        if (!planTitle.trim()) {
          setErrorMsg('Policy Plan Title / Name is required.');
          setIsSaving(false);
          return;
        }
        const prem = Number(premiumAmount);
        if (isNaN(prem) || prem <= 0) {
          setErrorMsg('Please enter a valid initial premium amount.');
          setIsSaving(false);
          return;
        }

        const policyMetadata = {
          policyNumber: policyNumber.trim(),
          insurer: effectiveInsurer,
          ppt: Number(ppt),
          pt: Number(pt),
          startDate,
          endOfPaymentDate,
          endOfPolicyTerm
        };

        const descr = `Insurer: ${effectiveInsurer} | Policy: ${policyNumber.trim()} | PPT: ${ppt} yrs | PT: ${pt} yrs | Start: ${startDate} | PPT End: ${endOfPaymentDate} | Maturity: ${endOfPolicyTerm}`;

        // 1. Ensure Ledger Exists in Chart of Accounts under group 200141 (ULIP/NPS)
        const ulipLedger = await ensureLedgerExists(
          computedPolicyName,
          'ulip',
          acidNum,
          { descr, addinfo: JSON.stringify(policyMetadata) }
        );

        if (!ulipLedger) {
          throw new Error('Failed to create or find ULIP ledger account.');
        }

        const ulipLedgerId = ulipLedger.id;
        const amidNum = Number(ulipLedgerId);

        // 2. Post Initial Premium Double-Entry Voucher
        const lines = [
          {
            ledgerId: ulipLedgerId,
            amid: amidNum,
            debit: prem,
            credit: 0,
            quantity: 1,
            price: prem,
            tradeType: 'BUY',
            atyid: 95
          },
          {
            ledgerId: paymentLedgerId,
            debit: 0,
            credit: prem
          }
        ];

        const voucherData = {
          date: paymentDate,
          type: 'journal' as const,
          accountId: acidNum,
          portfolioId: selectedPortfolioId,
          assetId: String(amidNum),
          narration: `ULIP Initial Premium — ${computedPolicyName} [PPT: ${ppt}y, PT: ${pt}y]`,
          title: computedPolicyName,
          lines
        };

        await createVoucher(voucherData);

        // 3. Set Current Valuation / Fund Value
        const latestVal = Number(currentValue) > 0 ? Number(currentValue) : prem;
        await updateAssetPrice(String(amidNum), latestVal);

      } else {
        // Renewal Premium Mode
        if (!selectedPolicyLedgerId) {
          setErrorMsg('Please select an existing ULIP policy to add a renewal premium.');
          setIsSaving(false);
          return;
        }
        const renewPrem = Number(renewalAmount);
        if (isNaN(renewPrem) || renewPrem <= 0) {
          setErrorMsg('Please enter a valid renewal premium amount.');
          setIsSaving(false);
          return;
        }

        const amidNum = Number(selectedPolicyLedgerId);
        const policyLedger = existingUlipLedgers.find((l: any) => String(l.id) === String(selectedPolicyLedgerId));
        const policyTitle = policyLedger?.name || activeExistingPolicy?.name || 'ULIP Policy';

        // 1. Post Renewal Premium Voucher
        const lines = [
          {
            ledgerId: selectedPolicyLedgerId,
            amid: amidNum,
            debit: renewPrem,
            credit: 0,
            quantity: 0, // Incremental investment on existing asset
            price: renewPrem,
            tradeType: 'BUY',
            atyid: 95
          },
          {
            ledgerId: paymentLedgerId,
            debit: 0,
            credit: renewPrem
          }
        ];

        const voucherData = {
          date: renewalDate,
          type: 'journal' as const,
          accountId: acidNum,
          portfolioId: selectedPortfolioId,
          assetId: String(amidNum),
          narration: `ULIP Renewal Premium — ${policyTitle}`,
          title: policyTitle,
          lines
        };

        await createVoucher(voucherData);

        // 2. Update Current Valuation / Fund Value if provided
        if (updatedFundValue && Number(updatedFundValue) > 0) {
          await updateAssetPrice(String(amidNum), Number(updatedFundValue));
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save ULIP transaction.');
      setIsSaving(false);
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
          width: '740px',
          maxWidth: '100%',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '10px', borderRadius: '12px' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Unit Linked Insurance Plan (ULIP)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {mode === 'new_policy' ? 'Add ULIP Policy & Terms' : 'Add ULIP Renewal Premium'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', borderRadius: '8px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div style={{ padding: '12px 24px', background: '#faf5ff', borderBottom: '1px solid #e9d5ff', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => { setMode('new_policy'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              border: mode === 'new_policy' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
              background: mode === 'new_policy' ? '#7c3aed' : '#ffffff',
              color: mode === 'new_policy' ? '#ffffff' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Plus size={15} /> 1. New Policy (Setup & Initial Premium)
          </button>
          <button
            type="button"
            onClick={() => { setMode('renewal'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              border: mode === 'renewal' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
              background: mode === 'renewal' ? '#7c3aed' : '#ffffff',
              color: mode === 'renewal' ? '#ffffff' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={15} /> 2. Add Renewal Premium / Payment
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Portfolio Target Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                Target Portfolio <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={selectedPortfolioId}
                onChange={e => setSelectedPortfolioId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, background: '#fff' }}
              >
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.portfolioName || p.investor_name || `Portfolio ${p.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                Paid From (Settlement Bank) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={paymentLedgerId}
                onChange={e => setPaymentLedgerId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
              >
                {bankLedgers.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {mode === 'new_policy' ? (
            <>
              {/* Policy Identification */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Policy Identification & Insurer
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Insurer Company <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      value={insurer}
                      onChange={e => setInsurer(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                    >
                      {COMMON_INSURERS.map(ins => (
                        <option key={ins} value={ins}>{ins}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Policy Number <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={policyNumber}
                      onChange={e => setPolicyNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="e.g. 19283746"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {insurer === 'Other Insurer' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Specify Insurer Name
                    </label>
                    <input
                      type="text"
                      value={customInsurer}
                      onChange={e => setCustomInsurer(e.target.value)}
                      placeholder="e.g. Bharti AXA Life Insurance"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Policy Plan Name / Title <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={planTitle}
                    onChange={e => setPlanTitle(e.target.value)}
                    placeholder="e.g. Click 2 Wealth or Pru Signature Growth"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Ledger Name: <strong>{computedPolicyName}</strong>
                  </div>
                </div>
              </div>

              {/* Terms & Timeline */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fafaf9' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Policy Terms & Payment Timeline
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      PPT (Paying Term in Yrs) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={ppt}
                      onChange={e => setPpt(e.target.value)}
                      min="1"
                      max="100"
                      placeholder="e.g. 5"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      PT (Policy Term in Yrs) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={pt}
                      onChange={e => setPt(e.target.value)}
                      min="1"
                      max="100"
                      placeholder="e.g. 10"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Start Date <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      End of Payment Date (PPT End)
                    </label>
                    <input
                      type="date"
                      value={endOfPaymentDate}
                      onChange={e => setEndOfPaymentDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                    />
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>Auto-computed from Start Date + {ppt} yrs</div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      End of Policy Term (Maturity Date)
                    </label>
                    <input
                      type="date"
                      value={endOfPolicyTerm}
                      onChange={e => setEndOfPolicyTerm(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, background: '#fff' }}
                    />
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>Auto-computed from Start Date + {pt} yrs</div>
                  </div>
                </div>
              </div>

              {/* Financials & Initial Valuation */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f0fdf4' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Financials & Current Valuation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>
                      Initial Premium (₹) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={premiumAmount}
                      onChange={e => {
                        const val = e.target.value;
                        setPremiumAmount(val);
                        if (!currentValue || currentValue === premiumAmount) {
                          setCurrentValue(val);
                        }
                      }}
                      placeholder="e.g. 100000"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '14px', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>
                      Payment Date <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                      Current Fund Value (₹) <span style={{ fontSize: '11px', fontWeight: 500 }}>(Editable anytime)</span>
                    </label>
                    <input
                      type="number"
                      value={currentValue}
                      onChange={e => setCurrentValue(e.target.value)}
                      placeholder="e.g. 115000"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '14px', fontWeight: 800, color: '#1e40af' }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Renewal Mode Form */}
              <div style={{ border: '1px solid #fed7aa', background: '#fffaf5', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Select ULIP Policy for Renewal Payment
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Existing ULIP Policy <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {existingUlipLedgers.length === 0 ? (
                    <div style={{ padding: '12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                      No existing ULIP policies found in this portfolio. Please switch to "New Policy" mode above to create one.
                    </div>
                  ) : (
                    <select
                      value={selectedPolicyLedgerId}
                      onChange={e => setSelectedPolicyLedgerId(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, background: '#fff' }}
                    >
                      {existingUlipLedgers.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {activeExistingPolicy && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Cumulative Premiums Paid So Far:</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                        ₹{activeExistingStats.amtinv.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Last Recorded Fund Value:</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
                        ₹{activeExistingStats.currv.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Renewal Premium Amount (₹) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      value={renewalAmount}
                      onChange={e => setRenewalAmount(e.target.value)}
                      placeholder="e.g. 100000"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      Renewal Payment Date <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={renewalDate}
                      onChange={e => setRenewalDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                    Updated Current Fund Value (₹) <span style={{ fontSize: '11px', fontWeight: 500 }}>(Latest NAV / Valuation)</span>
                  </label>
                  <input
                    type="number"
                    value={updatedFundValue}
                    onChange={e => setUpdatedFundValue(e.target.value)}
                    placeholder="e.g. 230000"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '2px solid #3b82f6', fontSize: '14px', fontWeight: 800, color: '#1e40af' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    New Total Invested will be <strong>₹{(activeExistingStats.amtinv + (Number(renewalAmount) || 0)).toLocaleString('en-IN')}</strong>.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Double-Entry Accounting Preview */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', fontSize: '11.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>Double-Entry Accounting Corresponding Voucher:</div>
            <div>
              <strong style={{ color: '#16a34a' }}>Debit (+ Asset):</strong> {mode === 'new_policy' ? (computedPolicyName || 'ULIP Policy Ledger') : (activeExistingPolicy?.name || 'ULIP Policy Ledger')} (Balance Sheet Investments)
            </div>
            <div>
              <strong style={{ color: '#dc2626' }}>Credit (- Asset):</strong> {bankLedgers.find((b: any) => String(b.id) === String(paymentLedgerId))?.name || 'Selected Bank Account'}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#b91c1c', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
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
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.3)'
              }}
            >
              <Save size={16} />
              {isSaving ? 'Posting to Ledger...' : (mode === 'new_policy' ? 'Save Policy & Post Voucher' : 'Post Renewal & Update Valuation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
