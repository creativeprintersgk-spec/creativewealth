import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useLedgers(acid: string | number | null | undefined) {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!acid) {
      setLedgers([]);
      return;
    }
    
    async function fetchLedgers() {
      setLoading(true);
      const { data, error } = await supabase
        .from('acmac1')
        .select('*')
        .eq('acid', Number(acid))
        .order('id');
        
      if (!error && data) {
        setLedgers(data);
      }
      setLoading(false);
    }
    
    fetchLedgers();
  }, [acid]);

  return { ledgers, loading };
}

export function useVouchers(acid: string | number | null | undefined) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!acid) {
      setVouchers([]);
      setTransactions([]);
      return;
    }
    
    async function fetchData() {
      setLoading(true);
      const [vRes, tRes] = await Promise.all([
        supabase.from('vouchersc1').select('*').eq('acid', Number(acid)).order('vid'),
        // In bs1, we join with vouchersc1. So we might need all bs1 that belong to this acid.
        // Actually bs1 doesn't always have acid, but if we fetch all bs1 for the vids, that works.
        // To simplify, we can just fetch bs1 where acid = ... wait, bs1 doesn't have acid!
        // Wait, does bs1 have acid?
        supabase.from('bs1').select('*, vouchersc1!inner(acid)').eq('vouchersc1.acid', Number(acid))
      ]);
      
      if (!vRes.error && vRes.data) setVouchers(vRes.data);
      if (!tRes.error && tRes.data) {
        // Strip the joined vouchersc1 object
        setTransactions(tRes.data.map((r: any) => {
           const { vouchersc1, ...rest } = r;
           return rest;
        }));
      }
      setLoading(false);
    }
    
    fetchData();
  }, [acid]);

  return { vouchers, transactions, loading };
}
