const fs = require('fs');
['acmac1.json', 'bs1.json', 'sum_table.json', 'trans1.json', 'transc1.json', 'vouchers1.json', 'vouchersc1.json'].forEach(f => {
  const p = 'backups/latest_snapshot/' + f;
  if (!fs.existsSync(p)) return;
  const list = JSON.parse(fs.readFileSync(p, 'utf8'));
  list.forEach(item => {
    Object.entries(item).forEach(([k, v]) => {
      const n = Number(v);
      if (n >= 404600 && n <= 404700) {
        console.log(`Found in ${f}: key=${k} val=${v}`, JSON.stringify(item));
      }
    });
  });
});
