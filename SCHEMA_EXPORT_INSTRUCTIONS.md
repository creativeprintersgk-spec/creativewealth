# Exporting your live schema (closing the version-control gap)

`transc1`, `vouchersc1`, `bs1`, and `scnote1` — the tables everything in this
audit actually touches — do not appear in any `supabase_schema.sql` /
`supabase_add_*.sql` file in this repo. That means there is currently no
version-controlled source of truth for your actual database structure, and
during Step 6 I found real evidence of that gap causing bugs (createVouchersBulk
was writing a completely different column shape to transc1 than every reader
expected, because nothing was checking it against a tracked schema).

I don't have credentials to your live Supabase project, so I can't run this
myself — here's the exact command to run yourself, from Supabase's own
recommended approach:

## Option A: Supabase CLI (recommended)

```bash
# Install the CLI if you don't have it
npm install -g supabase

# Log in and link to your project (find PROJECT_REF in your Supabase dashboard URL)
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Dump schema only (no data) for the public schema
supabase db dump --schema public -f supabase_schema_LIVE_SNAPSHOT.sql
```

## Option B: Direct pg_dump (if you have the DB connection string)

Find your connection string in Supabase Dashboard → Project Settings → Database.

```bash
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  -f supabase_schema_LIVE_SNAPSHOT.sql
```

## After running either one

1. Commit `supabase_schema_LIVE_SNAPSHOT.sql` to the repo.
2. Diff it against the existing `supabase_schema.sql` and migration files —
   you'll likely find `transc1`/`vouchersc1`/`bs1`/`scnote1` defined there for
   the first time, and possibly other drift too.
3. Bring it to me (or Antigravity) and I'll reconcile it against what the code
   actually assumes — in particular, confirm `transc1` really has `dramt`/
   `cramt` columns (not `crdr`/`amount`), since that's what the Step 6 fix
   assumes based on consistent usage across every reader in the code, but I
   could not verify against the live table definition itself.
