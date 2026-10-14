/**
 * WealthCore — Bank Statement Import Rules & Deduplication Engine
 * 
 * Manages:
 * 1. Narration Matching Rules (e.g. "CREATIVE PRINTERS" -> Creative Printers ledger)
 * 2. Bank Account Memory (memorises which member account & ledger a statement belongs to)
 * 3. Duplicate Detection:
 *    - Exact voucher/transc1 matches by date, bank, and amount
 *    - Dividend Recon / PMS duplicate detection (identifies amount & company name from narration)
 * 4. Double-Entry Voucher Generation & Posting
 */

import { state, createVouchersBulk, persistStateToIDB } from '../logic';
import { supabase } from '../supabase';
import type { ParsedBankTransaction } from './bankStatementParser';

export interface BankNarrationRule {
  id: string;
  pattern: string; // e.g. "CREATIVE PRINTERS" or "PRINTERS"
  matchType: 'contains' | 'exact' | 'startsWith' | 'regex';
  targetLedgerId: number;
  targetLedgerName: string;
  targetAcid?: number; // Optional account binding
  enabled: boolean;
  createdAt: string;
  matchCount?: number;
}

export interface BankAccountMapping {
  accountNumber: string; // e.g. "10055506177"
  bankLedgerId: number; // e.g. 95 (IDFC Bank)
  bankLedgerName: string;
  acid: number; // e.g. 31 (Saahil Shah A/c)
  accountName: string;
  bankName: string;
  updatedAt: string;
}

const RULES_STORAGE_KEY = 'wealthcore_bank_narration_rules';
const MAPPINGS_STORAGE_KEY = 'wealthcore_bank_account_mappings';

// Persistent Supabase options_table IDs to store rules and mappings forever
export const OPTION_ID_BANK_RULES = 990001;
export const OPTION_ID_BANK_MAPPINGS = 990002;

// ── Default Seed Rules ──────────────────────────────────────────────────────

export const DEFAULT_SEED_RULES: BankNarrationRule[] = [
  {
    id: 'seed_rule_creative_printers',
    pattern: 'CREATIVE PRINTERS',
    matchType: 'contains',
    targetLedgerId: 38,
    targetLedgerName: 'Creative Printers',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed_rule_creative_packaging',
    pattern: 'CREATIVE PACKAGING',
    matchType: 'contains',
    targetLedgerId: 143,
    targetLedgerName: 'Creative Packaging',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed_rule_zerodha',
    pattern: 'ZERODHA',
    matchType: 'contains',
    targetLedgerId: 100007,
    targetLedgerName: 'Zerodha',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed_rule_interest',
    pattern: 'INTEREST',
    matchType: 'contains',
    targetLedgerId: 407,
    targetLedgerName: 'Interest On Saving Account',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed_rule_int_pd',
    pattern: 'Int.Pd:',
    matchType: 'contains',
    targetLedgerId: 407,
    targetLedgerName: 'Interest On Saving Account',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'seed_rule_div',
    pattern: 'DIV',
    matchType: 'contains',
    targetLedgerId: 415,
    targetLedgerName: 'Dividend',
    enabled: true,
    createdAt: new Date().toISOString()
  }
];

// ── Database Sync for Rules (Remembered Forever in Supabase) ───────────────

export async function fetchRulesFromDatabase(): Promise<BankNarrationRule[]> {
  try {
    const { data, error } = await supabase
      .from('options_table')
      .select('accinfo')
      .eq('id', OPTION_ID_BANK_RULES)
      .maybeSingle();

    if (!error && data?.accinfo) {
      const parsed = JSON.parse(data.accinfo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not fetch rules from Supabase, fallback to localStorage:', err);
  }
  return getStoredRules();
}

export async function syncRulesToDatabase(rules: BankNarrationRule[]): Promise<void> {
  try {
    const { error } = await supabase.from('options_table').upsert({
      id: OPTION_ID_BANK_RULES,
      accinfo: JSON.stringify(rules)
    });
    if (error) {
      console.warn('Failed to sync bank rules to Supabase options_table:', error.message);
    } else {
      console.log(`✅ Synced ${rules.length} bank narration rules to Supabase database forever`);
    }
  } catch (err) {
    console.warn('Error syncing bank rules to Supabase:', err);
  }
}

// ── Rules Storage & Retrieval ───────────────────────────────────────────────

export function getStoredRules(): BankNarrationRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) {
      // Initialize with seed rules
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_RULES));
      // Background sync default seed rules to Supabase
      syncRulesToDatabase(DEFAULT_SEED_RULES).catch(() => {});
      return [...DEFAULT_SEED_RULES];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_SEED_RULES];
  } catch (err) {
    console.error('Failed to load bank narration rules:', err);
    return [...DEFAULT_SEED_RULES];
  }
}

