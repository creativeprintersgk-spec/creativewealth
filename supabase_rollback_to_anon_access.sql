-- ============================================================================
-- WEALTHCORE: ROLLBACK / REVERT TO ANONYMOUS ACCESS (IF NEEDED)
-- ============================================================================
-- Use this script ONLY if you want to undo the lockdown and re-allow public
-- access (anon key without login) to your Supabase tables.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    pol RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        -- Drop existing policies
        FOR pol IN (
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = r.tablename
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, r.tablename);
        END LOOP;

        -- Re-enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);

        -- Grant access back to BOTH anon and authenticated
        EXECUTE format(
            'CREATE POLICY "Enable full access for application" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
            r.tablename
        );

        RAISE NOTICE 'Restored anon + authenticated access on table: %', r.tablename;
    END LOOP;
END $$;

-- Verify policies
SELECT
    schemaname,
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
