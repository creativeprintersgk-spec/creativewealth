import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen } from 'lucide-react';
import { getStoredPortfolios, getStoredLedgers, createVoucher, updateVoucher, deleteVoucher, getVoucherById, ensureLedgerExists, getStoredGroups, getAccountForPortfolio } from '../../logic';

interface Props {
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  voucherId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSIncomeModal({ assetId, assetName, portfolioIds, voucherId, onClose, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [tds, setTds] = useState<number>(0);
  const [narration, setNarration] = useState('');
  
  const [portfolioName, setPortfolioName] = useState('');
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const portfolios = React.useMemo(() => {
    return getStoredPortfolios();
  }, []);

  const targetAccountId = React.useMemo(() => {
    if (portfolioIds && portfolioIds[0]) {
      const port = portfolios.find(p => String(p.id) === String(portfolioIds[0]));
      if (port) return port.accountId;
    }
    return undefined;
  }, [portfolioIds, portfolios]);

  const ledgers = React.useMemo(() => {
    return getStoredLedgers(targetAccountId);
  }, [targetAccountId]);

  const groups = React.useMemo(() => {
    return getStoredGroups(targetAccountId);
  }, [targetAccountId]);

  // Resolve accountId at render time (not just at save time) — used for bank dropdown
  const resolvedAcidForDisplay = React.useMemo(() => {
    const pfidNum = portfolioIds?.[0] ? Number(portfolioIds[0]) : NaN;
    if (isNaN(pfidNum)) return undefined;
    // Try portfolios list first, then direct acc_pflink lookup
    const port = getStoredPortfolios().find(p => String(p.id) === String(pfidNum));
    if (port?.accountId) return Number(port.accountId);
    return getAccountForPortfolio(pfidNum) || undefined;
  }, [portfolioIds]);

  // Ledgers and groups for the correctly resolved account
  const resolvedLedgersForDisplay = React.useMemo(() => {
    return getStoredLedgers(resolvedAcidForDisplay);
  }, [resolvedAcidForDisplay]);

  const resolvedGroupsForDisplay = React.useMemo(() => {
    return getStoredGroups(resolvedAcidForDisplay);
  }, [resolvedAcidForDisplay]);

  // Only match group 60 = Bank Accounts, group 55 = Cash — NOT name-based (prevents matching bank ETFs/NCDs)
  const isBankOrCash = React.useCallback((l: any) => {
    const groupIdStr = String(l.groupId);
    return groupIdStr === '60' || groupIdStr === '55';
  }, []);

  const bankLedgers = React.useMemo(() => resolvedLedgersForDisplay.filter(isBankOrCash), [resolvedLedgersForDisplay, isBankOrCash]);

  // Auto-select first bank if only one exists and none is selected
  React.useEffect(() => {
    if (!bankLedgerId && bankLedgers.length === 1) {
      setBankLedgerId(bankLedgers[0].id);
    }
  }, [bankLedgers, bankLedgerId]);

  useEffect(() => {
    if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setOriginalVoucher(v);
        setDate(v.date);
        setNarration(v.narration || '');
        const port = portfolios.find((p: any) => String(p.id) === String(v.portfolioId));
        if (port) setPortfolioName(port.portfolioName);

        const tdsLine = v.lines.find((l: any) => {
          const ledger = resolvedLedgersForDisplay.find(led => String(led.id) === String(l.ledgerId));
          return ledger && ledger.name.toLowerCase().includes('tds');
        });
        const assetLine = v.lines.find((l: any) => Number(l.credit) > 0);
        
        if (tdsLine) setTds(tdsLine.debit || 0);
        if (assetLine) setAmount(assetLine.credit || 0);

        const bankLine = v.lines.find((l: any) => {
          const ledger = resolvedLedgersForDisplay.find(led => String(led.id) === String(l.ledgerId));
          return ledger && isBankOrCash(ledger);
        });
        if (bankLine) setBankLedgerId(bankLine.ledgerId);
      }
    } else {
      if (portfolioIds.length > 0) {
        const port = portfolios.find(p => String(p.id) === String(portfolioIds[0]));
        if (port) setPortfolioName(port.portfolioName);
      }
    }
  }, [voucherId, portfolioIds, portfolios, assetId, resolvedLedgersForDisplay, isBankOrCash]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Resolve account ID — try portfolio lookup first, then fallback to direct link
      let accountId: string | null | undefined = undefined;
      const pfidNum = portfolioIds?.[0] ? Number(portfolioIds[0]) : NaN;
      
      if (!isNaN(pfidNum)) {
        const port = portfolios.find(p => String(p.id) === String(pfidNum));
        accountId = port?.accountId ?? null;
        // Fallback: direct acc_pflink lookup via getAccountForPortfolio
        if (!accountId) {
          const directAcid = getAccountForPortfolio(pfidNum);
          if (directAcid) accountId = String(directAcid);
        }
      }
      const acidNum = accountId ? Number(accountId) : undefined;

      // Re-fetch ledgers for resolved account (handles case where targetAccountId was wrong at mount)
      const resolvedLedgers = acidNum ? getStoredLedgers(acidNum) : ledgers;
      const resolvedGroups = acidNum ? getStoredGroups(acidNum) : groups;

      // 2. Resolve Bank ledger — use the user's dropdown selection first
      let finalBankId = bankLedgerId;
      if (!finalBankId) {
        // Auto-pick first bank/cash from resolved ledgers
        const bankLedger = resolvedLedgers.find(l => l.name.toLowerCase().includes('bank') && !l.name.toLowerCase().includes('unassigned')) 
                        || resolvedLedgers.find(l => l.name.toLowerCase().includes('cash') && !l.name.toLowerCase().includes('unassigned'))
                        || await ensureLedgerExists('Bank', 'bank', acidNum);
        finalBankId = bankLedger?.id ?? '';
      }
      if (!finalBankId) throw new Error('Please select a Bank Account for this dividend. Go back and pick one from the Bank A/c dropdown.');

      // 3. Resolve TDS ledger
      let tdsLedger: any = resolvedLedgers.find(l => l.name.toLowerCase() === 'tds') 
                      || resolvedLedgers.find(l => l.name.toLowerCase().includes('tds'));
      if (!tdsLedger && tds > 0) {
        tdsLedger = await ensureLedgerExists('TDS', 'tds', acidNum);
      }
      const finalTdsId = tdsLedger?.id ?? '';

      // 4. Resolve Dividend Income ledger — MUST exist for BS to show it
      let divIncomeLedger: any = resolvedLedgers.find(l => l.name.toLowerCase().includes('dividend')) 
                               || resolvedLedgers.find(l => {
                                    const g = resolvedGroups.find(g => String(g.id) === String(l.groupId));
                                    return g && (g.name.toLowerCase().includes('dividend') || g.name.toLowerCase().includes('income'));
                                  });
      if (!divIncomeLedger) {
        divIncomeLedger = await ensureLedgerExists('Dividend Income', 'dividend', acidNum);
      }
      if (!divIncomeLedger?.id) throw new Error('Could not find or create a Dividend Income ledger.');

      // 5. Build lines — skip zero-amount legs
      const lines: any[] = [
        { debit: netAmount, credit: 0, ledgerId: finalBankId },
        ...(tds > 0 && finalTdsId ? [{ debit: tds, credit: 0, ledgerId: finalTdsId }] : []),
        { debit: 0, credit: amount, ledgerId: divIncomeLedger.id }
      ];

      if (voucherId && originalVoucher) {
        await updateVoucher({
          ...originalVoucher,
          date,
          type: 'dividend',
          accountId: acidNum,
          narration: narration || `Dividend Payout for ${assetName}`,
          assetId,
          lines
        });
      } else {
        const dummyId = Math.random().toString(36).substring(2, 11);
        await createVoucher({
          id: dummyId,
          date,
          type: 'dividend',
          accountId: acidNum,
          portfolioId: portfolioIds[0],
          narration: narration || `Dividend Payout for ${assetName}`,
          assetId,
          lines
        });
      }
      onSaved();
    } catch (e: any) {
      console.error('❌ PMSIncomeModal save failed:', e);
      alert(`Save failed: ${e?.message || 'Unknown error'}. Check console for details.`);
      setIsSaving(false);
    }
  };


  const netAmount = amount - tds;
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '600px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Title Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
              EQ
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Income for the Asset</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <FolderOpen size={16} color="#f59e0b" />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Transaction:</label>
              <select style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}>
                <option value="Dividend Payout">Dividend Payout</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Income for Asset:</label>
              <div style={{ flex: 1, display: 'flex', gap: '12px' }}>
                <select style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}>
                  <option value={assetName}>{assetName}</option>
                  {ledgers.filter(l => l.groupId === 'stocks').map(l => (
                    l.name !== assetName && <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
                <button style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>New</button>
              </div>
            </div>

            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Bank A/c:</label>
              {bankLedgers.length === 0 ? (
                <div style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ No bank accounts found for this portfolio. Please ensure account is linked.
                </div>
              ) : (
                <select 
                  value={bankLedgerId} 
                  onChange={e => setBankLedgerId(e.target.value)} 
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: bankLedgerId ? '1px solid #cbd5e1' : '2px solid #f59e0b', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
                >
                  {bankLedgers.length > 1 && <option value="">Select Bank Account...</option>}
                  {bankLedgers.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Date:</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Amount:</label>
              <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} style={{ width: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', textAlign: 'right' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>TDS:</label>
              <input type="number" value={tds || ''} onChange={e => setTds(Number(e.target.value))} style={{ width: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', textAlign: 'right' }} />
              
              <div style={{ marginLeft: '16px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Net Amount:</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginLeft: '8px' }}>
                {fmt(netAmount)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <label style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: '#475569', marginTop: '10px' }}>Narration:</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} rows={3} style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', resize: 'none' }} />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={async () => {
            if (voucherId && window.confirm("Are you sure you want to delete this dividend entry?")) {
              await deleteVoucher(voucherId);
              onSaved();
            }
          }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', visibility: voucherId ? 'visible' : 'hidden' }}>
            <Trash2 size={16} /> Delete Record
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.4)', opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <div style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

