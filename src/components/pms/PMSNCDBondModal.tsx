import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen } from 'lucide-react';
import {
  getStoredPortfolios,
  getStoredLedgers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  getVoucherById,
  ensureLedgerExists,
  getStoredGroups,
  getAccountForPortfolio,
  state,
} from '../../logic';

interface Props {
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  voucherId?: string;
  /** 'ncd' | 'bonds' — affects labels and groupId used for ensureLedgerExists */
  assetCategory?: 'ncd' | 'bonds';
  initialMode?: 'buy' | 'sell';
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSNCDBondModal({
  assetId,
  assetName,
  portfolioIds,
  voucherId,
  assetCategory = 'ncd',
  initialMode = 'buy',
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<'buy' | 'sell'>(initialMode);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState(assetName || '');
  const [lockInPeriod, setLockInPeriod] = useState('');
  const [interestRate, setInterestRate] = useState<number>(0);
  const [interestType, setInterestType] = useState('Cumulative');
  const [interestPayment, setInterestPayment] = useState('Quarterly');
  const [maturityDate, setMaturityDate] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [faceValue, setFaceValue] = useState<number>(1000);
  const [accruedInterest, setAccruedInterest] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isNCD = assetCategory === 'ncd';
  const isSell = mode === 'sell';
  const categoryLabel = isNCD ? 'NCD / Debenture' : 'Bond';
  const categoryBadge = isSell 
    ? (isNCD ? 'SELL — NCD' : 'SELL — BOND')
    : (isNCD ? 'BUY — NCD' : 'BUY — BOND');
  const badgeBg = isSell ? '#fee2e2' : (isNCD ? '#fef3c7' : '#eff6ff');
  const badgeColor = isSell ? '#b91c1c' : (isNCD ? '#92400e' : '#1d4ed8');
  const saveBtnBg = isSell ? '#dc2626' : (isNCD ? '#d97706' : '#2563eb');
  const saveBtnBgDisabled = isSell ? '#fca5a5' : (isNCD ? '#fcd34d' : '#93c5fd');

  const cleanAmount = quantity * rate;
  const netAmount = cleanAmount + (isSell ? (Number(accruedInterest) || 0) : 0);

  const portfolios = React.useMemo(() => getStoredPortfolios(), []);

  const targetAccountId = React.useMemo(() => {
    if (portfolioIds && portfolioIds[0]) {
      const port = portfolios.find((p: any) => String(p.id) === String(portfolioIds[0]));
      if (port?.accountId) return port.accountId;
      return getAccountForPortfolio(Number(portfolioIds[0])) || undefined;
    }
    return undefined;
  }, [portfolioIds, portfolios]);

  const ledgers = React.useMemo(() => getStoredLedgers(targetAccountId), [targetAccountId]);
  const groups = React.useMemo(() => getStoredGroups(targetAccountId), [targetAccountId]);

  const bankLedgers = React.useMemo(
    () =>
      ledgers.filter((l: any) => {
        const lidNum = Number(l.id);
        const g = groups.find((g: any) => String(g.id) === String(l.groupId));
        const isBankOrCash = g && (
          String(g.id) === '60' ||
          String(g.id) === '55' ||
          g.name?.toLowerCase().includes('bank') ||
          g.name?.toLowerCase().includes('cash')
        );
        const isDebtorOrBroker = (lidNum >= 100001 && lidNum <= 100099) ||
          (g && (String(g.id) === '90' || String(g.id) === '75')) ||
          l.name?.toLowerCase().includes('direct');
        return isBankOrCash || isDebtorOrBroker;
      }),
    [ledgers, groups]
  );

  useEffect(() => {
    if (!bankLedgerId && bankLedgers.length > 0) {
      // For bond sales via direct/RBI, default to Direct (100004) if present
      const directLedger = isSell ? bankLedgers.find((l: any) => l.name?.toLowerCase() === 'direct' || String(l.id) === '100004') : null;
      setBankLedgerId(directLedger ? directLedger.id : bankLedgers[0].id);
    }
  }, [bankLedgers, bankLedgerId, isSell]);

  useEffect(() => {
    const port = portfolios.find((p: any) => String(p.id) === String(portfolioIds[0]));
    if (port) setPortfolioName(port.portfolioName || port.investor_name || '');
  }, [portfolioIds, portfolios]);

  useEffect(() => {
    if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setOriginalVoucher(v);
        setDate(v.date || new Date().toISOString().split('T')[0]);
        setNarration(v.narration || '');
        if (v.title) setTitle(v.title);
        if (v.lockInPeriod) setLockInPeriod(v.lockInPeriod);
        if (v.interestRate) setInterestRate(Number(v.interestRate));
        if (v.interestType) setInterestType(v.interestType);
        if (v.interestPayment) setInterestPayment(v.interestPayment);
        if (v.maturityDate) setMaturityDate(v.maturityDate);
        if (v.faceValue) setFaceValue(Number(v.faceValue));

        const assetLine = v.lines?.find((l: any) => Number(l.debit) > 0);
        if (assetLine) {
          setQuantity(assetLine.quantity || 0);
          setRate(assetLine.price || 0);
          setBankLedgerId('');
        }
        const creditLine = v.lines?.find((l: any) => Number(l.credit) > 0);
        if (creditLine) setBankLedgerId(creditLine.ledgerId || '');
      }
    }
  }, [voucherId, assetId]);

