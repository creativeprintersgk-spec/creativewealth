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
  initialMode?: 'investment' | 'closure';
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSFDInvestmentModal({
  assetId,
  assetName,
  portfolioIds,
  voucherId,
  initialMode = 'investment',
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<'investment' | 'closure'>(initialMode);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState(assetName || '');
  const [lockInPeriod, setLockInPeriod] = useState('');
  const [interestRate, setInterestRate] = useState<number>(0);
  const [interestType, setInterestType] = useState('Cumulative');
  const [interestPayment, setInterestPayment] = useState('Quarterly');
  const [maturityDate, setMaturityDate] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [interestReceived, setInterestReceived] = useState<number>(0);
  const [tdsDeducted, setTdsDeducted] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        return g && (String(g.id) === '60' || String(g.id) === '55' || g.name?.toLowerCase().includes('bank') || g.name?.toLowerCase().includes('cash'));
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
        if (v.title) setTitle(v.title);
        if (v.lockInPeriod) setLockInPeriod(v.lockInPeriod);
        if (v.interestRate) setInterestRate(Number(v.interestRate));
        if (v.interestType) setInterestType(v.interestType);
        if (v.interestPayment) setInterestPayment(v.interestPayment);
        if (v.maturityDate) setMaturityDate(v.maturityDate);

        const debitLine = v.lines?.find((l: any) => Number(l.debit) > 0 && String(l.ledgerId) !== String(assetId));
        if (!debitLine) {
          const assetLine = v.lines?.find((l: any) => Number(l.debit) > 0);
          if (assetLine) setAmount(assetLine.debit || 0);
        }
        const creditLine = v.lines?.find((l: any) => Number(l.credit) > 0);
        if (creditLine) {
          setAmount(creditLine.credit || 0);
          setBankLedgerId(creditLine.ledgerId || '');
        }
      }
    }
  }, [voucherId, assetId]);

  useEffect(() => {
    if (mode === 'closure' && (!amount || amount === 0)) {
      const pfidNum = Number(portfolioIds[0]);
      const amidNum = Number(assetId);
      const sumRow = state.sumTable?.find((s: any) =>
        s.pfolio_id === pfidNum && (Number(s.sid) === amidNum || Number(s.amid) === amidNum)
      );
      if (sumRow && (Number(sumRow.amtinv) > 0 || Number(sumRow.currv) > 0)) {
        setAmount(Number(sumRow.amtinv || sumRow.currv));
      }
    }
  }, [mode, assetId, portfolioIds, amount]);

  const handleSave = async () => {
    if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
    setIsSaving(true);
    try {
      let accountId: any = targetAccountId;
      const acidNum = accountId ? Number(accountId) : undefined;

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

      // Debit FD asset ledger, Credit bank
      const fdLedger = await ensureLedgerExists(title || assetName || 'Fixed Deposit', 'fd', acidNum);
      const fdLedgerId = fdLedger?.id ?? (assetId && Number(assetId) > 0 ? assetId : '500090');
      const amidNum = Number(assetId) > 0 ? Number(assetId) : Number(fdLedgerId);

      if (mode === 'closure') {
        let finalInterestId = '';
        if (interestReceived > 0) {
          const intLedger = ledgers.find((l: any) => l.name?.toLowerCase().includes('interest on fd') || l.name?.toLowerCase().includes('interest on fixed deposit') || (String(l.groupId) === '150' && l.name?.toLowerCase().includes('interest')))
            || await ensureLedgerExists('Interest on Fixed Deposit', 'interest', acidNum);
          finalInterestId = intLedger?.id ?? '';
        }

        let finalTdsId = '';
        if (tdsDeducted > 0) {
          const tdsLedger = ledgers.find((l: any) => l.name?.toLowerCase().includes('tds'))
            || await ensureLedgerExists('TDS', 'tds', acidNum);
          finalTdsId = tdsLedger?.id ?? '';
        }

        const netBankAmount = Number((amount + interestReceived - tdsDeducted).toFixed(2));

        const lines = [
          {
            ledgerId: finalBankId,
            debit: netBankAmount,
            credit: 0,
          },
          ...(tdsDeducted > 0 && finalTdsId ? [{
            ledgerId: finalTdsId,
            debit: tdsDeducted,
            credit: 0,
          }] : []),
          {
            ledgerId: fdLedgerId,
            amid: amidNum,
            debit: 0,
            credit: amount,
            quantity: 1,
            price: amount,
            salePrice: amount,
            saleAmount: amount,
            tradeType: 'SELL',
            atyid: 90,
          },
          ...(interestReceived > 0 && finalInterestId ? [{
            ledgerId: finalInterestId,
            debit: 0,
            credit: interestReceived,
          }] : []),
        ];

        const voucherData = {
          date,
          type: 'journal' as const,
          accountId: acidNum,
          portfolioId: portfolioIds[0],
          assetId,
          narration: narration || `FD Maturity / Closure — ${title || assetName}`,
          title,
          lines,
        };

        if (voucherId && originalVoucher) {
          await updateVoucher({ ...originalVoucher, ...voucherData });
        } else {
          await createVoucher({ id: Math.random().toString(36).substring(2, 11), ...voucherData });
        }
        onSaved();
        return;
      }

      const lines = [
        { 
          ledgerId: fdLedgerId, 
          amid: amidNum, 
          debit: amount, 
          credit: 0,
          quantity: 1,
          price: amount,
          tradeType: 'BUY',
          atyid: 90
        },
        { ledgerId: finalBankId, debit: 0, credit: amount },
      ];

      const voucherData = {
        date,
        type: 'journal' as const,
        accountId: acidNum,
        portfolioId: portfolioIds[0],
        assetId,
        narration: narration || `FD Investment — ${title || assetName}`,
        title,
        lockInPeriod,
        interestRate,
        interestType,
        interestPayment,
        maturityDate,
        lines,
      };

      if (voucherId && originalVoucher) {
        await updateVoucher({ ...originalVoucher, ...voucherData });
      } else {
        await createVoucher({ id: Math.random().toString(36).substring(2, 11), ...voucherData });
      }
      onSaved();
    } catch (e: any) {
      console.error('❌ PMSFDInvestmentModal save failed:', e);
      alert(`Save failed: ${e?.message || 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!voucherId) return;
    if (window.confirm('Are you sure you want to delete this FD investment entry?')) {
      await deleteVoucher(voucherId);
      onSaved();
    }
  };

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
      <div style={{ background: '#fff', width: '600px', maxWidth: '95vw', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: mode === 'investment' ? '#eff6ff' : '#ecfdf5',
              color: mode === 'investment' ? '#1d4ed8' : '#047857',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '6px',
              letterSpacing: '0.5px'
            }}>
              {mode === 'investment' ? 'NEW DEPOSIT' : 'CLOSURE / MATURITY'}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                {mode === 'investment' ? 'Fixed Deposit Investment' : 'Fixed Deposit Closure / Redemption'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{assetName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '5px 10px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
              <FolderOpen size={14} color={mode === 'investment' ? '#3b82f6' : '#10b981'} />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {!voucherId && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', padding: '4px 24px 0 24px', gap: '8px' }}>
            <button
              onClick={() => setMode('investment')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: mode === 'investment' ? '2px solid #2563eb' : '2px solid transparent',
                background: mode === 'investment' ? '#fff' : 'transparent',
                borderRadius: '6px 6px 0 0',
                fontWeight: mode === 'investment' ? 700 : 600,
                color: mode === 'investment' ? '#1d4ed8' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ➕ New Investment
            </button>
            <button
              onClick={() => setMode('closure')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: mode === 'closure' ? '2px solid #059669' : '2px solid transparent',
                background: mode === 'closure' ? '#fff' : 'transparent',
                borderRadius: '6px 6px 0 0',
                fontWeight: mode === 'closure' ? 700 : 600,
                color: mode === 'closure' ? '#047857' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🏁 Close FD / Maturity
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {mode === 'closure' ? (
            /* Closure / Maturity Form */
            <>
              <div style={{ background: '#ecfdf5', borderRadius: '10px', padding: '14px 16px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Bank Credit</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                    ₹{Number((amount + interestReceived - tdsDeducted).toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#047857', textAlign: 'right' }}>
                  Principal: ₹{Number(amount || 0).toLocaleString('en-IN')} <br />
                  + Int: ₹{Number(interestReceived || 0).toLocaleString('en-IN')} - TDS: ₹{Number(tdsDeducted || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Redemption Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Fixed Deposit Name</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="FD Description" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Closure / Maturity Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Principal Amount (₹)</label>
                    <input type="number" step="any" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="0.00" style={{ ...inputStyle, fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Interest Received (₹)</label>
                    <input type="number" step="any" value={interestReceived || ''} onChange={e => setInterestReceived(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>TDS Deducted (₹)</label>
                    <input type="number" step="any" value={tdsDeducted || ''} onChange={e => setTdsDeducted(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Bank / Cash Account (Credited)</label>
                    <select value={bankLedgerId} onChange={e => setBankLedgerId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                      <option value="">Select Bank / Cash Account...</option>
                      {bankLedgers.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Narration</label>
                    <input type="text" value={narration} onChange={e => setNarration(e.target.value)} placeholder="FD Closure / Maturity..." style={inputStyle} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Investment Form */
            <>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Investment Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Title / Description</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HDFC Bank FD — 7.5% 2 Yr" style={inputStyle} />
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

              {/* Transaction Details Section */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Amount (₹)</label>
                    <input type="number" step="any" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="0.00" style={{ ...inputStyle, fontWeight: 700 }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Bank / Cash Account (Source)</label>
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
            </>
          )}
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
            <button onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', borderRadius: '8px', border: 'none', background: isSaving ? '#93c5fd' : (mode === 'closure' ? '#059669' : '#2563eb'), color: '#fff', fontWeight: 700, fontSize: '13px', cursor: isSaving ? 'wait' : 'pointer' }}>
              <Save size={14} /> {isSaving ? 'Processing...' : (mode === 'closure' ? 'Close & Redeem FD' : 'Save Investment')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
