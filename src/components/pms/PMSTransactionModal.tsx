import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen, Plus, Trash } from 'lucide-react';
import { getVoucherById, updateVoucher, deleteVoucher, getStoredPortfolios, getStoredLedgers, getStoredGroups, ensureLedgerExists, getStoredAccounts } from '../../logic';
import { useFamily } from '../../contexts/FamilyContext';
import { searchAssets, type AssetMaster } from '../../services/assetMasterService';

interface Props {
  voucherId: string;
  onClose: () => void;
  onSaved: () => void;
  initialAssetId?: string;
  initialAssetName?: string;
  initialPortfolioId?: string;
}

interface TradeRow {
  id: string;
  ledgerId: string;
  assetName: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  amount: number;
}

export default function PMSTransactionModal({
  voucherId,
  onClose,
  onSaved,
  initialAssetId,
  initialAssetName,
  initialPortfolioId,
}: Props) {
  const [date, setDate] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [broker, setBroker] = useState('Zerodha');
  const [counterLedgerId, setCounterLedgerId] = useState('');
  const [settlementNo, setSettlementNo] = useState('');
  
  // Trades Grid State
  const [trades, setTrades] = useState<TradeRow[]>([]);

  // Charges
  const [stt, setStt] = useState(0);
  const [stampCharges, setStampCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [gst, setGst] = useState(0);
  const [transCharges, setTransCharges] = useState(0);
  const [brokerage, setBrokerage] = useState(0);

  const [originalVoucher, setOriginalVoucher] = useState<any>(null);
  const [portfolioName, setPortfolioName] = useState('Unknown Portfolio');
  const [assetType, setAssetType] = useState<'EQ' | 'MF'>('EQ');
  const [narration, setNarration] = useState('');

  // Asset Search State
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetMaster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { activeFamily } = useFamily();
  const allAccounts = getStoredAccounts();
  const familyAccounts = allAccounts.filter(a => a.familyId === activeFamily?.id);
  const portfolios = React.useMemo(() => {
    return getStoredPortfolios().filter(p => familyAccounts.some(acc => acc.id === p.accountId));
  }, [familyAccounts]);

  const targetAccountId = React.useMemo(() => {
    if (!originalVoucher) return undefined;
    if (originalVoucher.accountId) return originalVoucher.accountId;
    if (originalVoucher.portfolioId) {
      const port = portfolios.find(p => String(p.id) === String(originalVoucher.portfolioId));
      if (port) return port.accountId;
    }
    return undefined;
  }, [originalVoucher, portfolios]);

  const ledgers = React.useMemo(() => {
    return getStoredLedgers(targetAccountId);
  }, [targetAccountId]);

  const groups = React.useMemo(() => {
    return getStoredGroups(targetAccountId);
  }, [targetAccountId]);

  const availableBrokers = React.useMemo(() => {
    const creditors = ledgers.filter(l => {
      const g = groups.find(g => String(g.id) === String(l.groupId));
      return g && (String(g.id) === '75' || String(g.id) === 'sundry_creditors');
    });
    const names = creditors.map(c => c.name.replace(/\s+A\/c$/i, '').trim());
    const defaults = ['Zerodha', 'Upstox', 'MStock', 'R K Global'];
    return Array.from(new Set([...names, ...defaults]));
  }, [ledgers, groups]);

  const isBrokerOrBankOrCash = React.useCallback((l: any) => {
    const g = groups.find(g => String(g.id) === String(l.groupId));
    if (!g) return false;
    const gIdStr = String(g.id);
    const gNameLower = (g.name || '').toLowerCase();
    return (
      gIdStr === '75' ||
      gIdStr === '60' ||
      gIdStr === 'sundry_creditors' ||
      gIdStr === 'bank' ||
      gIdStr === 'cash' ||
      gNameLower.includes('creditor') ||
      gNameLower.includes('broker') ||
      gNameLower.includes('bank') ||
      gNameLower.includes('cash')
    );
  }, [groups]);

  useEffect(() => {
    if (voucherId === 'new') {
      const pId = initialPortfolioId || portfolios[0]?.id || '';
      const dummyId = Math.random().toString(36).substring(2, 11);
      
      setOriginalVoucher({
        id: dummyId,
        date: new Date().toISOString().split('T')[0],
        type: 'journal',
        portfolioId: pId,
        narration: '',
        voucherNo: '',
        lines: []
      });
      setDate(new Date().toISOString().split('T')[0]);
      setVoucherNo('');
      setPortfolioName(portfolios.find(p => String(p.id) === String(pId))?.portfolioName || portfolios[0]?.portfolioName || '');
      
      // Resolve asset type
      const currentLedger = ledgers.find(l => l.amid === Number(initialAssetId));
      let isMf = false;
      if (currentLedger) {
        let currentGroup = groups.find(g => g.id === currentLedger.groupId);
        while (currentGroup) {
          if (String(currentGroup.id).startsWith('mf') || currentGroup.name.toLowerCase().includes('mutual fund')) {
            isMf = true;
            break;
          }
          currentGroup = groups.find(g => g.id === currentGroup?.parent);
        }
      }
      setAssetType(isMf ? 'MF' : 'EQ');

      setTrades([
        {
          id: 'initial',
          ledgerId: initialAssetId ? String(initialAssetId) : '',
          assetName: initialAssetName || '',
          type: 'BUY',
          quantity: 0,
          price: 0,
          amount: 0
        }
      ]);
      setStt(0);
      setStampCharges(0);
      setOtherCharges(0);
      setGst(0);
      setTransCharges(0);
      setBrokerage(0);
      setNarration('');
      setCounterLedgerId('');
    } else if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setOriginalVoucher(v);
        setDate(v.date);
        setVoucherNo(v.voucherNo || '');
        setNarration(v.narration || '');
        
        const port = portfolios.find(p => String(p.id) === String(v.portfolioId));
        if (port) setPortfolioName(port.portfolioName);

        // Classify lines to extract trades
        let parsedTrades: TradeRow[] = [];
        let extractedStt = 0;
        let extractedStamp = 0;
        let extractedGst = 0;
        let extractedTrans = 0;
        let extractedBrokerage = 0;
        let extractedOther = 0;
        let extractedCounterId = '';

        v.lines.forEach((l: any) => {
          const ledger = ledgers.find(a => String(a.id) === String(l.ledgerId));
          const ledgerName = (ledger ? ledger.name : (l.ledgerName || l.ledgerId || '')).toLowerCase();
          
          if (ledgerName.includes('stt')) {
            extractedStt += (l.debit || l.credit || 0);
          } else if (ledgerName.includes('stamp')) {
            extractedStamp += (l.debit || l.credit || 0);
          } else if (ledgerName.includes('gst') || ledgerName.includes('service tax')) {
            extractedGst += (l.debit || l.credit || 0);
          } else if (ledgerName.includes('trans. charge') || ledgerName.includes('transaction charge') || ledgerName.includes('exchange charge')) {
            extractedTrans += (l.debit || l.credit || 0);
          } else if (ledgerName.includes('brokerage')) {
            extractedBrokerage += (l.debit || l.credit || 0);
          } else if (ledgerName.includes('gain') || ledgerName.includes('loss') || ledgerName.includes('stcg') || ledgerName.includes('ltcg')) {
            // Ignore capital gains
          } else if (ledger && isBrokerOrBankOrCash(ledger)) {
            extractedCounterId = String(l.ledgerId);
          } else {
            const isAsset = Number(l.ledgerId) >= 100000 || 
                            (ledger && [200050, 200051, 200061, 200062, 50, 60, 61, 62].includes(Number(ledger.groupId)));
            if (isAsset) {
              const tQty = Number(l.quantity) || 0;
              const tPrice = Number(l.price) || 0;
              const lAmt = Number(l.debit || l.credit || 0);
              
              parsedTrades.push({
                id: String(l.id || Math.random()),
                ledgerId: String(l.ledgerId),
                assetName: ledger ? ledger.name : (l.ledgerName || l.ledgerId || ''),
                type: l.debit > 0 ? 'BUY' : 'SELL',
                quantity: tQty,
                price: tPrice,
                amount: lAmt
              });
            } else {
              extractedOther += (l.debit || l.credit || 0);
            }
          }
        });

        // Determine Asset Type
        let determinedAssetType: 'EQ' | 'MF' = 'EQ';
        if (parsedTrades.length > 0) {
          const firstTrade = parsedTrades[0];
          const ledger = ledgers.find(l => String(l.id) === String(firstTrade.ledgerId));
          if (ledger) {
            let currentGroup = groups.find(g => g.id === ledger.groupId);
            while (currentGroup) {
              if (String(currentGroup.id).startsWith('mf') || currentGroup.name.toLowerCase().includes('mutual fund')) {
                determinedAssetType = 'MF';
                break;
              }
              currentGroup = groups.find(g => g.id === currentGroup?.parent);
            }
          }
        }
        setAssetType(determinedAssetType);

        if (parsedTrades.length === 0 && v.lines.length > 0) {
          const assetLine = v.lines.find((l: any) => l.quantity > 0) || v.lines[0];
          if (assetLine) {
            const ledger = ledgers.find(l => String(l.id) === String(assetLine.ledgerId));
            parsedTrades.push({
              id: String(assetLine.id || Math.random()),
              ledgerId: String(assetLine.ledgerId),
              assetName: ledger ? ledger.name : (assetLine.ledgerName || assetLine.ledgerId || ''),
              type: assetLine.debit > 0 ? 'BUY' : 'SELL',
              quantity: assetLine.quantity || 0,
              price: assetLine.price || 0,
              amount: (assetLine.quantity || 0) * (assetLine.price || 0)
            });
          }
        }

        setTrades(parsedTrades);
        setStt(extractedStt);
        setStampCharges(extractedStamp);
        setGst(extractedGst);
        setTransCharges(extractedTrans);
        setBrokerage(extractedBrokerage);
        setOtherCharges(extractedOther);
        if (extractedCounterId) {
          setCounterLedgerId(extractedCounterId);
          const counterLedger = ledgers.find(l => String(l.id) === String(extractedCounterId));
          if (counterLedger) {
            setBroker(counterLedger.name.replace(/\s+A\/c$/i, '').trim());
          }
        }
      }
    }
  }, [voucherId]);

  useEffect(() => {
    if (activeRowIdx !== null && searchQuery.trim().length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        searchAssets(searchQuery, assetType === 'EQ' ? 50 : 60).then(results => {
          setSearchResults(results);
          setIsSearching(false);
          setShowDropdown(true);
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery, activeRowIdx, assetType]);

  const handleAddTrade = () => {
    setTrades(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 11),
        ledgerId: '',
        assetName: '',
        type: 'BUY',
        quantity: 0,
        price: 0,
        amount: 0
      }
    ]);
  };

  const handleRemoveTrade = (idx: number) => {
    setTrades(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTradeChange = (idx: number, field: keyof TradeRow, value: any) => {
    setTrades(prev => {
      const updated = [...prev];
      const t = { ...updated[idx], [field]: value } as TradeRow;
      if (field === 'quantity' || field === 'price') {
        t.amount = Number(t.quantity || 0) * Number(t.price || 0);
      }
      updated[idx] = t;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!originalVoucher) return;
    if (trades.length === 0) {
      alert("Please add at least one trade.");
      return;
    }
    setIsSaving(true);

    const totalBuysAmount = trades
      .filter(t => t.type === 'BUY')
      .reduce((sum, t) => sum + (t.quantity * t.price || 0), 0);

    const totalSellsAmount = trades
      .filter(t => t.type === 'SELL')
      .reduce((sum, t) => sum + (t.quantity * t.price || 0), 0);

    const totalCharges = stt + stampCharges + otherCharges + gst + transCharges + brokerage;
    const finalAmount = totalBuysAmount + totalCharges - totalSellsAmount;

    // Resolve Account ID
    let accountId = originalVoucher.accountId;
    if (originalVoucher.portfolioId) {
      const port = portfolios.find(p => String(p.id) === String(originalVoucher.portfolioId));
      if (port) accountId = port.accountId;
    }
    const acidNum = accountId ? Number(accountId) : (targetAccountId ? Number(targetAccountId) : undefined);

    // 1. Resolve Broker/Bank Ledger
    let finalCounterId = counterLedgerId;
    if (!finalCounterId) {
      if (assetType === 'EQ') {
        let brokerLedger: any = ledgers.find(l => 
          l.acid === acidNum && 
          (l.name.toLowerCase() === broker.toLowerCase() || 
           l.name.toLowerCase() === (broker + " a/c").toLowerCase() ||
           l.name.toLowerCase().replace(/\s+a\/c$/, '') === broker.toLowerCase())
        );
        if (!brokerLedger) {
          brokerLedger = await ensureLedgerExists(broker, 'sundry_creditors', acidNum);
        }
        finalCounterId = brokerLedger?.id ?? "";
      } else {
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || ledgers[0];
        finalCounterId = bankLedger?.id ?? "";
      }
    }

    // 2. Build Lines Array
    const lines = [];

    // Trade Asset Lines
    const nonSttCharges = stampCharges + otherCharges + gst + transCharges + brokerage;
    for (const trade of trades) {
      const assetLedger = await ensureLedgerExists(trade.assetName, assetType === 'EQ' ? 'stocks' : 'mf_equity', acidNum);
      const isTradeBuy = trade.type === 'BUY';
      
      let finalTradeAmount = trade.amount;
      if (isTradeBuy && totalBuysAmount > 0) {
        // Allocate non-STT charges proportionally to BUY trades
        const proportion = trade.amount / totalBuysAmount;
        finalTradeAmount += (nonSttCharges * proportion);
      }

      lines.push({
        ledgerId: assetLedger?.id ?? "",
        debit: isTradeBuy ? finalTradeAmount : 0,
        credit: !isTradeBuy ? trade.amount : 0,
        quantity: trade.quantity,
        price: trade.price
      });
    }

    // Broker / Bank Settlement Line
    const absFinalAmt = Math.abs(finalAmount);
    if (finalAmount >= 0) {
      // Net Payable -> Credit Counter
      lines.push({
        ledgerId: finalCounterId,
        debit: 0,
        credit: absFinalAmt,
        quantity: 0,
        price: 0
      });
    } else {
      // Net Receivable -> Debit Counter
      lines.push({
        ledgerId: finalCounterId,
        debit: absFinalAmt,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }

    // Charge Lines (Only if > 0)
    if (stt > 0) {
      const sttName = assetType === 'MF' ? 'STT-MF' : 'STT-EQ';
      lines.push({ ledgerId: (await ensureLedgerExists(sttName, "stt", acidNum))?.id ?? "", debit: stt, credit: 0 });
    }
    // Note: Other charges (brokerage, gst, stampCharges, transCharges, otherCharges)
    // are now allocated proportionally to the BUY asset trade lines in the section below.

    const narrationParts = trades.map(t => `${t.type} ${t.quantity} ${t.assetName}`);
    const defaultNarr = `${narrationParts.join(', ')}`;
    const finalNarration = narration || (voucherNo ? `Share Contract Note,  No.:${voucherNo}` : `Contract Note - ${defaultNarr}`);

    const updatedVoucher = {
      ...originalVoucher,
      date,
      narration: finalNarration,
      voucherNo,
      accountId,
      lines,
      type: originalVoucher?.type || (assetType === 'MF' ? 'contra' : 'journal'),
      stt,
      stampCharges,
      brokerage,
      gst,
      otherCharges,
      transCharges
    };

    try {
      await updateVoucher(updatedVoucher);
      onSaved();
    } catch (e: any) {
      console.error('❌ PMSTransactionModal save failed:', e);
      alert(`Save failed: ${e?.message || 'Unknown error'}. Check console for details.`);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      await deleteVoucher(voucherId);
      onSaved();
    }
  };

  const renderAssetPicker = (trade: TradeRow, idx: number) => {
    const isEditingThisRow = activeRowIdx === idx;
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={isEditingThisRow ? searchQuery : trade.assetName}
          onChange={e => {
            setSearchQuery(e.target.value);
            handleTradeChange(idx, 'assetName', e.target.value);
            setActiveRowIdx(idx);
          }}
          onFocus={() => {
            setSearchQuery(trade.assetName);
            setActiveRowIdx(idx);
            if (trade.assetName.trim().length >= 2) {
              setShowDropdown(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (activeRowIdx === idx) {
                setActiveRowIdx(null);
                setShowDropdown(false);
              }
            }, 250);
          }}
          placeholder="Type Asset Name (min 2 chars)..."
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, outline: 'none', background: '#fff' }}
        />
        {isEditingThisRow && showDropdown && searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '4px', textAlign: 'left' }}>
            {searchResults.map(asset => (
              <div
                key={asset.amid}
                onClick={() => {
                  handleTradeChange(idx, 'assetName', asset.name);
                  handleTradeChange(idx, 'ledgerId', String(asset.amid));
                  setShowDropdown(false);
                  setActiveRowIdx(null);
                }}
                style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{asset.name}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{asset.asset_type_name} {asset.ticker ? `• ${asset.ticker}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const totalBuysAmount = trades
    .filter(t => t.type === 'BUY')
    .reduce((sum, t) => sum + (t.quantity * t.price || 0), 0);

  const totalSellsAmount = trades
    .filter(t => t.type === 'SELL')
    .reduce((sum, t) => sum + (t.quantity * t.price || 0), 0);

  const totalCharges = stt + stampCharges + otherCharges + gst + transCharges + brokerage;
  const isNetPayable = totalBuysAmount + totalCharges >= totalSellsAmount;
  const finalAmount = isNetPayable 
    ? (totalBuysAmount + totalCharges - totalSellsAmount) 
    : (totalSellsAmount - totalBuysAmount - totalCharges);

  if (!originalVoucher) return null;

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '950px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        
        {/* Title Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: assetType === 'EQ' ? '#eff6ff' : '#fef3c7', color: assetType === 'EQ' ? '#1d4ed8' : '#b45309', fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
              {assetType === 'EQ' ? 'CONTRACT NOTE' : 'MF CONTRA'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {assetType === 'EQ' ? 'Equity Transaction' : 'Mutual Fund Transaction'}
              {voucherId === 'new' && (
                <button onClick={() => setAssetType(t => t === 'EQ' ? 'MF' : 'EQ')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>
                  Switch to {assetType === 'EQ' ? 'MF' : 'EQ'}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <FolderOpen size={16} color={assetType === 'EQ' ? '#3b82f6' : '#f59e0b'} />
              {portfolioName}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {/* Top Form */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Transaction Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', fontWeight: 600 }} />
              </div>
              
              {assetType === 'EQ' ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Broker</label>
                    <select value={broker} onChange={e => setBroker(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}>
                      {availableBrokers.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={async () => {
                    const name = prompt("Enter new Broker name:");
                    if (name) {
                      const newBroker = await ensureLedgerExists(name, 'sundry_creditors', targetAccountId ? Number(targetAccountId) : undefined);
                      if (newBroker) setBroker(newBroker.name);
                    }
                  }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>New</button>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Bank / Cash Account</label>
                  <select 
                    value={counterLedgerId} 
                    onChange={e => setCounterLedgerId(e.target.value)} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
                  >
                    <option value="">Select Bank/Cash Account...</option>
                    {ledgers.filter(l => {
                      const g = groups.find(g => String(g.id) === String(l.groupId));
                      return g && (String(g.id) === 'bank' || String(g.id) === 'cash');
                    }).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Contract Note / Reference No.</label>
                <input type="text" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="e.g. CNT-25/26-1045" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', fontWeight: 600 }} />
              </div>
              
              {assetType === 'EQ' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Broker Ledger / Counter Account</label>
                  <select 
                    value={counterLedgerId} 
                    onChange={e => setCounterLedgerId(e.target.value)} 
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 600 }}
                  >
                    <option value="">Select Broker Account...</option>
                    {ledgers.filter(isBrokerOrBankOrCash).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Settlement No. (Optional)</label>
                  <input type="text" value={settlementNo} onChange={e => setSettlementNo(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
                </div>
              )}
            </div>
          </div>

          {/* Trade Details */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Trade Details
              <div style={{ height: '1px', flex: 1, background: '#e2e8f0' }}></div>
              <button 
                onClick={handleAddTrade} 
                className="btn-primary" 
                style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px' }}
              >
                <Plus size={12} /> Add Trade Line
              </button>
            </div>
            
            {/* Trades Grid Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Asset / Company Name</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '100px' }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '120px' }}>Quantity</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '120px' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '140px' }}>Trade Value</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, idx) => (
                    <tr key={trade.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {renderAssetPicker(trade, idx)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <select 
                          value={trade.type} 
                          onChange={e => handleTradeChange(idx, 'type', e.target.value as any)} 
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: trade.type === 'BUY' ? '#16a34a' : '#dc2626', background: trade.type === 'BUY' ? '#f0fdf4' : '#fef2f2', outline: 'none', cursor: 'pointer' }}
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input type="number" step="any" value={trade.quantity || ''} onChange={e => handleTradeChange(idx, 'quantity', Number(e.target.value))} placeholder="0" style={{ width: '100%', padding: '6px 10px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <input type="number" step="any" value={trade.price || ''} onChange={e => handleTradeChange(idx, 'price', Number(e.target.value))} placeholder="0.00" style={{ width: '100%', padding: '6px 10px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                        ₹{fmt(trade.amount)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleRemoveTrade(idx)} 
                          disabled={trades.length === 1}
                          style={{ background: 'transparent', border: 'none', cursor: trades.length === 1 ? 'not-allowed' : 'pointer', color: trades.length === 1 ? '#cbd5e1' : '#ef4444', padding: '4px' }}
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charges & Summary Area */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '16px' }}>Statutory & Other Charges</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Brokerage</label>
                  <input type="number" value={brokerage || ''} onChange={e => setBrokerage(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>GST / S. Tax</label>
                  <input type="number" value={gst || ''} onChange={e => setGst(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>STT</label>
                  <input type="number" value={stt || ''} onChange={e => setStt(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Trans. Charges</label>
                  <input type="number" value={transCharges || ''} onChange={e => setTransCharges(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Stamp Charges</label>
                  <input type="number" value={stampCharges || ''} onChange={e => setStampCharges(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Other Charges</label>
                  <input type="number" value={otherCharges || ''} onChange={e => setOtherCharges(Number(e.target.value))} style={{ width: '120px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'right', fontSize: '13px', outline: 'none', fontWeight: 600 }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: isNetPayable ? '#eff6ff' : '#f0fdf4', border: `1px solid ${isNetPayable ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: isNetPayable ? '#1e40af' : '#166534', marginBottom: '4px' }}>
                  Total Amount ({isNetPayable ? 'Net Payable' : 'Net Receivable'})
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: isNetPayable ? '#1d4ed8' : '#15803d', letterSpacing: '-0.5px' }}>
                  ₹{fmt(finalAmount)}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Narration (Optional)</label>
                <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="If left blank, a description will be auto-generated." rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', outline: 'none', resize: 'none' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={handleDelete} disabled={voucherId === 'new'} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', opacity: voucherId === 'new' ? 0.5 : 1 }}>
            <Trash2 size={16} /> Delete Record
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: assetType === 'EQ' ? '#2563eb' : '#f59e0b', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: assetType === 'EQ' ? '0 1px 3px rgba(37, 99, 235, 0.4)' : '0 1px 3px rgba(245, 158, 11, 0.4)', opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <div style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
