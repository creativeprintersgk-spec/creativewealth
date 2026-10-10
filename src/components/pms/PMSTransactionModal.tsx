import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, FolderOpen, Plus, Trash } from 'lucide-react';
import { getVoucherById, updateVoucher, deleteVoucher, getStoredPortfolios, getStoredLedgers, getStoredGroups, ensureLedgerExists, getStoredAccounts, getAccountForPortfolio } from '../../logic';
import { useFamily } from '../../contexts/FamilyContext';
import { searchAssets, type AssetMaster } from '../../services/assetMasterService';
import AddAssetModal from './AddAssetModal';

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
  amid?: number;
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
  const [broker, setBroker] = useState('');
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
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [addAssetTargetIdx, setAddAssetTargetIdx] = useState<number | null>(null);

  const { activeFamily } = useFamily();
  const allAccounts = getStoredAccounts();
  const familyAccounts = allAccounts.filter(a => a.familyId === activeFamily?.id);
  const allPortfolios = React.useMemo(() => getStoredPortfolios(), []);
  const portfolios = React.useMemo(() => {
    const filtered = allPortfolios.filter(p => familyAccounts.some(acc => acc.id === p.accountId));
    return filtered.length > 0 ? filtered : allPortfolios;
  }, [allPortfolios, familyAccounts]);

  const targetAccountId = React.useMemo(() => {
    if (!originalVoucher) return undefined;
    if (originalVoucher.accountId) return String(originalVoucher.accountId);
    if (originalVoucher.portfolioId) {
      const linkedAcid = getAccountForPortfolio(Number(originalVoucher.portfolioId));
      if (linkedAcid) return String(linkedAcid);
      const port = allPortfolios.find(p => String(p.id) === String(originalVoucher.portfolioId));
      if (port && port.accountId) return String(port.accountId);
    }
    return undefined;
  }, [originalVoucher, allPortfolios]);

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
    const defaults = ['Raise Securities', 'Zerodha', 'Upstox', 'MStock', 'R K Global', 'RKSV', 'Kotak Securities Ltd'];
    return Array.from(new Set([...names, ...defaults]));
  }, [ledgers, groups]);

  const isBrokerOrBankOrCash = React.useCallback((l: any) => {
    if (!l) return false;
    const lIdNum = Number(l.id);
    const lNameLower = (l.name || '').toLowerCase().trim();
    // In MProfit, counter ledgers (Bank, Cash, Broker) are in groups 60, 75, 90 or IDs 100001-100099
    if (lIdNum >= 100001 && lIdNum <= 100099) return true;
    if (availableBrokers.some(b => b.toLowerCase() === lNameLower || lNameLower.includes(b.toLowerCase()))) return true;
    if (/^(zerodha|upstox|groww|motilal|kotak|hdfc|icici|mstock|r\s*k\s*global|dhan|angel|sharekhan|nuvama|karvy)/i.test(lNameLower)) return true;

    const g = groups.find(g => String(g.id) === String(l.groupId));
    if (!g) return false;
    const gIdStr = String(g.id);
    const gNameLower = (g.name || '').toLowerCase();
    return (
      gIdStr === '75' ||
      gIdStr === '60' ||
      gIdStr === '90' ||
      gIdStr === 'sundry_creditors' ||
      gIdStr === 'bank' ||
      gIdStr === 'cash' ||
      gNameLower.includes('creditor') ||
      gNameLower.includes('broker') ||
      gNameLower.includes('bank') ||
      gNameLower.includes('cash')
    );
  }, [groups, availableBrokers]);

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
          amid: initialAssetId ? Number(initialAssetId) : undefined,
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
        
        const allPorts = getStoredPortfolios();
        const port = allPorts.find(p => String(p.id) === String(v.portfolioId));
        if (port) setPortfolioName(port.portfolioName || port.investor_name || 'Portfolio');

        // Classify lines to extract trades
        let parsedTrades: TradeRow[] = [];
        let extractedStt = 0;
        let extractedStamp = 0;
        let extractedGst = 0;
        let extractedTrans = 0;
        let extractedBrokerage = 0;
        let extractedOther = 0;
        let extractedCounterId = '';

        const allLedgers = getStoredLedgers(); // Search all ledgers across accounts

        v.lines.forEach((l: any) => {
          const ledgerId = String(l.ledgerId || '');

          // Counter/broker/bank line from formatBs1Voucher — not a charge, skip it
          if (String(l.id || '').startsWith('counter_') || ledgerId.startsWith('counter_')) {
            return;
          }

          // Handle synthetic ledger IDs from MProfit bs1 import (e.g. 'brokerage', 'charges', 'counter_XXXX')
          if (ledgerId === 'brokerage') {
            extractedBrokerage += (l.debit || l.credit || 0);
            return;
          }
          if (ledgerId === 'charges' || ledgerId.startsWith('chrgs_')) {
            extractedOther += (l.debit || l.credit || 0);
            return;
          }

          const ledger = allLedgers.find(a => String(a.id) === ledgerId) || ledgers.find(a => String(a.id) === ledgerId);
          const ledgerName = (ledger ? ledger.name : (l.ledgerName || ledgerId || '')).toLowerCase();
          
          // Synthetic counter ledger IDs from MProfit (100001=R K Global, 100002=RKSV, etc.)
          // and 'mprofit_import' sentinel (set when broker is unknown) — skip these, do not set counter ledger
          const isSyntheticBrokerMaid = !ledger && (
            ledgerId === 'mprofit_import' ||
            (Number(ledgerId) >= 100001 && Number(ledgerId) <= 100010)
          );
          
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
          } else if (
            isSyntheticBrokerMaid ||
            (ledger && isBrokerOrBankOrCash(ledger)) ||
            (!ledger && (ledgerName.includes('broker') || ledgerName.includes('bank') || ledgerName.includes('cash') || availableBrokers.some(b => ledgerName.includes(b.toLowerCase())) || /zerodha|upstox|groww|motilal|kotak|hdfc|icici/i.test(ledgerName)))
          ) {
            // This is the broker/bank counter ledger
            // For real ledgers, record the ID so the broker dropdown is pre-selected
            if (ledger) {
              extractedCounterId = ledgerId;
              const matchedBroker = availableBrokers.find(b => ledgerName.includes(b.toLowerCase())) || (ledger.name ? ledger.name.replace(/\s+A\/c$/i, '').trim() : '');
              if (matchedBroker) setBroker(matchedBroker);
            }
            // For synthetic MProfit maid IDs, broker name is shown via getVoucherById's formatting
          } else {
            const assetGroupIds = [200050, 200051, 200061, 200062, 200075, 200077, 200040, 200070, 200058, 200155, 200150, 200145, 200160, 200095, 200115, 200120, 200135, 200140, 200141, 200195, 36, 75, 50, 60, 61, 62];
            
            let tQty = Number(l.quantity) || 0;
            let tPrice = Number(l.price) || 0;
            const lAmt = Number(l.debit || l.credit || 0);

            // Parse quantity @ price from narration if missing (e.g. "780 @ 109")
            const narrText = (l.narration || v.narration || '').trim();
            const match = narrText.match(/([\d\.,]+)\s*@\s*([\d\.,]+)/);
            if (match) {
              const parsedQ = parseFloat(match[1].replace(/,/g, ''));
              const parsedP = parseFloat(match[2].replace(/,/g, ''));
              if (!isNaN(parsedQ) && parsedQ > 0 && tQty === 0) tQty = parsedQ;
              if (!isNaN(parsedP) && parsedP > 0 && tPrice === 0) tPrice = parsedP;
            }

            const isAsset = Number(ledgerId) >= 100000 || 
                            tQty > 0 || tPrice > 0 || match !== null ||
                            (ledger && assetGroupIds.includes(Number(ledger.groupId))) ||
                            (!ledger && !ledgerName.includes('broker') && !ledgerName.includes('bank') && !ledgerName.includes('cash') && !ledgerName.includes('stt') && !ledgerName.includes('stamp') && !ledgerName.includes('gst') && !ledgerName.includes('charge') && !ledgerName.includes('brokerage'));
            
            if (isAsset) {
              const tradeVal = tQty > 0 && tPrice > 0 ? tQty * tPrice : lAmt;
              const lineOtherCharges = lAmt > tradeVal && tradeVal > 0 ? lAmt - tradeVal : 0;
              if (lineOtherCharges > 0) {
                extractedOther += lineOtherCharges;
              }

              let tradeAmid = l.amid ? Number(l.amid) : ((ledger as any)?.exint1 ? Number((ledger as any).exint1) : undefined);
              if (!tradeAmid && Number(ledgerId) >= 500000) {
                tradeAmid = Number(ledgerId) - 500000;
              }
              if (!tradeAmid && Number(ledgerId) > 0 && Number(ledgerId) < 100000) {
                tradeAmid = Number(ledgerId);
              }

              parsedTrades.push({
                id: String(l.id || Math.random()),
                ledgerId: ledgerId,
                amid: tradeAmid,
                assetName: ledger ? ledger.name : (l.ledgerName || ledgerId || ''),
                type: (l.debit || 0) > 0 ? 'BUY' : 'SELL',
                quantity: tQty,
                price: tPrice,
                amount: tradeVal
              });
            } else {
              extractedOther += lAmt;
            }
          }
        });

        // Also read top-level charge fields stored directly on the voucher (from MProfit bs1 import or prior WealthCore saves)
        if (v.stt && Number(v.stt) > 0 && extractedStt === 0) extractedStt = Number(v.stt);
        if (v.stampCharges && Number(v.stampCharges) > 0 && extractedStamp === 0) extractedStamp = Number(v.stampCharges);
        if (v.brokerage && Number(v.brokerage) > 0 && extractedBrokerage === 0) extractedBrokerage = Number(v.brokerage);
        if (v.gst && Number(v.gst) > 0 && extractedGst === 0) extractedGst = Number(v.gst);
        if (v.transCharges && Number(v.transCharges) > 0 && extractedTrans === 0) extractedTrans = Number(v.transCharges);
        if (v.otherCharges && Number(v.otherCharges) > 0 && extractedOther === 0) extractedOther = Number(v.otherCharges);

        // Determine Asset Type
        let determinedAssetType: 'EQ' | 'MF' = 'EQ';
        if (parsedTrades.length > 0) {
          const firstTrade = parsedTrades[0];
          const ledger = allLedgers.find(l => String(l.id) === String(firstTrade.ledgerId)) || ledgers.find(l => String(l.id) === String(firstTrade.ledgerId));
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
            const ledger = allLedgers.find(l => String(l.id) === String(assetLine.ledgerId)) || ledgers.find(l => String(l.id) === String(assetLine.ledgerId));
            parsedTrades.push({
              id: String(assetLine.id || Math.random()),
              ledgerId: String(assetLine.ledgerId),
              assetName: ledger ? ledger.name : (assetLine.ledgerName || assetLine.ledgerId || ''),
              type: (assetLine.debit || 0) > 0 ? 'BUY' : 'SELL',
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
        if (v.broker) {
          setBroker(v.broker);
        } else if (extractedCounterId) {
          setCounterLedgerId(extractedCounterId);
          const counterLedger = ledgers.find(l => String(l.id) === String(extractedCounterId));
          if (counterLedger) {
            setBroker(counterLedger.name.replace(/\s+A\/c$/i, '').trim());
          }
        } else {
          setBroker('');
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
    if (!accountId && originalVoucher.portfolioId) {
      const linkedAcid = getAccountForPortfolio(Number(originalVoucher.portfolioId));
      if (linkedAcid) accountId = String(linkedAcid);
    }
    if (!accountId && originalVoucher.portfolioId) {
      const port = allPortfolios.find(p => String(p.id) === String(originalVoucher.portfolioId));
      if (port && port.accountId) accountId = port.accountId;
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
      const isTradeBuy = trade.type === 'BUY';
      
      let finalTradeAmount = trade.amount;
      if (isTradeBuy && totalBuysAmount > 0) {
        // Allocate non-STT charges proportionally to BUY trades
        const proportion = trade.amount / totalBuysAmount;
        finalTradeAmount += (nonSttCharges * proportion);
      }

      // Use direct ledgerId (amid) if it's already set — avoids mismatching Gold/Silver/Bond assets
      // to the 'stocks' ledger group which would break bs1 insertion
      const directLedgerId = trade.ledgerId && String(trade.ledgerId).trim() !== ''
        ? trade.ledgerId
        : (await ensureLedgerExists(trade.assetName, assetType === 'EQ' ? 'stocks' : 'mf_equity', acidNum))?.id ?? '';

      lines.push({
        ledgerId: directLedgerId,
        amid: trade.amid,
        debit: isTradeBuy ? finalTradeAmount : 0,
        credit: !isTradeBuy ? trade.amount : 0,
        quantity: trade.quantity,
        price: trade.price,
        tradeType: trade.type // Explicitly pass BUY/SELL to preserve direction even if amount is 0
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

    // Pass direct assetId from the first trade so createVoucher can write bs1 correctly
    // for any asset type (Gold, Silver, Bonds, MF, Stocks, FD, etc.)
    const primaryTradeAssetId = trades[0]?.amid ? String(trades[0].amid) : (trades[0]?.ledgerId || undefined);

    const updatedVoucher = {
      ...originalVoucher,
      date,
      narration: finalNarration,
      voucherNo,
      accountId,
      lines,
      assetId: primaryTradeAssetId,
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
    } finally {
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
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '220px', overflowY: 'auto', marginTop: '4px', textAlign: 'left' }}>
            {searchResults.map(asset => (
              <div
                key={asset.amid}
                onClick={() => {
                  handleTradeChange(idx, 'assetName', asset.name);
                  handleTradeChange(idx, 'ledgerId', String(asset.amid));
                  handleTradeChange(idx, 'amid', asset.amid);
                  setShowDropdown(false);
                  setActiveRowIdx(null);
                }}
                style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{asset.name}</span>
                  {asset.isin && <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>{asset.isin}</span>}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{asset.asset_type_name} {asset.ticker ? `• ${asset.ticker}` : ''}</span>
              </div>
            ))}
            <div
              onMouseDown={e => {
                e.preventDefault();
                setAddAssetTargetIdx(idx);
                setIsAddAssetOpen(true);
                setShowDropdown(false);
              }}
              style={{
                padding: '8px 12px',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderTop: '1px solid #bfdbfe'
              }}
            >
              <Plus size={13} /> + Add New Security (ISIN Mandatory)
            </div>
          </div>
        )}
        {isEditingThisRow && showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>No securities found for "{searchQuery}".</div>
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                setAddAssetTargetIdx(idx);
                setIsAddAssetOpen(true);
                setShowDropdown(false);
              }}
              style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              + Create New Security with ISIN
            </button>
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
              {assetType === 'MF' ? 'Mutual Fund Transaction' : (trades[0]?.assetName ? `${trades[0].assetName} Transaction` : 'Trade Transaction')}
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
                      <option value="">Select Broker...</option>
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
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible' }}>
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
      {isAddAssetOpen && (
        <AddAssetModal
          initialType={assetType === 'MF' ? 'mf' : 'stock'}
          hideTransactionSection={true}
          onClose={() => {
            setIsAddAssetOpen(false);
            setAddAssetTargetIdx(null);
          }}
          onAssetCreated={(newAsset, price) => {
            if (addAssetTargetIdx !== null) {
              handleTradeChange(addAssetTargetIdx, 'assetName', newAsset.name);
              handleTradeChange(addAssetTargetIdx, 'ledgerId', String(newAsset.amid));
              handleTradeChange(addAssetTargetIdx, 'amid', newAsset.amid);
              if (price && price > 0) {
                handleTradeChange(addAssetTargetIdx, 'price', price);
              }
            }
            setIsAddAssetOpen(false);
            setAddAssetTargetIdx(null);
          }}
        />
      )}
    </div>
  );
}
