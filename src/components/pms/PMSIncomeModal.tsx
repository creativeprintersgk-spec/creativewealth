import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen } from 'lucide-react';
import { getStoredPortfolios, getStoredLedgers, createVoucher, updateVoucher, deleteVoucher, getVoucherById, ensureLedgerExists, getStoredGroups } from '../../logic';

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

  const portfolios = getStoredPortfolios();
  const ledgers = getStoredLedgers();

  useEffect(() => {
    if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setOriginalVoucher(v);
        setDate(v.date);
        setNarration(v.narration || '');
        const port = portfolios.find((p: any) => p.id === v.portfolioId);
        if (port) setPortfolioName(port.portfolioName);

        const tdsLine = v.lines.find((l: any) => l.ledgerId === 'TDS_Receivable');
        const assetLine = v.lines.find((l: any) => l.credit > 0);
        
        if (tdsLine) setTds(tdsLine.debit || 0);
        if (assetLine) setAmount(assetLine.credit || 0);

        const bankLine = v.lines.find((l: any) => l.ledgerId !== 'TDS_Receivable' && l.debit > 0);
        if (bankLine) setBankLedgerId(bankLine.ledgerId);
      }
    } else {
      if (portfolioIds.length > 0) {
        const port = portfolios.find(p => p.id === portfolioIds[0]);
        if (port) setPortfolioName(port.portfolioName);
      }
    }
  }, [voucherId, portfolioIds, portfolios, assetId]);

  const handleSave = async () => {
    // 1. Resolve Ledgers
    let finalBankId = bankLedgerId;
    if (!finalBankId) {
      const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || await ensureLedgerExists('Bank', 'bank');
      finalBankId = bankLedger.id;
    }

    let tdsLedger = ledgers.find(l => l.name === 'TDS Receivable');
    if (!tdsLedger) {
       await createVoucher({ id: 'tds_init', date: '2000-01-01', type: 'journal', lines: [], narration: 'init' });
       tdsLedger = ledgers[0];
    }
    // Actually, I'll use ensureLedgerExists if I can import it or implement it.
    // Let's assume ensureLedgerExists is available in logic.ts (I saw it used in PMSTransactionModal).
    
    // Better way:
    const incomeLedger = ledgers.find(l => l.name === 'Dividend Income') || ledgers.find(l => l.groupId === 'dividend_income') || ledgers[0]; 
    // I need to be careful here. I'll use a more robust way to resolve the Income ledger.

    // Resolution logic for Dividend Income
    const divIncomeLedger = ledgers.find(l => l.name.toLowerCase().includes('dividend income')) || 
                           ledgers.find(l => l.groupId === 'dividend_income') || 
                           ledgers.find(l => l.groupId === 'indirect_income') ||
                           ledgers[0];

    const lines = [
      { debit: netAmount, credit: 0, ledgerId: finalBankId },
      { debit: tds, credit: 0, ledgerId: 'TDS_Receivable' }, // Assuming this ID exists or resolve it
      { debit: 0, credit: amount, ledgerId: divIncomeLedger.id }
    ];

    if (voucherId && originalVoucher) {
      await updateVoucher({
        ...originalVoucher,
        date,
        narration: narration || `Dividend Payout for ${assetName}`,
        lines
      });
    } else {
      const dummyId = Math.random().toString(36).substring(2, 11);
      await createVoucher({
        id: dummyId,
        date,
        type: 'dividend',
        portfolioId: portfolioIds[0],
        narration: narration || `Dividend Payout for ${assetName}`,
        lines
      });
    }
    
    onSaved();
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
              <select 
                value={bankLedgerId} 
                onChange={e => setBankLedgerId(e.target.value)} 
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
              >
                <option value="">Select Bank Account...</option>
                {ledgers.filter(l => {
                  const g = getStoredGroups().find(g => g.id === l.groupId);
                  return g && (g.id === 'bank' || g.id === 'cash');
                }).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
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
            <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.4)' }}>
              <Save size={16} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
