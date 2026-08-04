{"step_index":3735,"source":"MODEL","type":"RUN_COMMAND","status":"DONE","created_at":"2026-06-17T04:01:56Z","content":"Created At: 2026-06-17T04:01:56Z
Completed At: 2026-06-17T04:01:58Z

\t\t\t\tThe command completed successfully.
\t\t\t\tOutput:
\t\t\t\tMProfit DB Import States\\r\
351:   const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});\
352:   const hasStaged = Object.keys(stagedFiles).length > 0;\
353:   const missingRequired = TABLE_CONFIGS.filter(t => \
354:     t.required && !stagedFiles[t.key]\
355:   );\\r\
356:   const [tableStatus, setTableStatus] = useState<Record<string, TableStatus>>(() => {\\r\
357:     const initial: Record<string, TableStatus> = {};\\r\
358:     TABLE_CONFIGS.forEach(t => {\\r\
359:       initial[t.key] = { status: \\\"idle\\\", rowCount: 0, progress: 0 };\\r\
360:     });\\r\
361:     return initial;\\r\
362:   });\\r\
363: \\r\
364:   const [isImporting, setIsImporting] = useState(false);\\r\
365:   const [overallProgress, setOverallProgress] = useState(0);\\r\
366:   const [overallMessage, setOverallMessage] = useState(\\\"\\\");\\r\
367:   const [importComplete, setImportComplete] = useState(false);\\r\
368:   const [isDragging, setIsDragging] = useState(false);\\r\
369: \\r\
370:   // Dropdown options\\r\
371:   const [portfolios, setPortfolios] = useState<any[]>([]);\\r\
372:   const [brokerLedgers, setBrokerLedgers] = useState<any[]>([]);\\r\
373: \\r\
374:   // Decryption States\\r\
375:   const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);\\r\
376:   const [pendingFile, setPendingFile] = useState<File | null>(null);\\r\
377:   const [pdfPassword, setPdfPassword] = useState(\\\"\\\");\\r\
378:   const [tempPassword, setTempPassword] = useState(\\\"\\\");\\r\
379:   const [passwordError, setPasswordError] = useState(\\\"\\\");\\r\
380: \\r\
381:   // Autocomplete Suggestions State\\r\
382:   const [searchQuery,\
<truncated 1414 bytes>\
electors().catch(console.error);\\r\
417:   }, [refreshKey]);\\r\
418: \\r\
419:   // Load broker ledgers dynamically when selectedPortfolio changes or selected broker parser changes\\r\
420:   useEffect(() => {\\r\
421:     if (!selectedPortfolio || portfolios.length === 0) return;\\r\
422:     const pf = portfolios.find(p => S
MProfit DB Import States\\\\r\\\
  const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});\\\
  const hasStaged = Object.keys(stagedFiles).length > 0;\\\\r\\\
  cons\
MProfit DB Import States\\\\r\\\
351:   const [stagedFiles, setStagedFiles] = useState<Record<string, { rows: any[]; fileName: string }>>({});\\\
352:   const hasStaged = Object.keys(stagedFiles).length > 0;\
MProfit DB Import States\\\\r\\\
+  const { isTestMode } = useTestMode();\\\
+  const fileInputRef = useRef<HTMLInputElement>(null);\\\
+\\\
+  // EMERGENCY CLEANUP FOR CORRUPTED CONTRACT NOTE\\\
+  useEffect(() =\
MProfit DB Import States\\\\\\\\\\\\\\\" scratch\\\\\\\\\\\\\\\\*\\\\\\\"\\\",\\\"Cwd\\\":\\\"\\\\\\\"c:\\\\\\\\\\\\\\\\Users\\\\\\\\\\\\\\\\Admin\\\\\\\\\\\\\\\\Desktop\\\\\\\\\\\\\\\\wealthcore-clean\\\\\\\"\\\",\\\"WaitMsBeforeAsync\\\":\\\"5000\\\",\\\"toolAction\\\":\\\"\\\\\\\"Searching for \
\
\"}

"}