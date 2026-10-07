import { useEffect, useState } from "react";
import { openDB } from "idb";
import { saveLedger } from "../logic";
import { v4 as uuid } from "uuid";

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function readAllDBs() {
      const result: any = {};

      // Read wealthcore-db (current)
      try {
        const db1 = await openDB("wealthcore-db", 3);
        result["wealthcore-db"] = {
          ledgers: await db1.getAll("ledgers"),
          vouchers: await db1.getAll("vouchers"),
          entries: await db1.getAll("entries"),
          groups: await db1.getAll("groups"),
        };
        db1.close();
      } catch (e: any) {
        result["wealthcore-db"] = { error: e.message };
      }

      // Read mprofit-clone-db (legacy)
      try {
        const db2 = await openDB("mprofit-clone-db", 1);
        result["mprofit-clone-db"] = {
          ledgers: await db2.getAll("ledgers").catch(() => []),
          vouchers: await db2.getAll("vouchers").catch(() => []),
          entries: await db2.getAll("entries").catch(() => []),
          groups: await db2.getAll("groups").catch(() => []),
        };
        db2.close();
      } catch (e: any) {
        result["mprofit-clone-db"] = { error: e.message };
      }

      // Read localStorage keys
      const lsKeys: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const val = localStorage.getItem(key) || "";
        try {
          const parsed = JSON.parse(val);
          lsKeys[key] = `[${Array.isArray(parsed) ? parsed.length + " items" : "object"}]`;
        } catch {
          lsKeys[key] = val.slice(0, 80);
        }
      }
      result["localStorage"] = lsKeys;

      setData(result);
      setLoading(false);
    }

    readAllDBs();
  }, []);

  if (loading) return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      Reading IndexedDB...
    </div>
  );

  const handleSeed = async () => {
    if (!window.confirm("Add Arjin Saahil Shah opening balances?")) return;
    
    const ledgers = [
      { id: uuid(), name: "Capital Account", groupId: "capital_account", openingBalance: 483277, openingType: "CR", currentBalance: 0, currentType: "CR" },
      { id: uuid(), name: "Interest On Saving Account", groupId: "income", openingBalance: 911, openingType: "CR", currentBalance: 0, currentType: "CR" },
      { id: uuid(), name: "Long Term Gain (Equity)", groupId: "capital_gains", openingBalance: 4971.73, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "STT - MFs", groupId: "stt", openingBalance: 0.55, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Jewellery", groupId: "jewellery", openingBalance: 307500, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "BANDHAN Arbitrage Fund-Direct Plan- Growth", groupId: "mf_equity", openingBalance: 35000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Edelweiss Nifty Midcap150 Momentum 50 Index Fund", groupId: "mf_equity", openingBalance: 10000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Edelweiss Nifty500 Multicap Momentum Quality 50 Index Fund", groupId: "mf_equity", openingBalance: 10000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "ICICI Prudential Dividend Yield Equity Fund", groupId: "mf_equity", openingBalance: 20000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Mirae Asset Nifty MidSmallcap400 Momentum Quality 100 ETF", groupId: "mf_equity", openingBalance: 25000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "SBI Contra Fund - Direct Plan - Growth", groupId: "mf_equity", openingBalance: 20000, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Cash on Hand", groupId: "cash", openingBalance: 504, openingType: "DR", currentBalance: 0, currentType: "DR" },
      { id: uuid(), name: "Kotak Bank (A/c. No. - 5348886437)", groupId: "bank", openingBalance: 51211.72, openingType: "DR", currentBalance: 0, currentType: "DR" }
    ];

    for (const l of ledgers) {
      await saveLedger(l as any);
    }
    
    alert("Seed complete! Refresh the page.");
    window.location.reload();
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", fontSize: "13px", overflowY: "auto" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
          📊 Raw Database Contents
        </h1>
        <button onClick={handleSeed} style={{ padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
          Seed Arjin Shah Data
        </button>
      </div>

      {Object.entries(data).map(([dbName, stores]: [string, any]) => (
        <div key={dbName} style={{ marginBottom: "2rem", border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ background: "#1a1a1a", color: "#10b981", padding: "10px 16px", fontWeight: 700 }}>
            {dbName}
          </div>

          {"error" in stores ? (
            <div style={{ padding: "12px 16px", color: "#ef4444" }}>❌ Error: {stores.error}</div>
          ) : (
            Object.entries(stores).map(([storeName, items]: [string, any]) => (
              <div key={storeName} style={{ borderTop: "1px solid #eee" }}>
                <div style={{ padding: "8px 16px", background: "#f8f9fa", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                  <span>{storeName}</span>
                  <span style={{ color: "#666" }}>{Array.isArray(items) ? items.length : 0} records</span>
                </div>
                {Array.isArray(items) && items.length > 0 ? (
                  <div style={{ padding: "0 16px 12px", maxHeight: "200px", overflowY: "auto" }}>
                    <pre style={{ fontSize: "11px", color: "#333", margin: 0 }}>
                      {JSON.stringify(items.slice(0, 20), null, 2)}
                    </pre>
                    {items.length > 20 && (
                      <div style={{ color: "#999", fontSize: "11px" }}>... and {items.length - 20} more</div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "8px 16px", color: "#999", fontStyle: "italic" }}>
                    {typeof items === "object" && !Array.isArray(items)
                      ? JSON.stringify(items)
                      : "empty"}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
