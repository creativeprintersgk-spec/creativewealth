const fs = require('fs');
let c = fs.readFileSync('src/pages/PMSWorkspace.tsx', 'utf8');

c = c.replace(
  "(window as any)._appState?.accPflink?.find((l: any)",
  "getAccPflink().find((l: any)"
);

if (!c.includes('getAccPflink')) {
  c = c.replace(
    "} from '../logic';",
    "  getAccPflink\n} from '../logic';"
  );
}

fs.writeFileSync('src/pages/PMSWorkspace.tsx', c);
console.log('Fixed PMSWorkspace getAccPflink');
