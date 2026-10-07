import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen, TrendingUp, TrendingDown } from 'lucide-react';
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
} from '../../logic';

interface Props {
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  voucherId?: string;
  /** initial transaction mode — 'addition' (buy) or 'sale' (sell) */
  initialMode?: 'addition' | 'sale';
  /** 'gold' | 'silver' */
  metal?: 'gold' | 'silver';
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSGoldSilverModal({
  assetId,
  assetName,
  portfolioIds,
  voucherId,
  initialMode = 'addition',
  metal = 'gold',
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<'addition' | 'sale'>(initialMode);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [charges, setCharges] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isGold = metal === 'gold';
  const metalLabel = isGold ? 'Gold' : 'Silver';
  const metalUnit = 'grams';
  const accentColor = isGold ? '#d97706' : '#475569';
  const accentBg = isGold ? '#fef3c7' : '#f1f5f9';
  const accentBorder = isGold ? '#fcd34d' : '#cbd5e1';

  const baseAmount = quantity * rate;
  const totalAmount = mode === 'addition' ? baseAmount + charges : baseAmount - charges;

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
        const g = groups.find((g: any) => String(g.id) === String(l.groupId));
        return (
          g &&
          (String(g.id) === '60' ||
            String(g.id) === '55' ||
            g.name?.toLowerCase().includes('bank') ||
            g.name?.toLowerCase().includes('cash'))
        );
      }),
    [ledgers, groups]
  );

  useEffect(() => {
    if (!bankLedgerId && bankLedgers.length > 0) {
      setBankLedgerId(bankLedgers[0].id);
    }
  }, [bankLedgers, bankLedgerId]);

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
        if (v.transactionMode) setMode(v.transactionMode);
        if (v.charges) setCharges(Number(v.charges));

        // Detect mode from lines: if asset line is DEBIT => addition (buy), CREDIT => sale
        const assetLine = v.lines?.find((l: any) => String(l.ledgerId) === String(assetId) || (Number(assetId) > 0 && l.amid === Number(assetId)));
        const lineWithQty = v.lines?.find((l: any) => Number(l.quantity) > 0);
        const targetLine = assetLine || lineWithQty || v.lines?.[0];

        if (targetLine) {
          setQuantity(targetLine.quantity || 0);
          setRate(targetLine.price || (targetLine.debit > 0 ? targetLine.debit / Math.max(targetLine.quantity || 1, 1) : 0));
          if (Number(targetLine.debit) > 0) setMode('addition');
          else if (Number(targetLine.credit) > 0) setMode('sale');
        }

        const bankLine = v.lines?.find((l: any) => {
          const g = groups.find((g: any) => String(g.id) === String(l.groupId));
          return bankLedgers.some((bl: any) => bl.id === l.ledgerId);
        });
        if (bankLine) setBankLedgerId(bankLine.ledgerId || '');
        else {
          const creditLine = v.lines?.find((l: any) => Number(l.credit) > 0);
          if (creditLine) setBankLedgerId(creditLine.ledgerId || '');
        }
      }
    }
  }, [voucherId, assetId]);

  const handleSave = async () => {
    if (!quantity || quantity <= 0) { alert('Please enter a valid quantity (grams).'); return; }
    if (!rate || rate <= 0) { alert('Please enter a valid rate per gram.'); return; }
    setIsSaving(true);
    try {
      const acidNum = targetAccountId ? Number(targetAccountId) : undefined;

      let finalBankId = bankLedgerId;
      if (!finalBankId) {
        const bank = ledgers.find((l: any) => l.name?.toLowerCase().includes('bank'));
        if (bank) finalBankId = bank.id;
        else {
          const created = await ensureLedgerExists('Bank', 'bank', acidNum);
          finalBankId = created?.id ?? '';
        }
      }
      if (!finalBankId) { alert('Please select a bank/cash account.'); setIsSaving(false); return; }

      const metalGroupId = isGold ? 'gold' : 'silver';
      const metalLedger = await ensureLedgerExists(assetName, metalGroupId, acidNum);
      const metalLedgerId = metalLedger?.id ?? assetId;

      const isAddition = mode === 'addition';
      const tradeType = isAddition ? 'BUY' : 'SELL';
      const assetDebit = isAddition ? totalAmount : 0;
      const assetCredit = !isAddition ? baseAmount : 0;
      const bankDebit = !isAddition ? totalAmount : 0;
      const bankCredit = isAddition ? totalAmount : 0;

      const lines: any[] = [
        {
          ledgerId: metalLedgerId,
          amid: Number(assetId) > 0 ? Number(assetId) : undefined,
          debit: assetDebit,
          credit: assetCredit,
          quantity,
          price: rate,
          tradeType,
        },
        {
          ledgerId: finalBankId,
          debit: bankDebit,
          credit: bankCredit,
        },
      ];

      // If there are charges on a sale, add an expense line
      if (!isAddition && charges > 0) {
        const chargesLedger = await ensureLedgerExists('Gold/Silver Sale Charges', 'indirect_expense', acidNum);
        if (chargesLedger) {
          lines.push({ ledgerId: chargesLedger.id, debit: charges, credit: 0 });
        }
      }

      const voucherData = {
        date,
        type: 'journal' as const,
        accountId: acidNum,
        portfolioId: portfolioIds[0],
        assetId,
        narration: narration || `${metalLabel} ${isAddition ? 'Purchase' : 'Sale'} — ${quantity}g @ ₹${rate}/g`,
        transactionMode: mode,
        charges,
        lines,
      };

      if (voucherId && originalVoucher) {
        await updateVoucher({ ...originalVoucher, ...voucherData });
      } else {
        await createVoucher({ id: Math.random().toString(36).substring(2, 11), ...voucherData });
      }
      onSaved();
    } catch (e: any) {
      console.error('❌ PMSGoldSilverModal save failed:', e);
      alert(`Save failed: ${e?.message || 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!voucherId) return;
    if (window.confirm(`Delete this ${metalLabel} ${mode === 'addition' ? 'purchase' : 'sale'} entry?`)) {
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

  const isAddition = mode === 'addition';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '580px', maxWidth: '95vw', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: accentBg, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${accentBorder}` }}>
              <button
                onClick={() => !voucherId && setMode('addition')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', border: 'none', cursor: voucherId ? 'default' : 'pointer',
                  fontWeight: 700, fontSize: '12px',
                  background: isAddition ? accentColor : '#fff',
                  color: isAddition ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                <TrendingUp size={13} /> Addition
              </button>
              <button
                onClick={() => !voucherId && setMode('sale')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', border: 'none', cursor: voucherId ? 'default' : 'pointer',
                  fontWeight: 700, fontSize: '12px',
                  background: !isAddition ? '#dc2626' : '#fff',
                  color: !isAddition ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                <TrendingDown size={13} /> Sale
              </button>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                {metalLabel} {isAddition ? 'Purchase' : 'Sale'} Entry
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{assetName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', background: '#fff', padding: '5px 10px', borderRadius: '7px', border: `1px solid ${accentBorder}` }}>
              <FolderOpen size={14} color={accentColor} />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        {/* Mode Banner */}
        <div style={{
          padding: '8px 24px',
          background: isAddition ? '#f0fdf4' : '#fef2f2',
          borderBottom: `2px solid ${isAddition ? '#86efac' : '#fca5a5'}`,
          fontSize: '12px',
          fontWeight: 700,
          color: isAddition ? '#166534' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {isAddition ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isAddition ? `Adding ${metalLabel} to portfolio (Purchase / Addition)` : `Removing ${metalLabel} from portfolio (Sale)`}
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Transaction Row */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '180px' }} />
              </div>
              <div>
                <label style={labelStyle}>Quantity ({metalUnit})</label>
                <input type="number" step="0.001" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0.000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Rate (₹/g)</label>
                <input type="number" step="any" value={rate || ''} onChange={e => setRate(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{isAddition ? 'Making/Other Charges (₹)' : 'Deduct Charges (₹)'}</label>
                <input type="number" step="any" value={charges || ''} onChange={e => setCharges(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>

              {/* Amount Summary */}
              <div style={{ gridColumn: '1 / -1', background: isAddition ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isAddition ? '#86efac' : '#fca5a5'}`, borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Base Amount (Qty × Rate)</span>
                  <span style={{ fontWeight: 700 }}>₹{fmt(baseAmount)}</span>
                </div>
                {charges > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{isAddition ? '+ Charges' : '− Charges'}</span>
                    <span style={{ fontWeight: 700, color: isAddition ? '#dc2626' : '#16a34a' }}>{isAddition ? '+' : '−'}₹{fmt(charges)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: '15px' }}>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Total {isAddition ? 'Payable' : 'Receivable'}</span>
                  <span style={{ fontWeight: 800, color: isAddition ? '#0f172a' : '#16a34a' }}>₹{fmt(Math.max(totalAmount, 0))}</span>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{isAddition ? 'Payment From (Bank/Cash)' : 'Proceeds To (Bank/Cash)'}</label>
                <select value={bankLedgerId} onChange={e => setBankLedgerId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">Select Bank / Cash Account...</option>
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
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: isSaving ? '#9ca3af' : (isAddition ? accentColor : '#dc2626'),
                color: '#fff', fontWeight: 700, fontSize: '13px',
                cursor: isSaving ? 'wait' : 'pointer',
              }}
            >
              <Save size={14} /> {isSaving ? 'Saving...' : (isAddition ? 'Save Purchase' : 'Save Sale')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
