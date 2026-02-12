"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Campaign } from "../lib/api";
import { useAccount } from "../components/AccountContext";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif", PAUSED: "Duraklatıldı", DELETED: "Silindi", ARCHIVED: "Arşivlendi"
};

function formatCurrency(v: unknown) {
  const n = Number(v ?? 0);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatNum(v: unknown) {
  const n = Number(v ?? 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("tr-TR");
}

export default function CampaignsPage() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Campaign>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [exportLoading, setExportLoading] = useState(false);
  const { selectedAccountId } = useAccount();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", days, selectedAccountId],
    queryFn: () => api.getCampaigns(days, selectedAccountId),
  });

  const campaigns = (data?.data || [])
    .filter(c => selectedStatus === "ALL" || c.status === selectedStatus)
    .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = Number(a[sortBy] ?? 0);
      const bv = Number(b[sortBy] ?? 0);
      return sortDir === "desc" ? bv - av : av - bv;
    });

  const handleSort = (col: keyof Campaign) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try { await api.exportCsv("campaigns", days); }
    finally { setExportLoading(false); }
  };

  const SortIcon = ({ col }: { col: keyof Campaign }) => (
    <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3 }}>
      {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );

  return (
    <div style={{ maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Kampanyalar</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{data?.count || 0} kampanya bulundu</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: days === d ? "var(--meta-blue)" : "transparent",
                color: days === d ? "white" : "var(--text-secondary)",
                fontWeight: days === d ? 600 : 400,
                fontSize: 13, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
              }}>{d}G</button>
            ))}
          </div>
          <button className="btn-outline" onClick={handleExport} disabled={exportLoading}>
            {exportLoading ? "⏳" : "⬇️ CSV"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="🔍 Kampanya ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 220, background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text-primary)", padding: "10px 16px", borderRadius: 10,
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
          }}
        />
        {["ALL", "ACTIVE", "PAUSED", "ARCHIVED"].map(s => (
          <button key={s} onClick={() => setSelectedStatus(s)} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid",
            borderColor: selectedStatus === s ? "var(--meta-blue)" : "var(--border)",
            background: selectedStatus === s ? "rgba(24,119,242,0.1)" : "transparent",
            color: selectedStatus === s ? "var(--meta-blue)" : "var(--text-secondary)",
            fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>
            {s === "ALL" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Kampanya</th>
                <th>Durum</th>
                <th onClick={() => handleSort("spend")} style={{ cursor: "pointer" }}>Harcama<SortIcon col="spend" /></th>
                <th onClick={() => handleSort("impressions")} style={{ cursor: "pointer" }}>Gösterim<SortIcon col="impressions" /></th>
                <th onClick={() => handleSort("clicks")} style={{ cursor: "pointer" }}>Tıklama<SortIcon col="clicks" /></th>
                <th onClick={() => handleSort("ctr")} style={{ cursor: "pointer" }}>CTR<SortIcon col="ctr" /></th>
                <th onClick={() => handleSort("cpc")} style={{ cursor: "pointer" }}>CPC<SortIcon col="cpc" /></th>
                <th onClick={() => handleSort("cpm")} style={{ cursor: "pointer" }}>CPM<SortIcon col="cpm" /></th>
                <th onClick={() => handleSort("roas")} style={{ cursor: "pointer" }}>ROAS<SortIcon col="roas" /></th>
                <th onClick={() => handleSort("frequency")} style={{ cursor: "pointer" }}>Frequency<SortIcon col="frequency" /></th>
                <th onClick={() => handleSort("conversions")} style={{ cursor: "pointer" }}>Dönüşüm<SortIcon col="conversions" /></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(11).fill(0).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, width: "80%", borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              ) : campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                      background: c.status === "ACTIVE" ? "rgba(0,214,143,0.1)" : c.status === "PAUSED" ? "rgba(255,211,42,0.1)" : "rgba(122,139,168,0.1)",
                      color: c.status === "ACTIVE" ? "var(--meta-green)" : c.status === "PAUSED" ? "var(--meta-yellow)" : "var(--text-muted)",
                    }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(c.spend)}</td>
                  <td className="mono">{formatNum(c.impressions)}</td>
                  <td className="mono">{formatNum(c.clicks)}</td>
                  <td className="mono" style={{ color: Number(c.ctr ?? 0) >= 1 ? "var(--meta-green)" : Number(c.ctr ?? 0) >= 0.5 ? "var(--meta-yellow)" : "var(--meta-red)" }}>
                    %{Number(c.ctr ?? 0).toFixed(2)}
                  </td>
                  <td className="mono">{formatCurrency(c.cpc)}</td>
                  <td className="mono">{formatCurrency(c.cpm)}</td>
                  <td className="mono" style={{ color: Number(c.roas ?? 0) >= 2 ? "var(--meta-green)" : Number(c.roas ?? 0) >= 1 ? "var(--meta-yellow)" : "var(--meta-red)" }}>
                    {Number(c.roas ?? 0).toFixed(2)}x
                  </td>
                  <td className="mono" style={{ color: Number(c.frequency ?? 0) >= 3 ? "var(--meta-red)" : "var(--text-secondary)" }}>
                    {Number(c.frequency ?? 0).toFixed(1)}
                  </td>
                  <td className="mono">{formatNum(c.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && campaigns.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>
            Kampanya bulunamadı. Filtrelerinizi kontrol edin.
          </div>
        )}
      </div>
    </div>
  );
}
