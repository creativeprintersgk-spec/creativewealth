import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Search, X, PieChart, Settings, ArrowLeft } from "lucide-react";
import {
  getStoredFamilies, getStoredAccounts, getStoredPortfolios, getStoredInvestorGroups,
  saveMasterRecord, deleteMasterRecord
} from "../logic";

type TabType = "families" | "accounts" | "portfolios" | "investorGroups";

export default function MasterEntry() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("families");
  const [families, setFamilies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [investorGroups, setInvestorGroups] = useState<any[]>([]);

  // Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [search, setSearch] = useState("");

  const refreshData = () => {
    setFamilies(getStoredFamilies());
    setAccounts(getStoredAccounts());
    setPortfolios(getStoredPortfolios());
    setInvestorGroups(getStoredInvestorGroups());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const openDrawer = (record: any = null) => {
    setEditingRecord(record);
    setFormData(record ? { ...record } : { id: Math.random().toString(36).substr(2, 9) });
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingRecord(null);
    setFormData({});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, createdAt: formData.createdAt || new Date().toISOString() };
    await saveMasterRecord(activeTab, dataToSave);
    refreshData();
    closeDrawer();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      await deleteMasterRecord(activeTab, id);
      refreshData();
    }
  };

  const renderTabs = () => (
    <div style={{ display: "flex", gap: "2px", background: "#e2e8f0", padding: "4px", borderRadius: "8px", width: "fit-content", marginBottom: "20px" }}>
      {[
        { id: "families", label: "Families" },
        { id: "accounts", label: "Accounts" },
        { id: "portfolios", label: "Portfolios" },
        { id: "investorGroups", label: "Investor Groups" }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => { setActiveTab(tab.id as TabType); setSearch(""); }}
          style={{
            padding: "8px 24px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            background: activeTab === tab.id ? "white" : "transparent",
            color: activeTab === tab.id ? "#0f172a" : "#64748b",
            boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s"
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const getFilteredData = () => {
    let data: any[] = [];
    if (activeTab === "families") data = families;
    if (activeTab === "accounts") data = accounts;
    if (activeTab === "portfolios") data = portfolios;
    if (activeTab === "investorGroups") data = investorGroups;

    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(s))
    );
  };

  // Render Table depending on Active Tab
  const renderTable = () => {
    const data = getFilteredData();

    if (activeTab === "families") {
      return (
        <table className="financial-table">
          <thead>
            <tr>
              <th>Family Name</th>
              <th>Category</th>
              <th>City</th>
              <th style={{ width: 80, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>No Families found.</td></tr>}
            {data.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.familyName}</td>
                <td>{f.category || '-'}</td>
                <td>{f.city || '-'}</td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => openDrawer(f)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(f.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeTab === "accounts") {
      return (
        <table className="financial-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Family</th>
              <th>PAN</th>
              <th style={{ width: 80, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>No Accounts found.</td></tr>}
            {data.map(a => {
              const fam = families.find(f => f.id === a.familyId);
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.accountName}</td>
                  <td>{fam?.familyName || <span style={{ color: "red" }}>Unlinked</span>}</td>
                  <td>{a.pan || '-'}</td>
                  <td style={{ textAlign: "center" }}>
                    <button onClick={() => openDrawer(a)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(a.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (activeTab === "portfolios") {
      return (
        <table className="financial-table">
          <thead>
            <tr>
              <th>Portfolio Name</th>
              <th>Account Owner</th>
              <th>Type</th>
              <th style={{ width: 80, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>No Portfolios found.</td></tr>}
            {data.map(p => {
              const acc = accounts.find(a => a.id === p.accountId);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.portfolioName}</td>
                  <td>{acc?.accountName || <span style={{ color: "red" }}>Unlinked</span>}</td>
                  <td>{p.portfolioType || '-'}</td>
                  <td style={{ textAlign: "center" }}>
                    <button onClick={() => openDrawer(p)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(p.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (activeTab === "investorGroups") {
      return (
        <table className="financial-table">
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Full Name</th>
              <th>Linked Portfolios</th>
              <th style={{ width: 80, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>No Investor Groups found.</td></tr>}
            {data.map(ig => (
              <tr key={ig.id}>
                <td style={{ fontWeight: 600 }}>{ig.groupName}</td>
                <td>{ig.fullName || '-'}</td>
                <td>{(ig.portfolioIds || []).length} Portfolios</td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => openDrawer(ig)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", padding: "4px" }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(ig.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  const renderFormFields = () => {
    if (activeTab === "families") {
      return (
        <>
          <div className="form-group">
            <label>Family Name *</label>
            <input required type="text" value={formData.familyName || ""} onChange={e => setFormData({ ...formData, familyName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={formData.category || ""} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              <option value="">Select Category</option>
              <option value="HUF">HUF</option>
              <option value="Trust">Trust</option>
              <option value="Individual">Individual</option>
              <option value="Corporate">Corporate</option>
            </select>
          </div>
          <div className="form-group"><label>Address</label><input type="text" value={formData.address || ""} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div className="form-group" style={{ flex: 1 }}><label>City</label><input type="text" value={formData.city || ""} onChange={e => setFormData({ ...formData, city: e.target.value })} /></div>
            <div className="form-group" style={{ flex: 1 }}><label>Country</label><input type="text" value={formData.country || ""} onChange={e => setFormData({ ...formData, country: e.target.value })} /></div>
          </div>
        </>
      );
    }
    if (activeTab === "accounts") {
      return (
        <>
          <div className="form-group">
            <label>Link to Family *</label>
            <select required value={formData.familyId || ""} onChange={e => setFormData({ ...formData, familyId: e.target.value })}>
              <option value="">-- Select Family --</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.familyName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Account Name (Short) *</label>
            <input required type="text" value={formData.accountName || ""} onChange={e => setFormData({ ...formData, accountName: e.target.value })} placeholder="e.g. Saahil Accounts" />
          </div>
          <div className="form-group">
            <label>Full Legal Name</label>
            <input type="text" value={formData.fullName || ""} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>PAN Number</label>
            <input type="text" value={formData.pan || ""} onChange={e => setFormData({ ...formData, pan: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Accounting Start Year</label>
            <input type="text" value={formData.accountingStartYear || ""} onChange={e => setFormData({ ...formData, accountingStartYear: e.target.value })} placeholder="e.g. 2025-2026" />
          </div>
        </>
      );
    }
    if (activeTab === "portfolios") {
      return (
        <>
          <div className="form-group">
            <label>Link to Account (Owner) *</label>
            <select required value={formData.accountId || ""} onChange={e => setFormData({ ...formData, accountId: e.target.value })}>
              <option value="">-- Select Account --</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Portfolio Name *</label>
            <input required type="text" value={formData.portfolioName || ""} onChange={e => setFormData({ ...formData, portfolioName: e.target.value })} placeholder="e.g. Saahil EQ" />
          </div>
          <div className="form-group">
            <label>Portfolio Type</label>
            <select value={formData.portfolioType || ""} onChange={e => setFormData({ ...formData, portfolioType: e.target.value })}>
              <option value="">Select Type</option>
              <option value="Equity">Equity</option>
              <option value="Mutual Funds">Mutual Funds</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Fixed Income">Fixed Income</option>
            </select>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
            <input type="checkbox" id="isTrading" checked={!!formData.isTradingPortfolio} onChange={e => setFormData({ ...formData, isTradingPortfolio: e.target.checked })} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            <label htmlFor="isTrading" style={{ cursor: "pointer", userSelect: "none" }}>Is Trading Portfolio?</label>
          </div>
        </>
      );
    }
    if (activeTab === "investorGroups") {
      return (
        <>
          <div className="form-group">
            <label>Investor Group Name *</label>
            <input required type="text" value={formData.groupName || ""} onChange={e => setFormData({ ...formData, groupName: e.target.value })} placeholder="e.g. Equity Group" />
          </div>
          <div className="form-group">
            <label>Full Name / Description</label>
            <input type="text" value={formData.fullName || ""} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Link Portfolios (Hold Ctrl to select multiple)</label>
            <select multiple value={formData.portfolioIds || []} onChange={e => {
              const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
              setFormData({ ...formData, portfolioIds: selected });
            }} style={{ height: "120px", padding: "8px" }}>
              {portfolios.map(p => {
                const acc = accounts.find(a => a.id === p.accountId);
                return (
                  <option key={p.id} value={p.id}>{p.portfolioName} ({acc?.accountName || 'No Acc'})</option>
                );
              })}
            </select>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Select multiple portfolios to aggregate reporting for this group.</div>
          </div>
        </>
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
      {/* ── Setup Header ── */}
      <div style={{ 
        height: '52px', 
        background: 'white', 
        borderBottom: '1px solid #e2e8f0', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 16px', 
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => navigate('/pms')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 800, fontSize: '15px' }}>
            <Settings size={18} color="#2563eb" />
            Master Setup
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "30px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: 0 }}>Portfolio Hierarchy</h1>
            <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>Configure families, accounts, and portfolio groupings</p>
          </div>
          <button onClick={() => openDrawer()} className="btn-primary" style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={16} /> Add {activeTab.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </button>
        </div>

      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          {renderTabs()}
          <div style={{ position: "relative", width: "250px" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: "13px", border: "1px solid #e2e8f0", borderRadius: "6px" }}
            />
          </div>
        </div>

        {renderTable()}
      </div>
    </div>

    {/* Side Drawer for Form */}
      {isDrawerOpen && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "400px", background: "white", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", zIndex: 3000, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              {editingRecord ? "Edit" : "Add"} {activeTab.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </h2>
            <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
          </div>
          
          <form onSubmit={handleSave} style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <style>{`
              .form-group { margin-bottom: 16px; }
              .form-group label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.05em; }
              .form-group input, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; color: #0f172a; }
              .form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
            `}</style>
            
            {renderFormFields()}

            <div style={{ marginTop: "32px", display: "flex", gap: "12px" }}>
              <button type="button" onClick={closeDrawer} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", background: "white", borderRadius: "6px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: "10px", borderRadius: "6px", fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>Save Record</button>
            </div>
          </form>
        </div>
      )}
      
      {/* Drawer Overlay */}
      {isDrawerOpen && <div onClick={closeDrawer} style={{ position: "fixed", top: 0, left: 0, right: "400px", bottom: 0, background: "rgba(15, 23, 42, 0.4)", zIndex: 2999 }} />}
    </div>
  );
}
