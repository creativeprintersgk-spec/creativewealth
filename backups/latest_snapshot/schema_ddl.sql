-- ==============================================================================
-- WEALTHCORE COMPLETE SUPABASE SCHEMA & COLUMN DEFINITION DDL SCRIPT
-- Generated: 2026-08-18T07:35:02.447Z
-- PURPOSE: If table columns are deleted, altered, or modified in Supabase,
-- paste and run this in Supabase SQL Editor to restore exact original columns.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: acc_pflink
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acc_pflink (
  "pfid" BIGINT,
  "acid" BIGINT,
  "is_op_bal_to_be_recalc" TEXT,
  "action_flag" TEXT,
  "client_id" BIGINT
);

ALTER TABLE public.acc_pflink ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'acc_pflink' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.acc_pflink FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: acmac1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acmac1 (
  "id" BIGINT,
  "ext_id" TEXT,
  "parent_id" BIGINT,
  "parent_ext_id" TEXT,
  "is_group" BOOLEAN,
  "name" TEXT,
  "disp_seqno" BIGINT,
  "descr" TEXT,
  "flags" TEXT,
  "acid" BIGINT,
  "clid" BIGINT,
  "is_it_ledger" TEXT,
  "special_type_id" BIGINT,
  "cr_bal" BIGINT,
  "db_bal" BIGINT,
  "tree_node" TEXT,
  "addr" TEXT,
  "pan" TEXT,
  "addinfo" TEXT
);

ALTER TABLE public.acmac1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'acmac1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.acmac1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: asset_master
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_master (
  "amid" BIGINT,
  "name" TEXT,
  "asset_type" BIGINT,
  "asset_type_name" TEXT,
  "exchange_group" TEXT,
  "amfi_code" TEXT,
  "bse_code" BIGINT,
  "nse_symbol" TEXT,
  "ticker" TEXT,
  "created_at" TEXT,
  "isin" TEXT
);

ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_master' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.asset_master FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: bs1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bs1 (
  "trid" BIGINT,
  "pfid" BIGINT,
  "amid" BIGINT,
  "atyid" BIGINT,
  "sid" BIGINT,
  "cnid" BIGINT,
  "trty" BIGINT,
  "trstr" TEXT,
  "acvch" TEXT,
  "dt" TEXT,
  "qn" BIGINT,
  "purpr" NUMERIC,
  "brkg" BIGINT,
  "netpr" NUMERIC,
  "amt" BIGINT,
  "chrgs" BIGINT,
  "narr" TEXT,
  "tmp_balq" BIGINT,
  "tmp_bala" BIGINT,
  "accinfo" TEXT,
  "taxetc" TEXT,
  "dtorigin" TEXT
);

ALTER TABLE public.bs1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bs1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.bs1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: portfolios
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolios (
  "id" BIGINT,
  "client_id" BIGINT,
  "investor_name" TEXT,
  "is_group" BOOLEAN,
  "full_name" TEXT,
  "investor_addr" TEXT,
  "city" TEXT,
  "pin_code" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "mobile" TEXT,
  "pan" TEXT,
  "exit_status" BIGINT,
  "risk_profile" TEXT,
  "view_settings" BIGINT,
  "pfolio_type" BIGINT,
  "ext_id" BIGINT
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolios' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.portfolios FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: scnote1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scnote1 (
  "cnid" BIGINT,
  "pfid" BIGINT,
  "aty" BIGINT,
  "brkrid" BIGINT,
  "cnnum" TEXT,
  "billnum" TEXT,
  "servtax" BIGINT,
  "stmpchrgs" BIGINT,
  "tranchrg" BIGINT,
  "stt" BIGINT,
  "othchrg" BIGINT,
  "amtdue" NUMERIC,
  "dt" TEXT,
  "isdue" TEXT,
  "isspec" TEXT,
  "cstr" TEXT
);

ALTER TABLE public.scnote1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scnote1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.scnote1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: sum_table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sum_table (
  "sid" BIGINT,
  "pfolio_id" BIGINT,
  "client_id" TEXT,
  "atty" BIGINT,
  "amid" BIGINT,
  "agentcode" TEXT,
  "qnt" BIGINT,
  "amtinv" BIGINT,
  "balpurc" BIGINT,
  "sellcnt" BIGINT,
  "currv" BIGINT,
  "tgain" BIGINT,
  "is_currv_manual" TEXT,
  "refno" TEXT,
  "ext_id" BIGINT,
  "flag" BIGINT,
  "relgain" NUMERIC,
  "today_amtinv" BIGINT,
  "today_quant" BIGINT,
  "tag" TEXT,
  "accinfo" TEXT
);

ALTER TABLE public.sum_table ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sum_table' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.sum_table FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: trans1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trans1 (
  "transid" BIGINT,
  "vid" BIGINT,
  "vtyp" BIGINT,
  "dt" TEXT,
  "maid" BIGINT,
  "ext_id" TEXT,
  "cramt" BIGINT,
  "dramt" BIGINT,
  "special_account" BIGINT,
  "narr" TEXT,
  "acid" BIGINT
);

ALTER TABLE public.trans1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trans1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.trans1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: transc1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transc1 (
  "transid" BIGINT,
  "vid" BIGINT,
  "vtyp" BIGINT,
  "dt" TEXT,
  "maid" BIGINT,
  "ext_id" TEXT,
  "cramt" BIGINT,
  "dramt" BIGINT,
  "special_account" BIGINT,
  "narr" TEXT,
  "acid" BIGINT
);

ALTER TABLE public.transc1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transc1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.transc1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: vouchers1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchers1 (
  "vid" BIGINT,
  "vtyp" BIGINT,
  "dt" TEXT,
  "narr" TEXT,
  "pms_trans_id" BIGINT,
  "cnid" BIGINT,
  "acctlist" TEXT,
  "extid_source" BIGINT,
  "pfid" TEXT,
  "atype" TEXT,
  "sid" TEXT,
  "imp_rec_id" BIGINT,
  "chqno" TEXT,
  "acid" BIGINT
);

ALTER TABLE public.vouchers1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vouchers1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.vouchers1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table: vouchersc1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchersc1 (
  "vid" BIGINT,
  "vtyp" BIGINT,
  "dt" TEXT,
  "narr" TEXT,
  "pms_trans_id" BIGINT,
  "cnid" BIGINT,
  "acctlist" TEXT,
  "extid_source" BIGINT,
  "pfid" BIGINT,
  "atype" BIGINT,
  "sid" BIGINT,
  "imp_rec_id" TEXT,
  "chqno" TEXT,
  "acid" BIGINT
);

ALTER TABLE public.vouchersc1 ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vouchersc1' AND policyname = 'Allow public access') THEN
    CREATE POLICY "Allow public access" ON public.vouchersc1 FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

