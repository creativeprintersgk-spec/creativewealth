import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const query = `
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow public access" ON public.%I;', r.tablename);
        EXECUTE format('CREATE POLICY "Allow public access" ON public.%I FOR ALL USING (true) WITH CHECK (true);', r.tablename);
      END LOOP;
    END $$;
  `;

  const { data, error } = await sb.rpc('exec_sql', { query });
  console.log('Result:', data, 'Error:', error);
}

main();
