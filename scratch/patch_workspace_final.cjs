const fs = require('fs');
let c = fs.readFileSync('src/pages/PMSWorkspace.tsx', 'utf8');

if (!c.includes('getAccPflink')) {
  c = c.replace(
    "} from '../logic';",
    "  getAccPflink\n} from '../logic';"
  );
}

const regex = /\{selectedAssetForLedger && \(\s*<AssetLedgerModal[\s\S]*?onEditTransaction=\{setEditingVoucherId\}\s*\/>\s*\)\}/;

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
              ledgerId={String(Math.abs(Number(selectedAssetForLedger.id)))}
              acid={getAccPflink().find((l: any) => l.pfid === Number(selectedAssetForLedger.portIds[0]))?.acid}
              onClose={() => setSelectedAssetForLedger(null)}
              onVoucherClick={setEditingVoucherId}
            />
          </div>
        )}`;

if (regex.test(c)) {
  fs.writeFileSync('src/pages/PMSWorkspace.tsx', c.replace(regex, rep));
  console.log('Successfully patched PMSWorkspace with LedgerDrilldownModal and getAccPflink');
} else {
  console.log('Regex not found in PMSWorkspace');
}
