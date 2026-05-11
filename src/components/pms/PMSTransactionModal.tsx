import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen } from 'lucide-react';
import { getVoucherById, updateVoucher, deleteVoucher, getStoredPortfolios, getStoredLedgers, getStoredGroups, ensureLedgerExists, getStoredAccounts } from '../../logic';
import { useFamily } from '../../contexts/FamilyContext';

interface Props {
  voucherId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function PMSTransactionModal({ voucherId, onClose, onSaved }: Props) {
  const [date, setDate] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [broker, setBroker] = useState('Zerodha');
  const [counterLedgerId, setCounterLedgerId] = useState('');
  const [settlementNo, setSettlementNo] = useState('');
  
  // Trades
  const [assetName, setAssetName] = useState('Unknown Asset');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [brokerage, setBrokerage] = useState(0);

  // Charges
  const [stt, setStt] = useState(0);
  const [stampCharges, setStampCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [gst, setGst] = useState(0);
  const [transCharges, setTransCharges] = useState(0);

  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [portfolioName, setPortfolioName] = useState('Unknown Portfolio');
  const [assetType, setAssetType] = useState<'EQ' | 'MF'>('EQ');
  const [narration, setNarration] = useState('');

  const { activeFamily } = useFamily();
  const allAccounts = getStoredAccounts();
  const familyAccounts = allAccounts.filter(a => a.familyId === activeFamily?.id);
  const portfolios = getStoredPortfolios().filter(p => familyAccounts.some(acc => acc.id === p.accountId));
  const ledgers = getStoredLedgers();
  const groups = getStoredGroups();

  useEffect(() => {
    if (voucherId === 'new') {
      const pId = portfolios[0]?.id || '';
      const dummyId = Math.random().toString(36).substring(2, 11);
      
      setOriginalVoucher({
        id: dummyId,
        date: new Date().toISOString().split('T')[0],
        type: 'journal',
        portfolioId: pId,
        narration: '',
        voucherNo: '',
        lines: [
          { debit: 0, credit: 0, quantity: 0, price: 0, ledgerId: '', ledgerName: '' },
          { debit: 0, credit: 0, ledgerId: 'Bank', ledgerName: 'Bank' }
        ]
      });
      setDate(new Date().toISOString().split('T')[0]);
      setVoucherNo('');
      setPortfolioName(portfolios[0]?.portfolioName || '');
      setAssetType('EQ');
      setType('BUY');
    } else if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setOriginalVoucher(v);
        setDate(v.date);
        setVoucherNo(v.voucherNo || '');
        
        const port = portfolios.find(p => p.id === v.portfolioId);
        if (port) setPortfolioName(port.portfolioName);

        const assetLine = v.lines.find((l: any) => l.quantity > 0) || v.lines[0];
        setNarration(v.narration || '');
        
        if (assetLine) {
          const ledger = ledgers.find(l => l.id === assetLine.ledgerId);
          if (ledger) {
            setAssetName(ledger.name);
            let currentGroup = groups.find(g => g.id === ledger.groupId);
            let isMf = false;
            while (currentGroup) {
              if (currentGroup.id.startsWith('mf') || currentGroup.name.toLowerCase().includes('mutual fund')) {
                isMf = true;
                break;
              }
              currentGroup = groups.find(g => g.id === currentGroup.parent);
            }
            setAssetType(isMf ? 'MF' : 'EQ');
          } else {
            setAssetName(assetLine.ledgerName || assetLine.ledgerId); // Assuming ledgerId is name for now if mapping is missing
          }
          setQuantity(assetLine.quantity || 0);
          setPrice(assetLine.price || 0);
          setType(assetLine.debit > 0 ? 'BUY' : 'SELL');
          
          // Find counter ledger (the one without quantity and not a charge)
          const counterLine = v.lines.find((l: any) => l.quantity === 0 && l.ledgerId !== assetLine.ledgerId);
          if (counterLine) setCounterLedgerId(counterLine.ledgerId);
        }
      }
    }
  }, [voucherId]);

