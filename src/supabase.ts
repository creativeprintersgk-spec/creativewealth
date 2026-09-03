import { createClient } from '@supabase/supabase-js';
const g = globalThis as any;
const supabaseUrl = (typeof import.meta.env !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : (g.process && g.process.env ? g.process.env.VITE_SUPABASE_URL : '')) || 'https://placeholder.supabase.co';
const supabaseAnonKey = (typeof import.meta.env !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : (g.process && g.process.env ? g.process.env.VITE_SUPABASE_ANON_KEY : '')) || 'placeholder';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
