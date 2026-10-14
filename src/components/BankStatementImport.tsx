/**
 * WealthCore — Bank Statement Import Component
 * 
 * Comprehensive Bank Statement Import with:
 * - PDF / CSV / Excel Auto-Detection (Kotak Mahindra, IDFC FIRST, HDFC, ICICI, etc.)
 * - Automatic Account Number, Bank Name, and Family Member Recognition
 * - Mapping Memory (remembers account mappings in localStorage for future imports)
 * - Smart Narration Rules (e.g. "CREATIVE PRINTERS" -> Creative Printers ledger)
 * - 1-Click Rule Creation directly from any row
 * - Strict Duplicate Detection:
 *   - Existing double-entry vouchers by bank, date (+/- 4 days), and amount
 *   - Dividend Recon & PMS deduplication (recognises amount + company name from narration)
 * - Staging Grid with Counterpart Ledger Tagging & Validation
 * - Double-Entry Posting (generates authentic Payment, Receipt, and Contra vouchers)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Plus, 
  Trash2, Search, Sliders, CheckSquare, Square, Zap, ChevronDown, 
  ArrowRight, ShieldCheck, HelpCircle, X, ExternalLink, Filter, Building2,
  Edit2
} from 'lucide-react';
import { state, forceRefreshDatabase } from '../logic';
import { formatDateDDMMMYYYY } from '../utils/dateUtils';
import { 
  parseBankStatementPdf, 
  parseBankStatementCsvOrExcel, 
  type ParsedBankStatement, 
  type ParsedBankTransaction 
} from '../services/bankStatementParser';
import { 
  type BankNarrationRule, 
  getStoredRules, 
  fetchRulesFromDatabase,
  fetchAccountMappingsFromDatabase,
  saveRule, 
  deleteRule, 
  saveAccountMapping, 
  autoDetectBankAndAccount, 
  applyRulesToTransactions, 
  detectDuplicates, 
  fetchLiveTransactionsForDeduplication,
  postBankTransactionsToAccounting,
  DEFAULT_SEED_RULES
} from '../services/bankImportRulesService';

interface BankStatementImportProps {
  onNavigateToLedger?: (ledgerId: number) => void;
}

export const BankStatementImport: React.FC<BankStatementImportProps> = ({ onNavigateToLedger }) => {
  // File & Parsing state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [lastFileBuffer, setLastFileBuffer] = useState<ArrayBuffer | null>(null);

  // Parsed Statement State
  const [parsedStatement, setParsedStatement] = useState<ParsedBankStatement | null>(null);
  const [transactions, setTransactions] = useState<ParsedBankTransaction[]>([]);

  // Account & Bank Mapping State
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number | null>(null);
  const [selectedAcid, setSelectedAcid] = useState<number | null>(null);
  const [rememberMapping, setRememberMapping] = useState<boolean>(true);
  const [mappingStatus, setMappingStatus] = useState<'remembered' | 'auto_matched' | 'manual'>('auto_matched');

  // Rules State
  const [rules, setRules] = useState<BankNarrationRule[]>([]);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankNarrationRule | null>(null);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState<BankNarrationRule['matchType']>('contains');
  const [newRuleLedgerId, setNewRuleLedgerId] = useState<number | ''>('');
  const [rulesSearch, setRulesSearch] = useState('');

  // Quick 1-Click Rule Modal from Row
  const [quickRuleRow, setQuickRuleRow] = useState<ParsedBankTransaction | null>(null);
  const [quickRulePattern, setQuickRulePattern] = useState('');
  const [quickRuleLedgerId, setQuickRuleLedgerId] = useState<number | ''>('');

  // Table Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'ready' | 'unassigned' | 'duplicates'>('all');

  // Posting State
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load rules on mount: immediate local cache + cloud sync (remembered forever across all devices)
  useEffect(() => {
    setRules(getStoredRules());
    fetchRulesFromDatabase().then(dbRules => {
      if (dbRules && dbRules.length > 0) setRules(dbRules);
    });
    fetchAccountMappingsFromDatabase().catch(() => {});
  }, []);

  // Available Bank Ledgers and Portfolios from State
  const bankLedgers = useMemo(() => {
    const list = state.acmac1 || [];
    return list.filter((l: any) => l.parent_id === 60 || (l.name && l.name.toLowerCase().includes('bank')));
  }, [state.acmac1]);

  const memberPortfolios = useMemo(() => {
    return (state.portfolios || []).filter((p: any) => p.investor_name || p.full_name);
  }, [state.portfolios]);

  // All non-group ledgers for Counterpart selection
  const allLedgers = useMemo(() => {
    const list = state.acmac1 || [];
    return list.filter((l: any) => !l.is_group);
  }, [state.acmac1]);

  // Filtered ledgers for the active account
  const accountLedgers = useMemo(() => {
    if (!selectedAcid) return allLedgers;
    const filtered = allLedgers.filter((l: any) => l.acid === selectedAcid);
    return filtered.length > 0 ? filtered : allLedgers;
  }, [allLedgers, selectedAcid]);

  // ── File Upload & Parsing Handler ─────────────────────────────────────────

  const handleFileUpload = async (uploadedFile: File, password = '') => {
    setParsing(true);
    setParseError(null);
    setPasswordRequired(false);
    setPostResult(null);
    setFile(uploadedFile);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      setLastFileBuffer(buffer);

      let parsed: ParsedBankStatement;

      if (uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        parsed = await parseBankStatementPdf(buffer, password);
      } else {
        // CSV or Excel
        parsed = parseBankStatementCsvOrExcel(buffer, uploadedFile.name);
      }

      if (parsed.status === 'error') {
        if (parsed.message?.includes('password')) {
          setPasswordRequired(true);
          setParseError(parsed.message);
        } else {
          setParseError(parsed.message || 'Failed to parse bank statement.');
        }
        setParsing(false);
        return;
      }

      setParsedStatement(parsed);

      // Auto-detect Bank Ledger & Member Account (acid)
      const detected = autoDetectBankAndAccount(
        parsed.accountNumber,
        parsed.bankName,
        parsed.customerName,
        undefined,
        parsed.transactions
      );

      const resolvedAcid = detected.bankLedger?.acid || detected.memberAccount?.id || (memberPortfolios[0]?.id ?? 31);
      const resolvedBankLedgerId = detected.bankLedger?.id || null;

      setSelectedAcid(resolvedAcid);
      setSelectedBankLedgerId(resolvedBankLedgerId);
      setMappingStatus(detected.isRemembered ? 'remembered' : (detected.bankLedger ? 'auto_matched' : 'manual'));

      // Apply Rules and immediate in-memory Duplicate Detection
      let txns = parsed.transactions;
      txns = applyRulesToTransactions(txns, resolvedAcid, rules);
      txns = detectDuplicates(txns, resolvedBankLedgerId, resolvedAcid);
      setTransactions(txns);

      // Authoritative Real-Time Deduplication: Query Supabase directly for live transactions/vouchers in date window
      if (parsed.transactions.length > 0) {
        const dates = parsed.transactions.map(t => t.date).filter(Boolean).sort();
        const minD = dates[0] || '2026-01-01';
        const maxD = dates[dates.length - 1] || '2026-12-31';

        fetchLiveTransactionsForDeduplication(resolvedBankLedgerId, resolvedAcid, minD, maxD).then(live => {
          if (live.trans.length > 0 || live.vouchers.length > 0) {
            setTransactions(prev => {
              const applied = applyRulesToTransactions(prev, resolvedAcid, rules);
              return detectDuplicates(applied, resolvedBankLedgerId, resolvedAcid, live.trans, live.vouchers);
            });
          }
        }).catch(err => console.warn('Live deduplication background check failed:', err));
      }

      // If recognized automatically, memorize if requested
      if (detected.bankLedger && parsed.accountNumber) {
        saveAccountMapping({
          accountNumber: parsed.accountNumber,
          bankLedgerId: detected.bankLedger.id,
          bankLedgerName: detected.bankLedger.name,
          acid: resolvedAcid,
          accountName: detected.memberAccount?.investor_name || detected.memberAccount?.full_name || 'Member',
          bankName: parsed.bankName,
          updatedAt: new Date().toISOString()
        });
      }

    } catch (err: any) {
      console.error('Error parsing bank statement:', err);
      setParseError(err?.message || 'Error parsing bank statement file.');
    } finally {
      setParsing(false);
    }
  };

  const handlePasswordRetry = () => {
    if (file && lastFileBuffer) {
      handleFileUpload(file, pdfPassword);
    }
  };

  // ── Account & Bank Ledger Change Handler ──────────────────────────────────

  const handleBankLedgerChange = (ledgerId: number) => {
    setSelectedBankLedgerId(ledgerId);
    const ledger = bankLedgers.find((l: any) => l.id === ledgerId);
    if (ledger && ledger.acid) {
      setSelectedAcid(ledger.acid);
    }

    setMappingStatus('manual');

    // Re-evaluate rules & duplicates
    if (parsedStatement) {
      const acidToUse = ledger?.acid || selectedAcid || 31;
      let txns = applyRulesToTransactions(parsedStatement.transactions, acidToUse, rules);
      txns = detectDuplicates(txns, ledgerId, acidToUse);
      setTransactions(txns);

      // Trigger live deduplication for this ledger
      const dates = parsedStatement.transactions.map(t => t.date).filter(Boolean).sort();
      const minD = dates[0] || '2026-01-01';
      const maxD = dates[dates.length - 1] || '2026-12-31';
      fetchLiveTransactionsForDeduplication(ledgerId, acidToUse, minD, maxD).then(live => {
        if (live.trans.length > 0 || live.vouchers.length > 0) {
          setTransactions(prev => detectDuplicates(prev, ledgerId, acidToUse, live.trans, live.vouchers));
        }
      }).catch(() => {});

      if (rememberMapping && parsedStatement.accountNumber && ledger) {
        const member = memberPortfolios.find((p: any) => p.id === acidToUse);
        saveAccountMapping({
          accountNumber: parsedStatement.accountNumber,
          bankLedgerId: ledger.id,
          bankLedgerName: ledger.name,
          acid: acidToUse,
          accountName: member?.investor_name || member?.full_name || 'Member',
          bankName: parsedStatement.bankName,
          updatedAt: new Date().toISOString()
        });
        setMappingStatus('remembered');
      }
    }
  };

  const handleAcidChange = (acid: number) => {
    setSelectedAcid(acid);
    setMappingStatus('manual');

    // If active bank ledger doesn't belong to this acid, try to find one that does
    if (parsedStatement) {
      const matchingBank = bankLedgers.find((l: any) => l.acid === acid && l.name.toLowerCase().includes(parsedStatement.bankName.toLowerCase().slice(0, 4)));
      const bankId = matchingBank ? matchingBank.id : selectedBankLedgerId;
      if (matchingBank) setSelectedBankLedgerId(matchingBank.id);

      let txns = applyRulesToTransactions(parsedStatement.transactions, acid, rules);
      txns = detectDuplicates(txns, bankId, acid);
      setTransactions(txns);

      // Trigger live deduplication for this acid and bank
      const dates = parsedStatement.transactions.map(t => t.date).filter(Boolean).sort();
      const minD = dates[0] || '2026-01-01';
      const maxD = dates[dates.length - 1] || '2026-12-31';
      fetchLiveTransactionsForDeduplication(bankId, acid, minD, maxD).then(live => {
        if (live.trans.length > 0 || live.vouchers.length > 0) {
          setTransactions(prev => detectDuplicates(prev, bankId, acid, live.trans, live.vouchers));
        }
      }).catch(() => {});

      if (rememberMapping && parsedStatement.accountNumber && matchingBank) {
        const member = memberPortfolios.find((p: any) => p.id === acid);
        saveAccountMapping({
          accountNumber: parsedStatement.accountNumber,
          bankLedgerId: matchingBank.id,
          bankLedgerName: matchingBank.name,
          acid,
          accountName: member?.investor_name || member?.full_name || 'Member',
          bankName: parsedStatement.bankName,
          updatedAt: new Date().toISOString()
        });
        setMappingStatus('remembered');
      }
    }
  };

  // ── Row Counterpart Ledger Assignment ─────────────────────────────────────

  const handleAssignLedgerToRow = (rowId: string, ledgerId: number) => {
    const ledger = allLedgers.find((l: any) => l.id === ledgerId);
    if (!ledger) return;

    setTransactions(prev => prev.map(t => {
      if (t.id === rowId) {
        return {
          ...t,
          targetLedgerId: ledger.id,
          targetLedgerName: ledger.name,
          isManuallyAssigned: true
        };
      }
      return t;
    }));
  };

  const handleToggleRowSelection = (rowId: string) => {
    setTransactions(prev => prev.map(t => t.id === rowId ? { ...t, selected: !t.selected } : t));
  };

  const handleSelectAll = (select: boolean) => {
    setTransactions(prev => prev.map(t => {
      if (select) {
        // Strictly avoid selecting duplicates by default
        if (t.isDuplicate) return t;
        return { ...t, selected: true };
      }
      return { ...t, selected: false };
    }));
  };

  // ── Rules Management (Add, Edit, Modify, Toggle, Delete) ────────────────────

  const handleStartEditRule = (rule: BankNarrationRule) => {
    setEditingRule(rule);
    setNewRulePattern(rule.pattern);
    setNewRuleMatchType(rule.matchType);
    setNewRuleLedgerId(rule.targetLedgerId);
    setIsRulesModalOpen(true);
  };

  const handleCancelEditRule = () => {
    setEditingRule(null);
    setNewRulePattern('');
    setNewRuleLedgerId('');
    setNewRuleMatchType('contains');
  };

  const handleSaveRule = () => {
    if (!newRulePattern.trim() || !newRuleLedgerId) {
      alert('Please enter a pattern keyword and select a target ledger.');
      return;
    }
    const targetLedger = allLedgers.find((l: any) => l.id === Number(newRuleLedgerId));
    if (!targetLedger) return;

    if (editingRule) {
      // Modify existing rule
      const updatedRule: BankNarrationRule = {
        ...editingRule,
        pattern: newRulePattern.trim(),
        matchType: newRuleMatchType,
        targetLedgerId: targetLedger.id,
        targetLedgerName: targetLedger.name,
        targetAcid: selectedAcid || undefined,
      };

      saveRule(updatedRule);
      const updated = getStoredRules();
      setRules(updated);

      // Re-apply modified rules across all transactions immediately
      if (selectedAcid) {
        setTransactions(prev => applyRulesToTransactions(prev, selectedAcid, updated));
      }

      handleCancelEditRule();
    } else {
      // Add new rule
      const newRule: BankNarrationRule = {
        id: `rule_${Date.now()}`,
        pattern: newRulePattern.trim(),
        matchType: newRuleMatchType,
        targetLedgerId: targetLedger.id,
        targetLedgerName: targetLedger.name,
        targetAcid: selectedAcid || undefined,
        enabled: true,
        createdAt: new Date().toISOString()
      };

      saveRule(newRule);
      const updated = getStoredRules();
      setRules(updated);

      // Re-apply rules across all transactions
      if (selectedAcid) {
        setTransactions(prev => applyRulesToTransactions(prev, selectedAcid, updated));
      }

      setNewRulePattern('');
      setNewRuleLedgerId('');
      setNewRuleMatchType('contains');
    }
  };

  const handleToggleRuleEnabled = (rule: BankNarrationRule) => {
    const updatedRule: BankNarrationRule = { ...rule, enabled: !rule.enabled };
    saveRule(updatedRule);
    const updated = getStoredRules();
    setRules(updated);
    if (selectedAcid) {
      setTransactions(prev => applyRulesToTransactions(prev, selectedAcid, updated));
    }
  };

  const handleDeleteRule = (id: string) => {
    if (editingRule?.id === id) {
      handleCancelEditRule();
    }
    deleteRule(id);
    const updated = getStoredRules();
    setRules(updated);
  };

  // Quick Rule Creation / Modification from Row
  const openQuickRuleModal = (txn: ParsedBankTransaction) => {
    setQuickRuleRow(txn);
    // Clean narration to suggest a concise pattern
    let cleanWord = txn.narration
      .replace(/^(?:MB:RECEIVED FROM|MB:SENT TO|MB:SENT MONEY TO OWN|SentIMPS\d*|UPI\/|NEFT\s+[A-Z0-9]+\s+|NACH\/)/i, '')
      .replace(/\/.*$/, '')
      .replace(/\d{8,}.*$/, '')
      .trim();

    if (cleanWord.length > 25) cleanWord = cleanWord.substring(0, 25).trim();
    setQuickRulePattern(cleanWord || txn.narration.substring(0, 20));
    setQuickRuleLedgerId(txn.targetLedgerId || '');
  };

  const openModifyRuleFromRow = (txn: ParsedBankTransaction) => {
    const existingRule = rules.find(r => r.id === txn.matchedRuleId || r.pattern.toLowerCase() === (txn.matchedRulePattern || '').toLowerCase());
    if (existingRule) {
      handleStartEditRule(existingRule);
    } else {
      setEditingRule(null);
      setNewRulePattern(txn.matchedRulePattern || txn.narration.slice(0, 20));
      setNewRuleLedgerId(txn.targetLedgerId || '');
      setIsRulesModalOpen(true);
    }
  };

  const saveQuickRule = () => {
    if (!quickRulePattern.trim() || !quickRuleLedgerId) {
      alert('Please provide a pattern and counterpart ledger.');
      return;
    }
    const targetLedger = allLedgers.find((l: any) => l.id === Number(quickRuleLedgerId));
    if (!targetLedger) return;

    const newRule: BankNarrationRule = {
      id: `quick_rule_${Date.now()}`,
      pattern: quickRulePattern.trim(),
      matchType: 'contains',
      targetLedgerId: targetLedger.id,
      targetLedgerName: targetLedger.name,
      targetAcid: selectedAcid || undefined,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    saveRule(newRule);
    const updated = getStoredRules();
    setRules(updated);

    // Automatically re-apply rules across all transactions immediately!
    if (selectedAcid) {
      setTransactions(prev => applyRulesToTransactions(prev, selectedAcid, updated));
    }

    setQuickRuleRow(null);
  };

  // ── Post Transactions to Accounting Engine ────────────────────────────────

  const handlePostTransactions = async () => {
    if (!selectedBankLedgerId || !selectedAcid) {
      alert('Please select a valid Bank Ledger and Member Account before posting.');
      return;
    }

    const readyCount = transactions.filter(t => t.selected && t.targetLedgerId).length;
    if (readyCount === 0) {
      alert('No transactions are selected with counterpart ledgers. Please tag transactions before posting.');
      return;
    }

    setIsPosting(true);
    setPostResult(null);

    try {
      const res = await postBankTransactionsToAccounting(
        transactions,
        selectedBankLedgerId,
        selectedAcid
      );

      if (res.success) {
        setPostResult({
          success: true,
          message: `Successfully posted ${res.postedCount} transactions to the Accounting Engine! Double-entry vouchers created.`
        });
        await forceRefreshDatabase();

        // Mark posted items as unselected or remove them
        setTransactions(prev => prev.map(t => (t.selected && t.targetLedgerId) ? { ...t, selected: false, isDuplicate: true, duplicateReason: 'Just Posted' } : t));
      } else {
        setPostResult({
          success: false,
          message: res.error || 'Failed to post transactions.'
        });
      }
    } catch (err: any) {
      setPostResult({
        success: false,
        message: err?.message || 'Error posting bank transactions.'
      });
    } finally {
      setIsPosting(false);
    }
  };

  // ── Filtered Transactions for Grid ────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Tab filter
      if (filterTab === 'ready' && (!t.targetLedgerId || t.isDuplicate)) return false;
      if (filterTab === 'unassigned' && t.targetLedgerId) return false;
      if (filterTab === 'duplicates' && !t.isDuplicate) return false;

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesNarr = t.narration.toLowerCase().includes(q);
        const matchesRef = (t.chqRef || '').toLowerCase().includes(q);
        const matchesLedger = (t.targetLedgerName || '').toLowerCase().includes(q);
        const matchesAmt = t.debit.toString().includes(q) || t.credit.toString().includes(q);
        if (!matchesNarr && !matchesRef && !matchesLedger && !matchesAmt) return false;
      }

      return true;
    });
  }, [transactions, filterTab, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = transactions.length;
    const ready = transactions.filter(t => t.targetLedgerId && !t.isDuplicate).length;
    const unassigned = transactions.filter(t => !t.targetLedgerId).length;
    const duplicates = transactions.filter(t => t.isDuplicate).length;
    const selectedCount = transactions.filter(t => t.selected && t.targetLedgerId && !t.isDuplicate).length;
    const selectedTotal = transactions
      .filter(t => t.selected && t.targetLedgerId && !t.isDuplicate)
      .reduce((s, t) => s + (t.credit || t.debit), 0);

    return { total, ready, unassigned, duplicates, selectedCount, selectedTotal };
  }, [transactions]);

  // Active member portfolio
  const activeMember = memberPortfolios.find((p: any) => p.id === selectedAcid);
  const activeBankLedger = bankLedgers.find((l: any) => l.id === selectedBankLedgerId);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      
      {/* ── HEADER BANNER ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1b2535 0%, #0e1526 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        color: '#fff',
        marginBottom: '28px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              background: '#2563eb',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={24} color="#fff" />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Bank Statement Import Engine
            </h1>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', maxWidth: '650px' }}>
            Intelligent statement importer with auto-account recognition, smart narration rules (e.g. Creative Printers), 
            and deduplication for existing vouchers & dividend reconciliation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setIsRulesModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Zap size={16} color="#fbbf24" />
            Smart Rules ({rules.length})
          </button>
        </div>
      </div>

      {/* ── DRAG & DROP UPLOAD ZONE ─────────────────────────────────────────── */}
      {!parsedStatement && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '2px dashed #cbd5e1',
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
          marginBottom: '28px'
        }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
            accept=".pdf,.csv,.xlsx,.xls"
            style={{ display: 'none' }}
          />

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <Upload size={32} color="#2563eb" />
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px 0' }}>
            Upload Bank Statement (PDF, CSV, or Excel)
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
            Supports Kotak Mahindra, IDFC FIRST, HDFC, ICICI, SBI, Axis, and all major Indian banks.
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: parsing ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {parsing ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
            {parsing ? 'Parsing Statement...' : 'Choose File to Upload'}
          </button>

          {/* Password Prompt Modal/Alert if Encrypted */}
          {passwordRequired && (
            <div style={{
              marginTop: '24px',
              maxWidth: '450px',
              margin: '24px auto 0 auto',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '16px 20px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>
                <AlertTriangle size={18} color="#d97706" />
                Password Protected Statement
              </div>
              <p style={{ fontSize: '13px', color: '#78350f', margin: '0 0 12px 0' }}>
                This PDF is encrypted. Enter your PAN or birthdate password to unlock:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  placeholder="Enter PDF password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d97706',
                    fontSize: '14px'
                  }}
                />
                <button
                  onClick={handlePasswordRetry}
                  disabled={!pdfPassword}
                  style={{
                    background: '#d97706',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Unlock
                </button>
              </div>
            </div>
          )}

          {parseError && !passwordRequired && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#fef2f2',
              color: '#dc2626',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'inline-block'
            }}>
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* ── PARSED STATEMENT DETAILS & ACCOUNT RECOGNITION ──────────────────── */}
      {parsedStatement && (
        <>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
            marginBottom: '24px'
          }}>
            {/* Top row: Bank recognition + memory badge + change file */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: parsedStatement.bank === 'kotak' ? '#ef4444' : (parsedStatement.bank === 'idfc' ? '#991b1b' : '#2563eb'),
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  letterSpacing: '0.03em'
                }}>
                  {parsedStatement.bankName.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    A/c No: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{parsedStatement.accountNumber || 'Detected'}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {parsedStatement.customerName && <span>Holder: <strong>{parsedStatement.customerName}</strong> • </span>}
                    {parsedStatement.ifsc && <span>IFSC: {parsedStatement.ifsc} • </span>}
                    {(parsedStatement.periodFrom || parsedStatement.periodTo) && (
                      <span>Period: <strong>{formatDateDDMMMYYYY(parsedStatement.periodFrom)} to {formatDateDDMMMYYYY(parsedStatement.periodTo)}</strong> • </span>
                    )}
                    <span>{transactions.length} entries parsed</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {mappingStatus === 'remembered' && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#ecfdf5',
                    color: '#059669',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #a7f3d0'
                  }}>
                    <ShieldCheck size={16} />
                    Memorised Account Mapping
                  </span>
                )}
                {mappingStatus === 'auto_matched' && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #bfdbfe'
                  }}>
                    <Zap size={16} />
                    Auto-Recognised A/c
                  </span>
                )}

                <button
                  onClick={() => {
                    setParsedStatement(null);
                    setTransactions([]);
                    setFile(null);
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Upload Another File
                </button>
              </div>
            </div>

            {/* Middle Row: Bank Ledger & Member Account Selectors */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
              background: '#f8fafc',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Target Bank Ledger in WealthCore
                </label>
                <select
                  value={selectedBankLedgerId || ''}
                  onChange={(e) => handleBankLedgerChange(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    background: '#fff'
                  }}
                >
                  <option value="">-- Select Bank Ledger --</option>
                  {bankLedgers.map((l: any, idx: number) => (
                    <option key={`bank_${l.id}_${l.acid || ''}_${idx}`} value={l.id}>
                      {l.name} (Acid: {l.acid})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Family Member Account (ACID)
                </label>
                <select
                  value={selectedAcid || ''}
                  onChange={(e) => handleAcidChange(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    background: '#fff'
                  }}
                >
                  <option value="">-- Select Family Member --</option>
                  {memberPortfolios.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.investor_name || p.full_name} (Acid: {p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={rememberMapping}
                    onChange={(e) => setRememberMapping(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  Remember this account mapping for future statements
                </label>
              </div>
            </div>

            {/* Bottom Row: Statement Balance & Transaction Summary Pills */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Opening Balance</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  ₹{(parsedStatement.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>Total Withdrawals (Dr)</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>
                  ₹{(parsedStatement.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>Total Deposits (Cr)</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
                  ₹{(parsedStatement.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>Closing Balance</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                  ₹{(parsedStatement.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* ── POST RESULT BANNER ─────────────────────────────────────────── */}
          {postResult && (
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '20px',
              background: postResult.success ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${postResult.success ? '#a7f3d0' : '#fecaca'}`,
              color: postResult.success ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {postResult.success ? <CheckCircle size={20} color="#059669" /> : <AlertTriangle size={20} color="#dc2626" />}
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{postResult.message}</span>
              </div>
              {selectedBankLedgerId && onNavigateToLedger && (
                <button
                  onClick={() => onNavigateToLedger(selectedBankLedgerId)}
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  View in Ledger <ExternalLink size={14} />
                </button>
              )}
            </div>
          )}

          {/* ── TOOLBAR & FILTERS ───────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px'
          }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button
                onClick={() => setFilterTab('all')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === 'all' ? '#fff' : 'transparent',
                  color: filterTab === 'all' ? '#0f172a' : '#64748b',
                  boxShadow: filterTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setFilterTab('ready')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === 'ready' ? '#fff' : 'transparent',
                  color: filterTab === 'ready' ? '#16a34a' : '#64748b',
                  boxShadow: filterTab === 'ready' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Ready to Post ({stats.ready})
              </button>
              <button
                onClick={() => setFilterTab('unassigned')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === 'unassigned' ? '#fff' : 'transparent',
                  color: filterTab === 'unassigned' ? '#ea580c' : '#64748b',
                  boxShadow: filterTab === 'unassigned' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Needs Ledger ({stats.unassigned})
              </button>
              <button
                onClick={() => setFilterTab('duplicates')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === 'duplicates' ? '#fff' : 'transparent',
                  color: filterTab === 'duplicates' ? '#dc2626' : '#64748b',
                  boxShadow: filterTab === 'duplicates' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Duplicates ({stats.duplicates})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search narration, ref, or amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>

              <button
                onClick={() => handleSelectAll(true)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Select All
              </button>

              <button
                onClick={() => handleSelectAll(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* ── STAGING TRANSACTION GRID ───────────────────────────────────── */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
            overflow: 'hidden',
            marginBottom: '32px'
          }}>
            <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '12px 16px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={transactions.filter(t => !t.isDuplicate).length > 0 && transactions.filter(t => !t.isDuplicate).every(t => t.selected)}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                      />
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', minWidth: '260px' }}>Narration / Description</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Ref / Cheque</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#b91c1c', textAlign: 'right' }}>Withdrawal (Dr)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#15803d', textAlign: 'right' }}>Deposit (Cr)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Balance</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', minWidth: '220px' }}>Counterpart Ledger</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn, idx) => {
                    const isSelected = txn.selected;
                    const isDup = txn.isDuplicate;

                    return (
                      <tr 
                        key={txn.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isDup ? '#fff5f5' : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 16px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRowSelection(txn.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                          />
                        </td>

                        {/* Date */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 600, color: '#1e293b' }}>
                          {formatDateDDMMMYYYY(txn.date)}
                        </td>

                        {/* Narration with Keyword Highlighting */}
                        <td style={{ padding: '12px 14px', color: '#334155', lineHeight: '1.4' }}>
                          <div style={{ wordBreak: 'break-word', fontWeight: 500 }}>
                            {txn.narration}
                          </div>
                        </td>

                        {/* Chq/Ref */}
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>
                          {txn.chqRef || '-'}
                        </td>

                        {/* Withdrawal (Dr) */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: txn.debit > 0 ? '#dc2626' : '#cbd5e1' }}>
                          {txn.debit > 0 ? `₹${txn.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>

                        {/* Deposit (Cr) */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: txn.credit > 0 ? '#16a34a' : '#cbd5e1' }}>
                          {txn.credit > 0 ? `₹${txn.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>

                        {/* Balance */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                          ₹{txn.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Target Ledger Selector */}
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            value={txn.targetLedgerId || ''}
                            onChange={(e) => handleAssignLedgerToRow(txn.id, Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: txn.targetLedgerId ? '1px solid #cbd5e1' : '1px solid #f97316',
                              background: txn.targetLedgerId ? '#fff' : '#fff7ed',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: txn.targetLedgerId ? '#0f172a' : '#c2410c'
                            }}
                          >
                            <option value="">-- Assign Ledger --</option>
                            {accountLedgers.map((l: any, idx: number) => (
                              <option key={`row_${l.id}_${l.acid || ''}_${idx}`} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {isDup ? (
                            <span 
                              title={txn.duplicateReason || 'Existing duplicate detected'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <AlertTriangle size={12} />
                              DUPLICATE
                            </span>
                          ) : txn.matchedRulePattern ? (
                            <span 
                              title={`Auto-assigned by rule: "${txn.matchedRulePattern}"`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              <Zap size={12} color="#2563eb" />
                              Rule Match
                            </span>
                          ) : txn.targetLedgerId ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ecfdf5',
                              color: '#047857',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              <CheckCircle size={12} />
                              Ready
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: '#fff7ed',
                              color: '#c2410c',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              Needs Tagging
                            </span>
                          )}
                        </td>

                        {/* Quick 1-Click Rule / Modify Rule Button */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {txn.matchedRulePattern ? (
                            <button
                              onClick={() => openModifyRuleFromRow(txn)}
                              title={`Modify smart rule for "${txn.matchedRulePattern}"`}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Edit2 size={12} color="#2563eb" />
                              Edit Rule
                            </button>
                          ) : (
                            <button
                              onClick={() => openQuickRuleModal(txn)}
                              title="Create smart rule from this entry"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Zap size={12} color="#d97706" />
                              + Rule
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Bar: Post to Accounting Button */}
            <div style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <span style={{ fontSize: '14px', color: '#475569' }}>
                  Selected: <strong>{stats.selectedCount}</strong> entries for posting • 
                  Total Value: <strong>₹{stats.selectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </span>
                {stats.duplicates > 0 && (
                  <span style={{ marginLeft: '12px', fontSize: '13px', color: '#dc2626' }}>
                    ({stats.duplicates} duplicates unchecked by default)
                  </span>
                )}
              </div>

              <button
                onClick={handlePostTransactions}
                disabled={isPosting || stats.selectedCount === 0}
                style={{
                  background: stats.selectedCount > 0 ? '#16a34a' : '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: (isPosting || stats.selectedCount === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: stats.selectedCount > 0 ? '0 4px 12px rgba(22,163,74,0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isPosting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {isPosting ? 'Posting Vouchers...' : `Post ${stats.selectedCount} Transactions to Accounting`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── RULES MANAGEMENT MODAL / DRAWER ─────────────────────────────────── */}
      {isRulesModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={20} color="#2563eb" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Smart Narration Rules
                </h3>
              </div>
              <button
                onClick={() => setIsRulesModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Add / Modify Rule Form */}
              <div style={{
                background: editingRule ? '#eff6ff' : '#f8fafc',
                border: editingRule ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: editingRule ? '#1d4ed8' : '#1e293b' }}>
                    {editingRule ? `✏️ Modify Rule: "${editingRule.pattern}"` : '+ Add New Narration Rule'}
                  </h4>
                  {editingRule && (
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      Editing Mode
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr auto', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Narration Keyword / Phrase
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CREATIVE PRINTERS"
                      value={newRulePattern}
                      onChange={(e) => setNewRulePattern(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#fff'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Match Type
                    </label>
                    <select
                      value={newRuleMatchType}
                      onChange={(e) => setNewRuleMatchType(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#fff'
                      }}
                    >
                      <option value="contains">Contains</option>
                      <option value="exact">Exact Match</option>
                      <option value="startsWith">Starts With</option>
                      <option value="regex">Regex</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Target Counterpart Ledger
                    </label>
                    <select
                      value={newRuleLedgerId}
                      onChange={(e) => setNewRuleLedgerId(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#fff'
                      }}
                    >
                      <option value="">-- Select Ledger --</option>
                      {accountLedgers.map((l: any, idx: number) => (
                        <option key={`rule_${l.id}_${l.acid || ''}_${idx}`} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={handleSaveRule}
                      style={{
                        background: editingRule ? '#16a34a' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '9px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {editingRule ? 'Update Rule' : 'Save Rule'}
                    </button>
                    {editingRule && (
                      <button
                        onClick={handleCancelEditRule}
                        style={{
                          background: '#fff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          padding: '9px 12px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Existing Rules List Header & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  Configured Rules ({rules.length})
                </h4>
                <button
                  onClick={() => {
                    localStorage.setItem('wealthcore_bank_narration_rules', JSON.stringify(DEFAULT_SEED_RULES));
                    setRules([...DEFAULT_SEED_RULES]);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reset Defaults
                </button>
              </div>

              {/* Rules Search Filter */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search rules by pattern or target ledger..."
                    value={rulesSearch}
                    onChange={(e) => setRulesSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules
                  .filter(r => !rulesSearch.trim() || r.pattern.toLowerCase().includes(rulesSearch.toLowerCase()) || r.targetLedgerName.toLowerCase().includes(rulesSearch.toLowerCase()))
                  .map(rule => (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: rule.enabled ? '#fff' : '#f8fafc',
                      border: editingRule?.id === rule.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      opacity: rule.enabled ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => handleToggleRuleEnabled(rule)}
                        title={rule.enabled ? 'Click to disable rule' : 'Click to enable rule'}
                        style={{
                          border: 'none',
                          background: rule.enabled ? '#dcfce7' : '#f1f5f9',
                          color: rule.enabled ? '#15803d' : '#64748b',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {rule.enabled ? 'ON' : 'OFF'}
                      </button>

                      <span style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: '11px',
                        padding: '3px 7px',
                        borderRadius: '4px'
                      }}>
                        {rule.matchType}
                      </span>

                      <strong style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        "{rule.pattern}"
                      </strong>

                      <span style={{ color: '#94a3b8' }}>➔</span>

                      <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {rule.targetLedgerName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
                      <button
                        onClick={() => handleStartEditRule(rule)}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          cursor: 'pointer',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Modify Rule Pattern or Counterpart Ledger"
                      >
                        <Edit2 size={12} />
                        Modify
                      </button>

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '5px'
                        }}
                        title="Delete Rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK 1-CLICK RULE MODAL FROM ROW ──────────────────────────────── */}
      {quickRuleRow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} color="#d97706" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Create Rule from Entry
                </h3>
              </div>
              <button
                onClick={() => setQuickRuleRow(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              <strong>Original Narration:</strong> {quickRuleRow.narration}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Match Keyword / Phrase:
              </label>
              <input
                type="text"
                value={quickRulePattern}
                onChange={(e) => setQuickRulePattern(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Any future transaction containing this phrase will automatically select the ledger below.
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Counterpart Ledger:
              </label>
              <select
                value={quickRuleLedgerId}
                onChange={(e) => setQuickRuleLedgerId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: '#fff'
                }}
              >
                <option value="">-- Select Counterpart Ledger --</option>
                {accountLedgers.map((l: any, idx: number) => (
                  <option key={`quick_${l.id}_${l.acid || ''}_${idx}`} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setQuickRuleRow(null)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveQuickRule}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Save & Apply Rule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