  const handleSave = async () => {
    if (!originalVoucher) return;
    
    const isBuy = type === 'BUY';
    const netAmount = isBuy ? tradeAmount + totalCharges : tradeAmount - totalCharges;

    // 1. Resolve Broker/Bank Ledger
    let finalCounterId = counterLedgerId;
    if (!finalCounterId) {
      if (assetType === 'EQ') {
        const brokerLedger = await ensureLedgerExists(broker + " A/c", 'sundry_creditors');
        finalCounterId = brokerLedger.id;
      } else {
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || ledgers[0];
        finalCounterId = bankLedger.id;
      }
    }

    // Resolve Account ID
    let accountId = originalVoucher.accountId;
    if (originalVoucher.portfolioId) {
      const port = portfolios.find(p => p.id === originalVoucher.portfolioId);
      if (port) accountId = port.accountId;
    }

    // 2. Resolve Asset Ledger
    const assetLedger = await ensureLedgerExists(assetName, assetType === 'EQ' ? 'stocks' : 'mf_equity');

    // 3. Build Lines
    const lines = [];
    
    // Asset Line
    lines.push({
      ledgerId: assetLedger.id,
      debit: isBuy ? tradeAmount : 0,
      credit: !isBuy ? tradeAmount : 0,
      quantity,
      price
    });

    // Broker/Bank Line
    lines.push({
      ledgerId: finalCounterId,
      debit: !isBuy ? netAmount : 0,
      credit: isBuy ? netAmount : 0,
    });

    // Charge Lines (Only if > 0)
    if (stt > 0) lines.push({ ledgerId: (await ensureLedgerExists('STT', 'stt')).id, debit: stt, credit: 0 });
    if (brokerage > 0) lines.push({ ledgerId: (await ensureLedgerExists('Brokerage', 'share_txn_charges')).id, debit: brokerage, credit: 0 });
    if (gst > 0) lines.push({ ledgerId: (await ensureLedgerExists('GST on Charges', 'tax_charges_stocks')).id, debit: gst, credit: 0 });
    if (stampCharges > 0) lines.push({ ledgerId: (await ensureLedgerExists('Stamp Charges', 'tax_charges_stocks')).id, debit: stampCharges, credit: 0 });
    if (transCharges > 0) lines.push({ ledgerId: (await ensureLedgerExists('Transaction Charges', 'share_txn_charges')).id, debit: transCharges, credit: 0 });
    if (otherCharges > 0) lines.push({ ledgerId: (await ensureLedgerExists('Other Trade Charges', 'share_txn_charges')).id, debit: otherCharges, credit: 0 });

    const updatedVoucher = {
      ...originalVoucher,
      date,
      narration: narration || `${type} ${quantity} ${assetName} @ ${price}`,
      voucherNo,
      accountId,
      lines
    };

    try {
      await updateVoucher(updatedVoucher);
      onSaved();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      await deleteVoucher(voucherId);
      onSaved();
    }
  };

  const tradeAmount = quantity * price;
  const totalCharges = stt + stampCharges + otherCharges + gst + transCharges + brokerage;
  
  // Total Amount calculation logic based on Buy or Sell
  // If Buy: Payable = Trade Amount + Charges
  // If Sell: Receivable = Trade Amount - Charges
  const finalAmount = type === 'BUY' ? tradeAmount + totalCharges : tradeAmount - totalCharges;

