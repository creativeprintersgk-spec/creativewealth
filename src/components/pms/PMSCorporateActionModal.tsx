import React, { useState, useEffect } from 'react';
import { X, Save, Share2, Info, Trash2 } from 'lucide-react';
import { state, buildAssetFifoLedger, depleteFifoLots, FIFO_BUY_TRTY, FIFO_SELL_TRTY, getStoredPortfolios, getStoredLedgers, createVoucher, ensureLedgerExists, getVoucherById, updateVoucher, deleteVoucher } from '../../logic';
import { searchAssets, type AssetMaster } from '../../services/assetMasterService';

interface Props {
  actionType: string; // bonus, split, demerger, merger, ipo, buyback, reinvest, repayment, writeoff, transfer
  assetId: string;
  assetName: string;
  portfolioIds: string[];
  onClose: () => void;
  onSaved: () => void;
  voucherId?: string;
}

export default function PMSCorporateActionModal({
  actionType,
  assetId,
  assetName,
  portfolioIds,
  onClose,
  onSaved,
  voucherId,
}: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [tds, setTds] = useState<number>(0);
  const [narration, setNarration] = useState('');

  // Split/DeMerger/Merger Specifics
  const [qtyBefore, setQtyBefore] = useState<number>(500); // Demo default
  const [qtyAfter, setQtyAfter] = useState<number>(0);
  
  // Search Assets (for Merger/DeMerger)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetMaster[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetMaster | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [costAllocationPct, setCostAllocationPct] = useState<number>(100);

  // Transfer Specifics
  const [destPortfolioId, setDestPortfolioId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const portfolios = getStoredPortfolios();
  const currentPortfolio = portfolios.find(p => String(p.id) === String(portfolioIds[0]));
  const acidNum = currentPortfolio ? Number(currentPortfolio.accountId) : undefined;
  const ledgers = getStoredLedgers(acidNum);

  useEffect(() => {
    if (voucherId) {
      const v = getVoucherById(voucherId);
      if (v) {
        setDate(v.date);
        setNarration(v.narration || '');
        
        // Find main asset line
        const assetLine = v.lines.find((l: any) => {
          const ledger = ledgers.find(acc => String(acc.id) === String(l.ledgerId));
          return ledger && ledger.name.toLowerCase() === assetName.toLowerCase();
        }) || v.lines[0];

        if (actionType === 'bonus') {
          if (assetLine) {
            setQuantity(assetLine.quantity || 0);
          }
        } else if (actionType === 'split') {
          if (assetLine) {
            setQtyAfter(qtyBefore + (assetLine.quantity || 0));
          }
        } else if (actionType === 'merger') {
          const line1 = v.lines.find((l: any) => Number(l.credit) > 0);
          const line2 = v.lines.find((l: any) => Number(l.debit) > 0);
          if (line1) {
            setQtyBefore(line1.quantity || 0);
            setAmount(line1.credit || 0);
          }
          if (line2) {
            setQtyAfter(line2.quantity || 0);
            const mergedLedger = ledgers.find(acc => String(acc.id) === String(line2.ledgerId));
            if (mergedLedger) {
              setSearchQuery(mergedLedger.name);
              setSelectedAsset({ amid: Number(mergedLedger.id), name: mergedLedger.name } as any);
            }
          }
        } else if (actionType === 'demerger') {
          const line = v.lines.find((l: any) => Number(l.debit) > 0);
          if (line) {
            setQtyAfter(line.quantity || 0);
            const demergedLedger = ledgers.find(acc => String(acc.id) === String(line.ledgerId));
            if (demergedLedger) {
              setSearchQuery(demergedLedger.name);
              setSelectedAsset({ amid: Number(demergedLedger.id), name: demergedLedger.name } as any);
            }
            setAmount(line.debit || 0);
          }
        } else if (actionType === 'writeoff') {
          if (assetLine) {
            setQtyBefore(assetLine.quantity || 0);
            setAmount(assetLine.credit || 0);
          }
        } else if (actionType === 'ipo' || actionType === 'reinvest' || actionType === 'repayment') {
          if (assetLine) {
            setQuantity(assetLine.quantity || 0);
            setPrice(assetLine.price || 0);
            setAmount(assetLine.debit || assetLine.credit || 0);
          }
        } else if (actionType === 'buyback') {
          if (assetLine) {
            setQuantity(assetLine.quantity || 0);
            setPrice(assetLine.price || 0);
            setAmount(assetLine.debit || assetLine.credit || 0);
          }
          const tdsLine = v.lines.find((l: any) => {
            const ledger = ledgers.find(acc => String(acc.id) === String(l.ledgerId));
            return ledger && ledger.name.toLowerCase() === 'tds';
          });
          if (tdsLine) {
            setTds(tdsLine.debit || 0);
          }
        } else if (actionType === 'transfer') {
          if (assetLine) {
            setQuantity(assetLine.quantity || 0);
            setAmount(assetLine.credit || 0);
          }
        }
      }
    }
  }, [voucherId, actionType, assetName, ledgers]);

  useEffect(() => {
    // Search asset master
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(() => {
        searchAssets(searchQuery, 50).then(results => {
          setSearchResults(results);
          setShowDropdown(true);
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const handleSave = async () => {
    const pId = portfolioIds[0];
    const dummyId = Math.random().toString(36).substring(2, 11);
    
    if (!acidNum) {
      alert("Error: Portfolio is not linked to any client account!");
      return;
    }
    
    // Resolve asset ledger
    const assetType = Number(assetId) >= 100000 ? 'EQ' : 'MF';
    const groupType = assetType === 'EQ' ? 'stocks' : 'mf_equity';
    const assetLedger = ledgers.find(l => l.name.toLowerCase() === assetName.toLowerCase())
      || await ensureLedgerExists(assetName, groupType, acidNum);
      
    if (!assetLedger) {
      alert("Failed to find or create a ledger for " + assetName);
      return;
    }
    
    const amid = assetLedger?.amid ?? 0;

    const lines: any[] = [];
    let voucherType = 'journal';
    let label = actionType;

    switch (actionType) {
      case 'bonus': {
        label = 'Bonus';
        // Bonus transaction has quantity > 0 but debit/credit = 0.
        // We will create a journal entry with 0 amount but quantity set.
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: 0,
          quantity,
          price: 0
        });
        break;
      }
      case 'split': {
        label = '*Split';
        // A split transaction closes out old quantity (represented by Split Closed in bs1)
        // and adds the new quantity.
        // In acmac1 accounting, we just write a narration or memo ledger entry.
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: 0,
          quantity: qtyAfter - qtyBefore, // net change in quantity
          price: 0
        });
        break;
      }
      case 'merger': {
        label = '*Merged';
        if (!selectedAsset) {
          alert("Please select the target company to merge into.");
          return;
        }
        const mergedLedger = await ensureLedgerExists(selectedAsset.name, 'stocks', acidNum);
        
        // Merging Company (Credit/Reduce quantity to 0)
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: amount || 0,
          quantity: qtyBefore,
          price: 0
        });

        // Merged Into Company (Debit/Increase quantity)
        lines.push({
          ledgerId: mergedLedger?.id ?? "",
          debit: amount || 0,
          credit: 0,
          quantity: qtyAfter,
          price: 0
        });
        break;
      }
      case 'demerger': {
        label = '*DeMerger';
        if (!selectedAsset) {
          alert("Please select the demerged entity.");
          return;
        }
        const demergedLedger = await ensureLedgerExists(selectedAsset.name, 'stocks', acidNum);
        const demergedCost = Number(((amount * costAllocationPct) / 100).toFixed(2));

        // DeMerger (New company - Debit)
        lines.push({
          ledgerId: demergedLedger?.id ?? "",
          debit: demergedCost,
          credit: 0,
          quantity: qtyAfter,
          price: 0
        });

        // Parent Company (Offsetting Credit - transfers cost basis, keeping voucher strictly balanced)
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: demergedCost,
          quantity: 0,
          price: 0
        });
        break;
      }
      case 'ipo': {
        label = 'IPO/Rights';
        voucherType = 'payment';
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || await ensureLedgerExists('Bank', 'bank', acidNum);
        
        lines.push({
          ledgerId: assetLedger.id,
          debit: amount || quantity * price,
          credit: 0,
          quantity,
          price
        });
        lines.push({
          ledgerId: bankLedger?.id ?? "",
          debit: 0,
          credit: amount || quantity * price
        });
        break;
      }
      case 'buyback': {
        label = 'Buyback';
        voucherType = 'receipt';
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || await ensureLedgerExists('Bank', 'bank', acidNum);
        const tdsLedger = ledgers.find(l => l.name.toLowerCase() === 'tds') || await ensureLedgerExists('TDS', 'tds', acidNum);

        const grossAmount = amount || quantity * price;

        // FIFO cost lookup from bs1 for this asset in this portfolio
        const priorTxForAsset = (state.bs1 || [])
          .filter((t: any) => Number(t.pfid) === Number(pId) && t.amid === amid && (t.dt || '') <= (date || '') && (FIFO_BUY_TRTY.has(Number(t.trty)) || FIFO_SELL_TRTY.has(Number(t.trty)) || [85, 45].includes(Number(t.trty))))
          .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trty) - Number(b.trty)));

        const { openLots } = buildAssetFifoLedger(priorTxForAsset, '0001-01-01', date, new Map(), {});
        const { totalCost: fifoCost, matchedLots } = depleteFifoLots(openLots, quantity);

        // Fallback: if no prior buy lot found, cost basis = grossAmount (zero gain)
        const costBasis = fifoCost > 0 ? Number(fifoCost.toFixed(2)) : grossAmount;
        const capitalGain = Number((grossAmount - costBasis).toFixed(2));

        // 1. Credit Stock ledger at cost basis (removes holding at cost, avoiding negative asset ledger balance)
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: costBasis,
          quantity,
          price: quantity > 0 ? costBasis / quantity : 0
        });

        // 2. Determine STCG (460) vs LTCG (465) by holding period of matched lots
        const earliestBuyDate = matchedLots.length > 0 ? matchedLots[0].date : null;
        const holdingDays = earliestBuyDate
          ? Math.floor((new Date(date).getTime() - new Date(earliestBuyDate).getTime()) / 86400000)
          : 0;
        const gainLedgerId = holdingDays >= 365 ? 465 : 460;

        if (Math.abs(capitalGain) > 0.01) {
          if (capitalGain > 0) {
            lines.push({
              ledgerId: gainLedgerId,
              debit: 0,
              credit: capitalGain
            });
          } else {
            lines.push({
              ledgerId: gainLedgerId,
              debit: Math.abs(capitalGain),
              credit: 0
            });
          }
        }

        // 3. Debit Bank for net proceeds received
        lines.push({
          ledgerId: bankLedger?.id ?? "",
          debit: grossAmount - tds,
          credit: 0
        });

        // 4. Debit TDS if applicable
        if (tds > 0) {
          lines.push({
            ledgerId: tdsLedger?.id ?? "",
            debit: tds,
            credit: 0
          });
        }
        break;
      }
      case 'reinvest': {
        label = 'Dividend Reinvest';
        const divIncomeLedger = ledgers.find(l => l.name.toLowerCase().includes('dividend')) || await ensureLedgerExists('Dividend Income', 'dividend', acidNum);
        
        lines.push({
          ledgerId: assetLedger.id,
          debit: amount || quantity * price,
          credit: 0,
          quantity,
          price
        });
        lines.push({
          ledgerId: divIncomeLedger?.id ?? "",
          debit: 0,
          credit: amount || quantity * price
        });
        break;
      }
      case 'repayment': {
        label = 'Repayment of Debt';
        voucherType = 'receipt';
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || await ensureLedgerExists('Bank', 'bank', acidNum);

        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: amount || quantity * price,
          quantity,
          price
        });
        lines.push({
          ledgerId: bankLedger?.id ?? "",
          debit: amount || quantity * price,
          credit: 0
        });
        break;
      }
      case 'writeoff': {
        label = 'Write Off';
        const lossLedger = await ensureLedgerExists('Loss on Write Off', 'indirect_expense', acidNum);
        
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: amount, // original cost to write off
          quantity: qtyBefore,
          price: 0
        });
        lines.push({
          ledgerId: lossLedger?.id ?? "",
          debit: amount,
          credit: 0
        });
        break;
      }
      case 'transfer': {
        label = 'Transfer';
        if (!destPortfolioId) {
          alert("Please select the destination portfolio.");
          return;
        }
        // Transfer involves crediting this portfolio and debiting destination portfolio
        lines.push({
          ledgerId: assetLedger.id,
          debit: 0,
          credit: amount,
          quantity,
          price: amount / quantity
        });
        break;
      }
    }

    setIsSaving(true);
    try {
      const voucherData = {
        id: voucherId || dummyId,
        date,
        type: actionType,
        portfolioId: pId,
        accountId: acidNum,
        narration: narration || `${label} transaction for ${assetName}`,
        lines
      };

      if (voucherId) {
        await updateVoucher(voucherData);
      } else {
        await createVoucher(voucherData);
      }
      onSaved();
    } catch (e) {
      console.error(e);
      alert("Error saving transaction. Check logs.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (voucherId && window.confirm("Are you sure you want to delete this corporate action?")) {
      await deleteVoucher(voucherId);
      onSaved();
    }
  };

  const renderFormFields = () => {
    switch (actionType) {
      case 'bonus':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bonus Shares Quantity</label>
              <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="e.g. 100" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="Optional" style={textareaStyle} rows={3} />
            </div>
          </>
        );
      case 'split':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quantity Before Split</label>
              <input type="number" value={qtyBefore} readOnly style={{ ...inputStyle, background: '#f1f5f9', cursor: 'not-allowed' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quantity After Split</label>
              <input type="number" value={qtyAfter || ''} onChange={e => setQtyAfter(Number(e.target.value))} placeholder="e.g. 1000" style={inputStyle} />
            </div>
          </>
        );
      case 'merger':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Merging into Company</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Search company name..." 
                  style={inputStyle} 
                />
                {showDropdown && searchResults.length > 0 && (
                  <div style={dropdownStyle}>
                    {searchResults.map(asset => (
                      <div 
                        key={asset.amid} 
                        onClick={() => { setSelectedAsset(asset); setSearchQuery(asset.name); setShowDropdown(false); }} 
                        style={dropdownItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        {asset.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Balance Quantity</label>
                <input type="number" value={qtyBefore} readOnly style={{ ...inputStyle, background: '#f1f5f9' }} />
              </div>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Shares After Merger</label>
                <input type="number" value={qtyAfter || ''} onChange={e => setQtyAfter(Number(e.target.value))} placeholder="e.g. 500" style={inputStyle} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Estimated Value (Cost)</label>
              <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="Rs. 0.00" style={inputStyle} />
            </div>
          </>
        );
      case 'demerger':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Demerged Entity (New Company)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Search company name..." 
                  style={inputStyle} 
                />
                {showDropdown && searchResults.length > 0 && (
                  <div style={dropdownStyle}>
                    {searchResults.map(asset => (
                      <div 
                        key={asset.amid} 
                        onClick={() => { setSelectedAsset(asset); setSearchQuery(asset.name); setShowDropdown(false); }} 
                        style={dropdownItemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        {asset.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>New Shares Quantity</label>
                <input type="number" value={qtyAfter || ''} onChange={e => setQtyAfter(Number(e.target.value))} placeholder="e.g. 100" style={inputStyle} />
              </div>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Cost Allocation %</label>
                <input type="number" value={costAllocationPct} onChange={e => setCostAllocationPct(Number(e.target.value))} placeholder="100%" style={inputStyle} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Parent Cost Basis</label>
              <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="Rs. 0.00" style={inputStyle} />
            </div>
          </>
        );
      case 'ipo':
      case 'reinvest':
      case 'repayment':
        return (
          <>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Quantity</label>
                <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Price (NAV)</label>
                <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Total Cost (Amount)</label>
              <input 
                type="number" 
                value={amount || quantity * price || ''} 
                onChange={e => setAmount(Number(e.target.value))} 
                placeholder="Rs. 0.00" 
                style={inputStyle} 
              />
            </div>
          </>
        );
      case 'buyback':
        return (
          <>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Quantity</label>
                <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0" style={inputStyle} />
              </div>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Price</label>
                <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>Gross Amount</label>
                <input 
                  type="number" 
                  value={amount || quantity * price || ''} 
                  onChange={e => setAmount(Number(e.target.value))} 
                  placeholder="0.00" 
                  style={inputStyle} 
                />
              </div>
              <div style={{ flex: 1, ...fieldStyle }}>
                <label style={labelStyle}>TDS Deducted</label>
                <input type="number" value={tds || ''} onChange={e => setTds(Number(e.target.value))} placeholder="0.00" style={inputStyle} />
              </div>
            </div>
          </>
        );
      case 'writeoff':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Shares Quantity to Write Off</label>
              <input type="number" value={qtyBefore} readOnly style={{ ...inputStyle, background: '#f1f5f9' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Total Book Value (Loss)</label>
              <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="Rs. 0.00" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Narration</label>
              <textarea value={narration} onChange={e => setNarration(e.target.value)} placeholder="Reason for write off..." style={textareaStyle} rows={2} />
            </div>
          </>
        );
      case 'transfer':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Destination Portfolio</label>
              <select 
                value={destPortfolioId} 
                onChange={e => setDestPortfolioId(e.target.value)} 
                style={selectStyle}
              >
                <option value="">Select Destination Portfolio...</option>
                {portfolios.filter(p => p.id !== portfolioIds[0]).map(p => (
                  <option key={p.id} value={p.id}>{p.portfolioName}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quantity to Transfer</label>
              <input type="number" value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} placeholder="0" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Cost Allocation Amount</label>
              <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="Rs. 0.00" style={inputStyle} />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const titleMap: Record<string, string> = {
    bonus: 'EQ Bonus Shares',
    split: 'EQ Stocks *Split',
    merger: 'EQ *Merged',
    demerger: 'EQ Stocks *DeMerger',
    ipo: 'EQ IPO/Rights',
    buyback: 'EQ Buyback',
    reinvest: 'EQ Dividend Reinvest',
    repayment: 'EQ Repayment of Debt',
    writeoff: 'EQ Write Off',
    transfer: 'Transfer to another Portfolio',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#ffffff', width: '500px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Title Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
              CORP ACTION
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{titleMap[actionType] || 'Corporate Action'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}><X size={20} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={16} color="#3b82f6" />
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              Asset Name: <strong style={{ color: '#0f172a' }}>{assetName}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Date of Corporate Action</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>

            {renderFormFields()}
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={handleDelete} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: '1px solid #fecaca', 
              background: '#fff', 
              color: '#ef4444', 
              fontSize: '13px', 
              fontWeight: 600, 
              cursor: 'pointer', 
              transition: 'background 0.2s', 
              visibility: voucherId ? 'visible' : 'hidden' 
            }}
          >
            <Trash2 size={16} /> Delete Record
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)', opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <div style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? "Saving..." : "Save Action"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Styling Constants
const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px'
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase' as const
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
  outline: 'none'
};

const selectStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
  background: '#fff',
  outline: 'none'
};

const textareaStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
  outline: 'none',
  resize: 'none' as const
};

const dropdownStyle = {
  position: 'absolute' as const,
  top: '100%',
  left: 0,
  right: 0,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  zIndex: 10,
  maxHeight: '200px',
  overflowY: 'auto' as const,
  marginTop: '4px'
};

const dropdownItemStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid #f1f5f9',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: '#0f172a'
};