export function saveRule(rule: BankNarrationRule): void {
  try {
    const rules = getStoredRules();
    const existingIdx = rules.findIndex(r => r.id === rule.id);
    if (existingIdx >= 0) {
      rules[existingIdx] = rule;
    } else {
      rules.unshift(rule);
    }
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    // Persist forever in Supabase PostgreSQL
    syncRulesToDatabase(rules).catch(() => {});
  } catch (err) {
    console.error('Failed to save bank rule:', err);
  }
}

export function deleteRule(id: string): void {
  try {
    const rules = getStoredRules().filter(r => r.id !== id);
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    // Persist forever in Supabase PostgreSQL
    syncRulesToDatabase(rules).catch(() => {});
  } catch (err) {
    console.error('Failed to delete bank rule:', err);
  }
}

// ── Database Sync for Bank Account Mappings (Remembered Forever) ────────────

export async function fetchAccountMappingsFromDatabase(): Promise<Record<string, BankAccountMapping>> {
  try {
    const { data, error } = await supabase
      .from('options_table')
      .select('accinfo')
      .eq('id', OPTION_ID_BANK_MAPPINGS)
      .maybeSingle();

    if (!error && data?.accinfo) {
      const parsed = JSON.parse(data.accinfo);
      if (typeof parsed === 'object' && parsed !== null) {
        localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not fetch account mappings from Supabase, fallback to localStorage:', err);
  }
  return getStoredAccountMappings();
}

export async function syncAccountMappingsToDatabase(mappings: Record<string, BankAccountMapping>): Promise<void> {
  try {
    const { error } = await supabase.from('options_table').upsert({
      id: OPTION_ID_BANK_MAPPINGS,
      accinfo: JSON.stringify(mappings)
    });
    if (error) {
      console.warn('Failed to sync bank account mappings to Supabase options_table:', error.message);
    } else {
      console.log('✅ Synced bank account mappings to Supabase database forever');
    }
  } catch (err) {
    console.warn('Error syncing bank account mappings to Supabase:', err);
  }
}

// ── Bank Account Mappings Memory ───────────────────────────────────────────

export function getStoredAccountMappings(): Record<string, BankAccountMapping> {
  try {
    const raw = localStorage.getItem(MAPPINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    console.error('Failed to load bank account mappings:', err);
    return {};
  }
}

export function saveAccountMapping(mapping: BankAccountMapping): void {
  try {
    if (!mapping.accountNumber) return;
    const mappings = getStoredAccountMappings();
    // Normalize account number to digits
    const cleanAcc = mapping.accountNumber.replace(/\D/g, '') || mapping.accountNumber.trim();
    mappings[cleanAcc] = {
      ...mapping,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(mappings));
    // Persist forever in Supabase PostgreSQL
    syncAccountMappingsToDatabase(mappings).catch(() => {});
    console.log(`✅ Saved account mapping for A/c ${cleanAcc} -> Ledger ${mapping.bankLedgerName} (Acid: ${mapping.acid})`);
  } catch (err) {
    console.error('Failed to save bank account mapping:', err);
  }
}

// ── Auto-Detect Bank Ledger & Family Member Account ─────────────────────────

export function autoDetectBankAndAccount(
  accountNumber: string,
  bankName: string,
  customerName = '',
  preferredAcid?: number
): {
  bankLedger: any | null;
  memberAccount: any | null;
  isRemembered: boolean;
} {
  const cleanAcc = (accountNumber || '').replace(/\D/g, '');
  const mappings = getStoredAccountMappings();

  // 1. Check Memorised Mappings
  if (cleanAcc && mappings[cleanAcc]) {
    const mem = mappings[cleanAcc];
    const ledger = (state.acmac1 || []).find((l: any) => l.id === mem.bankLedgerId);
    const member = (state.portfolios || []).find((p: any) => p.id === mem.acid);
    if (ledger) {
      return {
        bankLedger: ledger,
        memberAccount: member || null,
        isRemembered: true
      };
    }
  }

  // 2. Exact Match by Account Number in Chart of Accounts (acmac1)
  if (cleanAcc.length >= 6) {
    const matchedLedger = (state.acmac1 || []).find((l: any) => {
      // Must be a bank ledger
      if (l.parent_id !== 60 && !l.name.toLowerCase().includes('bank')) return false;
      const ledgerDigits = l.name.replace(/\D/g, '');
      return ledgerDigits.includes(cleanAcc) || cleanAcc.includes(ledgerDigits && ledgerDigits.length >= 6 ? ledgerDigits : '___none___');
    });

    if (matchedLedger) {
      const member = (state.portfolios || []).find((p: any) => p.id === matchedLedger.acid);
      return {
        bankLedger: matchedLedger,
        memberAccount: member || null,
        isRemembered: false
      };
    }
  }

  // 3. Fallback Match by Bank Name & Customer Name / Preferred Acid
  const cleanBankName = bankName.toLowerCase();
  const bankCandidates = (state.acmac1 || []).filter((l: any) => {
    if (l.parent_id !== 60 && !l.name.toLowerCase().includes('bank')) return false;
    const lName = l.name.toLowerCase();
    if (cleanBankName.includes('kotak') && lName.includes('kotak')) return true;
    if (cleanBankName.includes('idfc') && (lName.includes('idfc') || lName.includes('idfb'))) return true;
    if (cleanBankName.includes('hdfc') && lName.includes('hdfc')) return true;
    if (cleanBankName.includes('icici') && lName.includes('icici')) return true;
    if ((cleanBankName.includes('sbi') || cleanBankName.includes('state bank')) && lName.includes('state bank')) return true;
    if (cleanBankName.includes('axis') && lName.includes('axis')) return true;
    return false;
  });

  if (bankCandidates.length > 0) {
    // If preferredAcid is provided, match by acid
    if (preferredAcid) {
      const byAcid = bankCandidates.find((l: any) => l.acid === preferredAcid);
      if (byAcid) {
        const member = (state.portfolios || []).find((p: any) => p.id === byAcid.acid);
        return { bankLedger: byAcid, memberAccount: member || null, isRemembered: false };
      }
    }

    // Try matching customer name to portfolio investor name
    if (customerName) {
      const cUpper = customerName.toUpperCase().replace(/[^A-Z]/g, '');
      const byName = bankCandidates.find((l: any) => {
        const p = (state.portfolios || []).find((port: any) => port.id === l.acid);
        if (!p) return false;
        const pName = (p.full_name || p.investor_name || '').toUpperCase().replace(/[^A-Z]/g, '');
        return cUpper.includes(pName) || pName.includes(cUpper);
      });
      if (byName) {
        const member = (state.portfolios || []).find((p: any) => p.id === byName.acid);
        return { bankLedger: byName, memberAccount: member || null, isRemembered: false };
      }
    }

    // Fallback to first candidate
    const first = bankCandidates[0];
    const member = (state.portfolios || []).find((p: any) => p.id === first.acid);
    return { bankLedger: first, memberAccount: member || null, isRemembered: false };
  }

  return { bankLedger: null, memberAccount: null, isRemembered: false };
}

// ── Rule Matching Engine ────────────────────────────────────────────────────

export function applyRulesToTransactions(
  txns: ParsedBankTransaction[],
  acid: number,
  customRules?: BankNarrationRule[]
): ParsedBankTransaction[] {
  const rules = (customRules || getStoredRules()).filter(r => r.enabled);
  const ledgers = state.acmac1 || [];

  return txns.map(txn => {
    // Preserve manual assignment by user, but allow rule-matched assignments to be re-evaluated when rules change
    if (txn.isManuallyAssigned && txn.targetLedgerId) return txn;

    const narr = (txn.narration || '').trim();
    if (!narr) return txn;

    const narrLower = narr.toLowerCase();

    for (const rule of rules) {
      if (rule.targetAcid && rule.targetAcid !== acid) continue;

      let matches = false;
      const patLower = rule.pattern.toLowerCase();

      if (rule.matchType === 'exact') {
        matches = narrLower === patLower;
      } else if (rule.matchType === 'startsWith') {
        matches = narrLower.startsWith(patLower);
      } else if (rule.matchType === 'regex') {
        try {
          const re = new RegExp(rule.pattern, 'i');
          matches = re.test(narr);
        } catch {
          matches = false;
        }
      } else {
        // 'contains' (default)
        matches = narrLower.includes(patLower);
      }

      if (matches) {
        // Resolve target ledger for this account (acid)
        let resolvedLedger = ledgers.find((l: any) => l.id === rule.targetLedgerId && l.acid === acid);
        if (!resolvedLedger) {
          // Find matching ledger name for this acid
          resolvedLedger = ledgers.find((l: any) => 
            l.acid === acid && 
            l.name.toLowerCase().trim() === rule.targetLedgerName.toLowerCase().trim()
          );
        }
        if (!resolvedLedger) {
          resolvedLedger = ledgers.find((l: any) => l.id === rule.targetLedgerId);
        }

        if (resolvedLedger) {
          return {
            ...txn,
            targetLedgerId: resolvedLedger.id,
            targetLedgerName: resolvedLedger.name,
            matchedRuleId: rule.id,
            matchedRulePattern: rule.pattern
          };
        }
      }
    }

    return txn;
  });
}

// ── Duplicate & Dividend Detection Engine ───────────────────────────────────

export function detectDuplicates(
  txns: ParsedBankTransaction[],
  bankLedgerId: number,
  acid: number
): ParsedBankTransaction[] {
  const vouchers = state.vouchersC1 || [];
  const trans = state.transC1 || [];
  const ledgers = state.acmac1 || [];

  // Filter vouchers and transactions relevant to this bank ledger (handling type coercion)
  const bankTrans = trans.filter((t: any) => Number(t.maid) === Number(bankLedgerId));

  // Set of voucher IDs already claimed by earlier transactions in this statement to avoid double-matching
  const matchedVoucherIds = new Set<number>();

  // Map to track duplicate identical lines within the uploaded statement itself
  const seenInBatch = new Map<string, number>();

  // Extract dividend keywords from narration
  function extractDividendCompany(narr: string): string {
    const clean = narr.toUpperCase();
    // Pattern 1: NACH/COMPANY NAME/ or NACH/COMPANY NAME FNL-DIV
    const m1 = clean.match(/NACH\/([A-Z0-9\s\-]+?)(?:[- ]*(?:FINL?|FNL|INT|INTERIM)?[- ]*DIV|\/|\d{4})/i);
    if (m1 && m1[1].trim()) return m1[1].replace(/[-_]/g, ' ').trim();

    // Pattern 2: NEFT ... BROKERAGE or MUTUAL
    const m2 = clean.match(/NEFT\s+[A-Z0-9]+\s+([A-Z0-9\s]+?)(?:BROKERAGE|MUTUAL|PAYMENT|\/|$)/i);
    if (m2 && m2[1].trim()) return m2[1].trim();

    // Pattern 3: Common dividend words
    if (clean.includes('DIV') || clean.includes('DIVIDEND')) {
      // Return first 3 words
      const words = clean.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'DIV' && w !== 'DIVIDEND' && w !== 'NACH' && w !== 'NEFT');
      return words.slice(0, 2).join(' ');
    }

    return '';
  }

  return txns.map(txn => {
    const isDeposit = txn.credit > 0;
    const isWithdrawal = txn.debit > 0;
    const amount = isDeposit ? txn.credit : txn.debit;
    if (amount <= 0) return txn;

    // 0. Intra-batch duplicate detection (multiple identical rows in uploaded file)
    const batchKey = `${txn.date}_${txn.debit}_${txn.credit}_${(txn.chqRef || '').trim()}_${(txn.narration || '').trim().toUpperCase()}`;
    const prevSeen = seenInBatch.get(batchKey) || 0;
    seenInBatch.set(batchKey, prevSeen + 1);
    if (prevSeen > 0) {
      return {
        ...txn,
        isDuplicate: true,
        selected: false,
        duplicateReason: `Duplicate entry within imported statement (${prevSeen + 1} occurrences)`
      };
    }

    const txnDateMs = new Date(txn.date).getTime();

    // 1. Direct Voucher Duplicate Check (Bank Ledger entries in transc1)
    for (const tr of bankTrans) {
      const trVid = Number(tr.vid);
      if (matchedVoucherIds.has(trVid)) continue;

      // In double entry:
      // Deposit in Bank Statement = Dr in Bank Ledger (dramt)
      // Withdrawal in Bank Statement = Cr in Bank Ledger (cramt)
      const trAmt = isDeposit ? Number(tr.dramt) : Number(tr.cramt);
      if (Math.abs(trAmt - amount) <= 0.50) {
        const trDateMs = new Date(tr.dt).getTime();
        const diffDays = Math.abs(txnDateMs - trDateMs) / (1000 * 60 * 60 * 24);
        if (diffDays <= 4) {
          matchedVoucherIds.add(trVid);
          return {
            ...txn,
            isDuplicate: true,
            selected: false, // Deselect duplicates by default
            duplicateReason: `Existing Voucher #${tr.vid} on ${tr.dt} (₹${trAmt.toLocaleString('en-IN')})`,
            duplicateVoucherId: tr.vid
          };
        }
      }
    }

    // 2. Dividend Recon & PMS Corporate Payout Duplicate Check
    // If dividend was recorded via Dividend Recon or PMS, match narration company + credit amount
    if (isDeposit) {
      const isDivNarration = /(?:DIV|DIVIDEND|IDCW|FNL-DIV|INT-DIV|INTERIM|PAYOUT)/i.test(txn.narration);
      const companyKeyword = extractDividendCompany(txn.narration);

      if (isDivNarration || companyKeyword) {
        // Look through vouchers for matching dividend
        for (const v of vouchers) {
          const vVid = Number(v.vid);
          if (matchedVoucherIds.has(vVid)) continue;

          // Dividend vouchers have vtyp 2 (receipt) or 4 or narration mentioning dividend
          const vNarrUpper = (v.narr || '').toUpperCase();
          const isDivVoucher = v.vtyp === 2 || vNarrUpper.includes('DIVIDEND') || vNarrUpper.includes('PAYOUT');
          if (!isDivVoucher) continue;

          // Check if voucher account matches
          if (v.acid && v.acid !== acid) continue;

          // Check if company keyword matches voucher narration
          let keywordMatched = false;
          if (companyKeyword && companyKeyword.length >= 3) {
            const tokens = companyKeyword.split(/\s+/).filter(t => t.length >= 3);
            keywordMatched = tokens.some(t => vNarrUpper.includes(t));
          }

          // Check voucher amount in transc1
          const vLines = trans.filter((t: any) => t.vid === v.vid);
          const vBankLine = vLines.find((t: any) => Number(t.maid) === Number(bankLedgerId));
          const vIncomeLine = vLines.find((t: any) => {
            const l = ledgers.find((m: any) => m.id === t.maid);
            return l && (l.name.toLowerCase().includes('dividend') || l.name.toLowerCase().includes('interest'));
          });

          const vGrossAmt = vIncomeLine ? Number(vIncomeLine.cramt) : (vBankLine ? Number(vBankLine.dramt) : 0);
          const vNetAmt = vBankLine ? Number(vBankLine.dramt) : vGrossAmt;

          // Check amount match: exact net match OR gross match OR within 10% TDS tolerance
          const amtMatched = Math.abs(vNetAmt - amount) <= 1.0 || 
                             Math.abs(vGrossAmt - amount) <= 1.0 ||
                             Math.abs((vGrossAmt * 0.9) - amount) <= 1.5;

          if (keywordMatched && amtMatched) {
            const vDateMs = new Date(v.dt).getTime();
            const diffDays = Math.abs(txnDateMs - vDateMs) / (1000 * 60 * 60 * 24);
            // Dividend payments often clear within 35 days of declaration / record date
            if (diffDays <= 35) {
              matchedVoucherIds.add(vVid);
              return {
                ...txn,
                isDuplicate: true,
                selected: false, // Deselect duplicate automatically
                duplicateReason: `Dividend Recon / PMS: Voucher #${v.vid} (${companyKeyword} - ₹${vNetAmt.toLocaleString('en-IN')})`,
                duplicateVoucherId: v.vid
              };
            }
          }
        }
      }
    }

    return txn;
  });
}

// ── Double-Entry Post Engine ────────────────────────────────────────────────

export async function postBankTransactionsToAccounting(
  transactions: ParsedBankTransaction[],
  bankLedgerId: number,
  acid: number,
  portfolioId?: number
): Promise<{
  success: boolean;
  postedCount: number;
  createdVouchers: number[];
  error?: string;
}> {
  // STRICT duplicate avoidance: duplicates are never posted to avoid double entries in accounting
  const toPost = transactions.filter(t => t.selected && t.targetLedgerId && !t.isDuplicate);

  if (toPost.length === 0) {
    return { success: false, postedCount: 0, createdVouchers: [], error: 'No valid transactions selected with counterpart ledgers (duplicates are strictly excluded).' };
  }

  // Build balanced double-entry voucher payloads
  const voucherDataList: any[] = [];

  for (const txn of toPost) {
    const isDeposit = txn.credit > 0;
    const amount = isDeposit ? txn.credit : txn.debit;
    const targetLedger = (state.acmac1 || []).find((l: any) => l.id === txn.targetLedgerId);
    const isTargetBankOrCash = targetLedger && [60, 75, 90].includes(Number(targetLedger.parent_id));

    let type: 'payment' | 'receipt' | 'contra' = isDeposit ? 'receipt' : 'payment';
    if (isTargetBankOrCash) {
      type = 'contra';
    }

    // Double Entry Lines:
    // 1. For Deposit (Receipt):
    //    Dr Bank Ledger (funds received)
    //    Cr Counterpart Ledger (income / party / asset)
    // 2. For Withdrawal (Payment):
    //    Dr Counterpart Ledger (expense / party / asset)
    //    Cr Bank Ledger (funds paid)
    const lines = isDeposit
      ? [
          { ledgerId: String(bankLedgerId), debit: amount, credit: 0 },
          { ledgerId: String(txn.targetLedgerId), debit: 0, credit: amount }
        ]
      : [
          { ledgerId: String(txn.targetLedgerId), debit: amount, credit: 0 },
          { ledgerId: String(bankLedgerId), debit: 0, credit: amount }
        ];

    voucherDataList.push({
      accountId: acid,
      portfolioId: portfolioId || null,
      type,
      date: txn.date,
      narration: txn.narration + (txn.chqRef ? ` [Ref: ${txn.chqRef}]` : ''),
      lines
    });
  }

  try {
    console.log(`🚀 Posting ${voucherDataList.length} bank transactions to Accounting Engine...`);
    await createVouchersBulk(voucherDataList);
    await persistStateToIDB();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wealthcore-sync-complete'));
    }

    return {
      success: true,
      postedCount: voucherDataList.length,
      createdVouchers: []
    };
  } catch (err: any) {
    console.error('Failed to post bank vouchers:', err);
    return {
      success: false,
      postedCount: 0,
      createdVouchers: [],
      error: err?.message || String(err)
    };
  }
}
