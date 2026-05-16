ALTER TABLE ledgers ADD COLUMN amid INTEGER REFERENCES asset_master(amid);
