/**
 * Add ALL missing handler functions to ImportPage.tsx at once.
 * Inserts them right before the return() statement.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/ImportPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find insert point — before the return statement
const returnIdx = content.indexOf('\n  return (');
if (returnIdx < 0) {
  console.error('Cannot find return statement');
  process.exit(1);
}

const HANDLERS = `
  // ── Top-level portfolio/date change handlers ─────────────────────────────
  const handleTopPortfolioChange = (portfolioId: string) => {
    setSelectedPortfolio(portfolioId);
  };

  const handleTopCnDateChange = (date: string) => {
    setCnDate(date);
  };

  // ── Broker contract note PDF/CSV file select ──────────────────────────────
  const handleBrokerCnFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // If PDF, prompt for password
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setPendingFile(file);
      setPasswordPromptOpen(true);
    } else {
      // Parse as CSV
      const text = await file.text();
      console.log('Broker CN file selected:', file.name, 'size:', text.length);
    }
    e.target.value = '';
  };

  // ── CN Trade row management ───────────────────────────────────────────────
  const handleAddCnTradeRow = () => {
    const newRow = {
      id: Date.now(),
      assetName: '',
      amid: -1,
      type: 'buy',
      quantity: 0,
      price: 0,
      amount: 0,
    };
    setCnTrades(prev => [...prev, newRow]);
  };

  const handleUpdateCnTradeRow = (id: number, field: string, value: any) => {
    setCnTrades(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, [field]: value };
      // Auto-compute amount if qty/price updated
      if (field === 'quantity' || field === 'price') {
        updated.amount = Number(updated.quantity || 0) * Number(updated.price || 0);
      }
      return updated;
    }));
  };

  const handleDeleteCnTradeRow = (id: number) => {
    setCnTrades(prev => prev.filter(t => t.id !== id));
  };

  // ── Password prompt (for encrypted PDFs) ─────────────────────────────────
  const handlePasswordSubmit = async () => {
    if (!pendingFile) return;
    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await pendingFile.arrayBuffer();
      await pdfjs.getDocument({ data: arrayBuffer, password: tempPassword }).promise;
      setPdfPassword(tempPassword);
      setPasswordPromptOpen(false);
      setPasswordError('');
      // File is now unlocked — parse it
      console.log('PDF unlocked successfully:', pendingFile.name);
    } catch {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handlePasswordCancel = () => {
    setPasswordPromptOpen(false);
    setPendingFile(null);
    setTempPassword('');
    setPasswordError('');
  };

`;

content = content.slice(0, returnIdx) + HANDLERS + content.slice(returnIdx);
fs.writeFileSync(filePath, content, 'utf8');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
const fns = ['handleTopPortfolioChange','handleTopCnDateChange','handleBrokerCnFileSelect',
  'handleAddCnTradeRow','handleUpdateCnTradeRow','handleDeleteCnTradeRow',
  'handlePasswordSubmit','handlePasswordCancel'];
console.log('── Verification ──');
fns.forEach(fn => console.log(fn+':', verify.includes('const '+fn) ? 'EXISTS' : 'MISSING'));