  useEffect(() => {
    if (mode === 'sell' && (!quantity || quantity === 0)) {
      const pfidNum = Number(portfolioIds[0]);
      const amidNum = Number(assetId);
      const sumRow = state.sumTable?.find((s: any) =>
        s.pfolio_id === pfidNum && (Number(s.sid) === amidNum || Number(s.amid) === amidNum)
      );
      if (sumRow && Number(sumRow.qnt) > 0) {
        setQuantity(Number(sumRow.qnt));
        if (Number(sumRow.currv) > 0) {
          setRate(Number((Number(sumRow.currv) / Number(sumRow.qnt)).toFixed(2)));
        } else if (Number(sumRow.amtinv) > 0) {
          setRate(Number((Number(sumRow.amtinv) / Number(sumRow.qnt)).toFixed(2)));
        }
      }
    }
  }, [mode, assetId, portfolioIds, quantity]);

  const handleSave = async () => {
    if (!quantity || quantity <= 0) { alert('Please enter a valid quantity.'); return; }
    if (!rate || rate <= 0) { alert('Please enter a valid rate/price.'); return; }
    setIsSaving(true);
    try {
      const acidNum = targetAccountId ? Number(targetAccountId) : undefined;
      const totalAmount = quantity * rate;
      const accruedIntNum = isSell ? (Number(accruedInterest) || 0) : 0;
      const totalNetProceeds = totalAmount + accruedIntNum;

      let finalBankId = bankLedgerId;
      if (!finalBankId) {
        const bank = ledgers.find((l: any) => l.name?.toLowerCase().includes('bank'));
        if (bank) finalBankId = bank.id;
        else {
          const created = await ensureLedgerExists('Bank', 'bank', acidNum);
          finalBankId = created?.id ?? '';
        }
      }
      if (!finalBankId) { alert('Please select a settlement (bank / broker / direct) account.'); setIsSaving(false); return; }

      const groupId = isNCD ? 'ncd' : 'bonds';
      const bondLedger = await ensureLedgerExists(title || assetName, groupId, acidNum);
      const bondLedgerId = bondLedger?.id ?? assetId;

      const lines = isSell ? [
        {
          ledgerId: bondLedgerId,
          amid: Number(assetId) > 0 ? Number(assetId) : undefined,
          debit: 0,
          credit: totalAmount,
          quantity,
          price: rate,
          salePrice: rate,
          saleAmount: totalAmount,
          tradeType: 'SELL',
        },
        ...(accruedIntNum > 0 ? [{
          ledgerId: '401', // Interest on Investment (Chart of Accounts)
          debit: 0,
          credit: accruedIntNum,
          narration: 'Accrued Interest on Bond Sale',
        }] : []),
        { ledgerId: finalBankId, debit: totalNetProceeds, credit: 0 },
      ] : [
        {
          ledgerId: bondLedgerId,
          amid: Number(assetId) > 0 ? Number(assetId) : undefined,
          debit: totalAmount,
          credit: 0,
          quantity,
          price: rate,
          tradeType: 'BUY',
        },
        { ledgerId: finalBankId, debit: 0, credit: totalAmount },
      ];

      const voucherData = {
        date,
        type: isSell ? ('sale' as const) : ('journal' as const),
        accountId: acidNum,
        portfolioId: portfolioIds[0],
        assetId,
        narration: narration || `${categoryLabel} ${isSell ? 'Sale / Redemption' : 'Buy'} — ${title || assetName} (${quantity} @ ${rate}${accruedIntNum > 0 ? ` + Accrued Int ₹${accruedIntNum}` : ''})`,
        title,
        lockInPeriod,
        interestRate,
        interestType,
        interestPayment,
        maturityDate,
        faceValue,
        lines,
      };

      if (voucherId && originalVoucher) {
        await updateVoucher({ ...originalVoucher, ...voucherData });
      } else {
        await createVoucher({ id: Math.random().toString(36).substring(2, 11), ...voucherData });
      }
      onSaved();
    } catch (e: any) {
      console.error(`❌ PMSNCDBondModal save failed:`, e);
      alert(`Save failed: ${e?.message || 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!voucherId) return;
    if (window.confirm(`Delete this ${categoryLabel} entry?`)) {
      await deleteVoucher(voucherId);
      onSaved();
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '7px',
    border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a',
    outline: 'none', fontWeight: 500, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '640px', maxWidth: '95vw', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: badgeBg, color: badgeColor, fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>{categoryBadge}</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{categoryLabel} {isSell ? 'Sale / Redemption' : 'Purchase'} Entry</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{assetName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '5px 10px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
              <FolderOpen size={14} color={isSell ? '#dc2626' : (isNCD ? '#d97706' : '#2563eb')} />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {!voucherId && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', padding: '4px 24px 0 24px', gap: '8px' }}>
            <button
              onClick={() => setMode('buy')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: !isSell ? (isNCD ? '2px solid #d97706' : '2px solid #2563eb') : '2px solid transparent',
                background: !isSell ? '#fff' : 'transparent',
                borderRadius: '6px 6px 0 0',
                fontWeight: !isSell ? 700 : 600,
                color: !isSell ? (isNCD ? '#92400e' : '#1d4ed8') : '#64748b',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ➕ Buy
            </button>
            <button
              onClick={() => setMode('sell')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: isSell ? '2px solid #dc2626' : '2px solid transparent',
                background: isSell ? '#fff' : 'transparent',
                borderRadius: '6px 6px 0 0',
                fontWeight: isSell ? 700 : 600,
                color: isSell ? '#b91c1c' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔻 Sell / Redeem
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Investment Details */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {categoryLabel} Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Title / Description</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={isNCD ? 'e.g. Muthoot Finance NCD 9.5%' : 'e.g. NHAI Bond 7.35% 2026'} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lock-in Period (Date)</label>
                <input type="date" value={lockInPeriod} onChange={e => setLockInPeriod(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Maturity Date</label>
                <input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Interest Rate (%)</label>
                <input type="number" step="0.01" value={interestRate || ''} onChange={e => setInterestRate(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Interest Type</label>
                <select value={interestType} onChange={e => setInterestType(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option>Cumulative</option>
                  <option>Simple</option>
                  <option>Compound</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Interest Payment</label>
                <select value={interestPayment} onChange={e => setInterestPayment(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option>At Maturity</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Half-Yearly</option>
                  <option>Yearly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transaction Section */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '200px' }} />
              </div>
              <div>
                <label style={labelStyle}>Quantity</label>
                <input type="number" step="1" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{isSell ? 'Clean Price / Rate (₹)' : 'Rate (₹)'}</label>
                <input type="number" step="any" value={rate || ''} onChange={e => setRate(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Face Value (₹)</label>
                <input type="number" step="any" value={faceValue || ''} onChange={e => setFaceValue(Number(e.target.value))} placeholder="1000" style={inputStyle} />
              </div>

              {isSell && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Accrued Interest (₹) — Credited to Interest on Investment</label>
                  <input
                    type="number"
                    step="any"
                    value={accruedInterest || ''}
                    onChange={e => setAccruedInterest(Number(e.target.value))}
                    placeholder="0.00"
                    style={{ ...inputStyle, borderColor: '#16a34a', background: '#f0fdf4' }}
                  />
                  <div style={{ fontSize: '11px', color: '#15803d', marginTop: '3px', fontWeight: 600 }}>
                    💡 Accrued coupon interest from RBI / buyer will be automatically credited to Interest on Investment (Ledger #401).
                  </div>
                </div>
              )}

              {/* Amount display */}
              <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Clean Consideration (Qty × Rate)</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>₹{fmt(cleanAmount)}</span>
                </div>
                {isSell && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Accrued Interest</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>+₹{fmt(Number(accruedInterest) || 0)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Total Net Settlement {isSell ? 'Receivable' : 'Payable'}</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: isSell ? '#b91c1c' : '#0f172a' }}>₹{fmt(netAmount)}</span>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{isSell ? 'Receiving Settlement Account (Direct / Broker / Bank)' : 'Bank / Cash Account (Source)'}</label>
                <select value={bankLedgerId} onChange={e => setBankLedgerId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">Select Settlement Account...</option>
                  {bankLedgers.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Narration</label>
                <input type="text" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Optional note..." style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f8fafc' }}>
          <div>
            {voucherId && (
              <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: isSaving ? saveBtnBgDisabled : saveBtnBg, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'wait' : 'pointer' }}>
              <Save size={14} /> {isSaving ? 'Saving...' : (isSell ? `Sell / Redeem ${categoryLabel}` : `Buy ${categoryLabel}`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
