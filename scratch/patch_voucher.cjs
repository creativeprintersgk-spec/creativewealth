const fs = require('fs');
let code = fs.readFileSync('src/VoucherModal.tsx', 'utf8');

code = code.replace(
  'import { useState, useEffect, useCallback } from "react";',
  'import React, { useState, useEffect, useCallback, useMemo } from "react";'
);

const beforeLedgers = `  const groups = getStoredGroups();
  const mappedLedgers = getStoredLedgers().map(l => ({
    id: l.id,
    name: l.name,
    type: l.name.toLowerCase().includes("bank")
      ? "bank"
      : l.name.toLowerCase().includes("cash")
      ? "cash"
      : "other",
    accountingType: groups.find(g => g.id === l.groupId)?.type || "ASSET",
  }));`;

const afterLedgers = `  const groups = getStoredGroups();
  const mappedLedgers = useMemo(() => getStoredLedgers().map(l => ({
    id: l.id,
    name: l.name,
    type: l.name.toLowerCase().includes("bank")
      ? "bank"
      : l.name.toLowerCase().includes("cash")
      ? "cash"
      : "other",
    accountingType: groups.find(g => g.id === l.groupId)?.type || "ASSET",
  })), [groups]);`;

code = code.replace(beforeLedgers, afterLedgers);

code = code.replace(
  '{mappedLedgers.filter(l => l.name.toLowerCase().includes(mainAccountSearch.toLowerCase())).map(l => (',
  '{mappedLedgers.filter(l => l.name.toLowerCase().includes(mainAccountSearch.toLowerCase())).slice(0, 50).map(l => ('
);

code = code.replace(
  '{mappedLedgers.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).map(l => (',
  '{mappedLedgers.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 50).map(l => ('
);

fs.writeFileSync('src/VoucherModal.tsx', code);
console.log('VoucherModal.tsx patched');
