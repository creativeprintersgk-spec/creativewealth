-- ============================================================================
-- WEALTHCORE: REMOVE ANONYMOUS PUBLIC ACCESS
-- ============================================================================
-- Problem: existing policies grant `anon` role full read/write on every table.
-- The anon key is bundled into the client JS bundle and is visible to anyone
-- who opens dev tools, so today anyone with your Vercel URL can read/write/
-- delete every row (PAN numbers, bank accounts, all financial data) directly
-- via the Supabase REST API, bypassing the app UI entirely.
--
-- Fix: drop every policy that grants access to `anon`, and replace with
-- policies that only grant access to `authenticated` (i.e. someone who has
-- actually logged in via Supabase Auth). This does NOT set up per-user row
-- ownership (auth.uid() = owner_id) -- that's a separate, bigger change only
-- needed if this app will ever have more than one family/tenant. For a
-- single-family tool, "must be logged in at all" is the right bar.
--
-- Run this AFTER you've created at least one Supabase Auth user for
-- yourself (Supabase Dashboard -> Authentication -> Users -> Add User),
-- otherwise you will lock yourself out until the app's login screen is wired
-- up (see src/AuthGate.tsx).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    pol RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        -- Drop every existing policy on this table, regardless of name,
        -- so we don't leave old "Allow all access" / anon-inclusive policies behind.
        FOR pol IN (
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = r.tablename
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, r.tablename);
        END LOOP;

        -- Ensure RLS is enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);

        -- Recreate access for authenticated users ONLY (anon excluded)
        EXECUTE format(
            'CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
            r.tablename
        );

        RAISE NOTICE 'Locked down table: % (authenticated-only)', r.tablename;
    END LOOP;
END $$;

-- Verify: this should show rowsecurity = true for every table, and NO policy
-- should list "anon" in its roles.
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT
    schemaname,
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
