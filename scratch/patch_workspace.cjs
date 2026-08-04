const fs = require('fs');
let c = fs.readFileSync('src/pages/PMSWorkspace.tsx', 'utf8');

if (!c.includes("import LedgerDrilldownModal")) {
  c = c.replace(
    "import AssetLedgerModal from '../components/pms/AssetLedgerModal';",
    "import AssetLedgerModal from '../components/pms/AssetLedgerModal';\nimport LedgerDrilldownModal from '../LedgerDrilldownModal';"
  );
}

const target = `{selectedAssetForLedger && (
          <AssetLedgerModal 
            open={!!selectedAssetForLedger} 
            assetId={selectedAssetForLedger.id} 
            assetName={selectedAssetForLedger.name} 
            portfolioIds={selectedAssetForLedger.portIds} 
            onClose={() => setSelectedAssetForLedger(null)} 
            onEditTransaction={setEditingVoucherId}
          />
        )}`;

const rep = `{selectedAssetForLedger && Number(selectedAssetForLedger.id) > 0 && (
          <AssetLedgerModal 
            open={!!selectedAssetForLedger} 
            assetId={selectedAssetForLedger.id} 
            assetName={selectedAssetForLedger.name} 
            portfolioIds={selectedAssetForLedger.portIds} 
            onClose={() => setSelectedAssetForLedger(null)} 
            onEditTransaction={setEditingVoucherId}
          />
        )}
        {selectedAssetForLedger && Number(selectedAssetForLedger.id) < 0 && (
          <div style={{ position: 'relative', zIndex: 10000 }}>
            <LedgerDrilldownModal
              ledgerId={Math.abs(Number(selectedAssetForLedger.id))}
              acid={
                // Find acid dynamically from the portfolio link
                window._appState?.accPflink?.find((l: any) => l.pfid === Number(selectedAssetForLedger.portIds[0]))?.acid
              }
              onClose={() => setSelectedAssetForLedger(null)}
              onVoucherClick={setEditingVoucherId}
            />
          </div>
        )}`;

if (c.includes(target)) {
  fs.writeFileSync('src/pages/PMSWorkspace.tsx', c.replace(target, rep));
  console.log('Successfully patched PMSWorkspace with LedgerDrilldownModal');
} else {
  console.log('Target not found in PMSWorkspace');
}