  if (!originalVoucher) return null;

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (assetType === 'MF') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div style={{ background: '#ffffff', width: '750px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          
          {/* Title Bar */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#fef3c7', color: '#b45309', fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
                MF
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                Mutual Fund Transaction
                {voucherId === 'new' && (
                  <button onClick={() => setAssetType('EQ')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Switch to EQ</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <FolderOpen size={16} color="#f59e0b" />
                {portfolioName}
              </div>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
            </div>
          </div>

          <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Transaction Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: type === 'BUY' ? '#16a34a' : '#dc2626', fontWeight: 700, background: '#fff', outline: 'none' }}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>MF Name</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select value={assetName} onChange={e => setAssetName(e.target.value)} style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}>
                  <option value={assetName}>{assetName}</option>
                  {ledgers.map(l => {
                    // Quick check if ledger belongs to an MF group (simplified for UI)
                    const g = groups.find(g => g.id === l.groupId);
                    const isMf = g && (g.id.startsWith('mf') || g.name.toLowerCase().includes('mutual fund'));
                    if (isMf && l.name !== assetName) {
                      return <option key={l.id} value={l.name}>{l.name}</option>;
                    }
                    return null;
                  })}
                </select>
                <button style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>New</button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Bank Account</label>
              <select 
                value={counterLedgerId} 
                onChange={e => setCounterLedgerId(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
              >
                <option value="">Select Bank Account...</option>
                {ledgers.filter(l => {
                  const g = groups.find(g => g.id === l.groupId);
                  return g && (g.id === 'bank' || g.id === 'cash');
                }).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Quantity</label>
                <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>NAV</label>
                <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Stamp Charges</label>
                <input type="number" value={stampCharges || ''} onChange={e => setStampCharges(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Amount</label>
                <div style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', display: 'flex', alignItems: 'center' }}>
                  ₹{fmt(tradeAmount + stampCharges)}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Narration (Optional)</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', resize: 'none' }} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
              <Trash2 size={16} /> Delete Record
            </button>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(245, 158, 11, 0.4)' }}>
                <Save size={16} /> Save Transaction
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '850px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Title Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
              CONTRACT NOTE
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Equity Transaction
              {voucherId === 'new' && (
                <button onClick={() => setAssetType('MF')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>Switch to MF</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <FolderOpen size={16} color="#3b82f6" />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {/* Top Form */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Transaction Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', transition: 'border-color 0.2s' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Broker</label>
                  <select value={broker} onChange={e => setBroker(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff' }}>
                    <option value="Zerodha">Zerodha</option>
                    <option value="Upstox">Upstox</option>
                  </select>
                </div>
                <button style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>New</button>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Broker Ledger / Counter Account</label>
                <select 
                  value={counterLedgerId} 
                  onChange={e => setCounterLedgerId(e.target.value)} 
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
                >
                  <option value="">Select Broker/Bank Account...</option>
                  {ledgers.filter(l => {
                    const g = groups.find(g => g.id === l.groupId);
                    return g && (g.id === 'sundry_creditors' || g.id === 'bank' || g.id === 'cash');
                  }).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Contract Note No.</label>
                <input type="text" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="e.g. CNT-25/26-1045" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Settlement No.</label>
                <input type="text" value={settlementNo} onChange={e => setSettlementNo(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
              </div>
            </div>
          </div>

          {/* Trade Details */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Trade Details
              <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }}></div>
            </div>
            
            {/* The Unified Grid */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Asset / Company Name</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '100px' }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '120px' }}>Quantity</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '120px' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '140px' }}>Trade Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>
                      {voucherId === 'new' ? (
                        <input type="text" value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="Type Asset Name..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontWeight: 600, outline: 'none' }} />
                      ) : (
                        assetName
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <select value={type} onChange={e => setType(e.target.value as any)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: type === 'BUY' ? '#16a34a' : '#dc2626', background: type === 'BUY' ? '#f0fdf4' : '#fef2f2', outline: 'none' }}>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0" style={{ width: '100%', padding: '8px 12px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontWeight: 600, outline: 'none' }} />
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" style={{ width: '100%', padding: '8px 12px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontWeight: 600, outline: 'none' }} />
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                      {fmt(tradeAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charges & Summary Area */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '16px' }}>Statutory & Other Charges</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Brokerage</label>
                  <input type="number" value={brokerage || ''} onChange={e => setBrokerage(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>GST / S. Tax</label>
                  <input type="number" value={gst || ''} onChange={e => setGst(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>STT</label>
                  <input type="number" value={stt || ''} onChange={e => setStt(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Trans. Charges</label>
                  <input type="number" value={transCharges || ''} onChange={e => setTransCharges(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Stamp Charges</label>
                  <input type="number" value={stampCharges || ''} onChange={e => setStampCharges(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Other Charges</label>
                  <input type="number" value={otherCharges || ''} onChange={e => setOtherCharges(Number(e.target.value))} style={{ width: '100px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ background: type === 'BUY' ? '#eff6ff' : '#f0fdf4', border: `1px solid ${type === 'BUY' ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: type === 'BUY' ? '#1e40af' : '#166534', marginBottom: '4px' }}>
                  Total Amount ({type === 'BUY' ? 'Payable' : 'Receivable'})
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: type === 'BUY' ? '#1d4ed8' : '#15803d', letterSpacing: '-0.5px' }}>
                  ₹{fmt(finalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
            <Trash2 size={16} /> Delete Record
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(37, 99, 235, 0.4)' }}>
              <Save size={16} /> Save Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
