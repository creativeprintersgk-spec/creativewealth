function DbConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<{ name: string; rowCount: number; data: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError('');
    setTables([]);

    try {
      const initSqlJs = await loadSqlJs();
      const SQL = await initSqlJs({
        locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
      });
      const buffer = await selectedFile.arrayBuffer();
      
      let db;
      try {
        db = new SQL.Database(new Uint8Array(buffer));
      } catch (e: any) {
        throw new Error(`Could not parse ${selectedFile.name} as a SQLite database. Error: ${e.message}`);
      }

      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tablesResult.length > 0) {
        const allTables = tablesResult[0].values.map((v: any) => v[0] as string);
        const extractedTables = [];
        for (const tableName of allTables) {
          const dataRes = db.exec(`SELECT * FROM "${tableName}"`);
          if (dataRes.length > 0) {
            const cols = dataRes[0].columns;
            const rows = dataRes[0].values;
            const formattedData = rows.map((row: any) => {
              const obj: any = {};
              cols.forEach((col: string, idx: number) => {
                obj[col] = row[idx];
              });
              return obj;
            });
            extractedTables.push({ name: tableName, rowCount: rows.length, data: formattedData });
          } else {
            extractedTables.push({ name: tableName, rowCount: 0, data: [] });
          }
        }
        setTables(extractedTables);
      } else {
        setError('No tables found in this SQLite database.');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (table: { name: string; data: any[] }) => {
    if (table.data.length === 0) {
      alert("Table is empty.");
      return;
    }
    const csvStr = Papa.unparse(table.data);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `${table.name}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllAsZip = async () => {
    if (tables.length === 0) return;
    
    const zip = new JSZip();
    let hasData = false;
    
    for (const table of tables) {
      if (table.data.length > 0) {
        hasData = true;
        const csvStr = Papa.unparse(table.data);
        zip.file(`${table.name}.csv`, csvStr);
      }
    }
    
    if (!hasData) {
      alert("No data found in any tables to zip.");
      return;
    }
    
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `MProfit_Export_${new Date().toISOString().split('T')[0]}.zip`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ padding: "32px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Database size={24} color="#8b5cf6" /> MProfit DB to CSV Converter
      </h2>
      <p style={{ color: "#64748b", marginBottom: "24px", lineHeight: 1.5 }}>
        Select your MProfit backup file (<code>.db</code>, <code>.sqlite</code>, or <code>.bak</code>). The system will read all tables inside it and let you download them as individual CSV files.
      </p>

      <div style={{ marginBottom: "24px" }}>
        <input 
          type="file" 
          accept=".db,.sqlite,.bak" 
          onChange={handleFileChange} 
          style={{ display: 'none' }}
          id="db-file-upload"
        />
        <label 
          htmlFor="db-file-upload" 
          style={{ padding: "12px 24px", background: "#8b5cf6", color: "#fff", borderRadius: "8px", cursor: "pointer", fontWeight: 600, display: "inline-block" }}
        >
          {loading ? "Reading Database..." : "Select SQLite Database File"}
        </label>
        {file && <span style={{ marginLeft: "16px", color: "#475569", fontWeight: 600 }}>{file.name}</span>}
      </div>

      {error && (
        <div style={{ padding: "16px", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginBottom: "24px", border: "1px solid #f87171" }}>
          {error}
        </div>
      )}

      {tables.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1e293b" }}>
              Found {tables.length} Tables
            </h3>
            <button
              onClick={downloadAllAsZip}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
                background: "#8b5cf6", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer"
              }}
            >
              <Download size={16} /> Download All as ZIP
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {tables.map(t => (
              <div key={t.name} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#334155", wordBreak: "break-all" }}>{t.name}</span>
                  <span style={{ fontSize: "12px", background: "#e2e8f0", padding: "4px 8px", borderRadius: "100px", color: "#475569", fontWeight: 600 }}>
                    {t.rowCount} rows
                  </span>
                </div>
                <button 
                  onClick={() => downloadCsv(t)}
                  disabled={t.rowCount === 0}
                  style={{ 
                    padding: "8px", background: t.rowCount === 0 ? "#cbd5e1" : "#10b981", color: "#fff", 
                    border: "none", borderRadius: "6px", fontWeight: 600, cursor: t.rowCount === 0 ? "not-allowed" : "pointer" 
                  }}
                >
                  Download {t.name}.csv
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
