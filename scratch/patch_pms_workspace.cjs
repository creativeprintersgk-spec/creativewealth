const fs = require('fs');
let c = fs.readFileSync('src/pages/PMSWorkspace.tsx', 'utf8');

c = c.replace(/const \[activeAssetType, setActiveAssetType\] = useState<string>\('all'\);/, `const [activeAssetType, setActiveAssetType] = useState<string>('all');
  const [sortMode, setSortMode] = useState<string>('currentValue');
  const [showZeroQty, setShowZeroQty] = useState<boolean>(false);`);

c = c.replace(/const holdings = useMemo\(\(\) => \{([\s\S]*?)return getHoldings\(currentTab\.portfolioIds\.map\(Number\), filterIds\);\s+\}, \[currentTab, activeAssetType, customRange\.end\]\);/, `const holdings = useMemo(() => {
    if (!currentTab) return [];
    const filterIds = activeAssetType === 'all' ? undefined : (ATTY_MAP[activeAssetType] || []);
    let data = getHoldings(currentTab.portfolioIds.map(Number), filterIds);

    if (!showZeroQty) {
      data = data.filter((h: any) => h.quantity > 0.0001);
    }

    if (sortMode === 'name') {
      data.sort((a: any, b: any) => a.assetName.localeCompare(b.assetName));
    } else if (sortMode === 'currentValue') {
      data.sort((a: any, b: any) => b.currentValue - a.currentValue);
    } else if (sortMode === 'todayGain') {
      data.sort((a: any, b: any) => b.todaysGain - a.todaysGain);
    } else if (sortMode === 'todayGainPct') {
      data.sort((a: any, b: any) => b.todaysGainPct - a.todaysGainPct);
    } else if (sortMode === 'overallGain') {
      data.sort((a: any, b: any) => b.overallGain - a.overallGain);
    } else if (sortMode === 'overallGainPct') {
      data.sort((a: any, b: any) => b.overallGainPct - a.overallGainPct);
    }

    return data;
  }, [currentTab, activeAssetType, customRange.end, sortMode, showZeroQty]);`);

c = c.replace(/<button className="dropdown-item">Sort By Current Value<\/button>[\s\S]*?<button className="dropdown-item">Show 0 Values<\/button>/, `<button className="dropdown-item" onClick={() => setSortMode('name')}>Sort By Name</button>
                    <button className="dropdown-item" onClick={() => setSortMode('currentValue')}>Sort By Current Value</button>
                    <button className="dropdown-item" onClick={() => setSortMode('todayGainPct')}>Sort By Today's Gain %</button>
                    <button className="dropdown-item" onClick={() => setSortMode('overallGainPct')}>Sort By Overall Gain %</button>
                    <button className="dropdown-item" onClick={() => setSortMode('overallGain')}>Sort By Overall Gain</button>
                    <button className="dropdown-item" onClick={() => setSortMode('todayGain')}>Sort By Today's Gain</button>
                    <button className="dropdown-item" onClick={() => setShowZeroQty(!showZeroQty)}>{showZeroQty ? 'Hide 0 Values' : 'Show 0 Values'}</button>`);

fs.writeFileSync('src/pages/PMSWorkspace.tsx', c);
