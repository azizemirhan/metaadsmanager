"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Campaign } from "../lib/api";
import { useAccount } from "../components/Providers";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif", 
  PAUSED: "Duraklatıldı", 
  DELETED: "Silindi", 
  ARCHIVED: "Arşivlendi"
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: "bg-success-50", text: "text-success-600", border: "border-success-200" },
  PAUSED: { bg: "bg-warning-50", text: "text-warning-600", border: "border-warning-200" },
  DELETED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  ARCHIVED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
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
  const { accountId } = useAccount();
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Campaign>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [exportLoading, setExportLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", days, accountId],
    queryFn: () => api.getCampaigns(days, accountId),
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
    <span className={`ml-1 text-xs ${sortBy === col ? "text-primary-600" : "text-slate-300"}`}>
      {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Kampanyalar</h1>
          <p className="text-slate-500 text-sm">{data?.count || 0} kampanya bulundu</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {[7, 14, 30, 90].map(d => (
              <button 
                key={d} 
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  days === d 
                    ? "bg-primary-600 text-white shadow-sm" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d}G
              </button>
            ))}
          </div>
          <button 
            className="btn-outline flex items-center gap-2"
            onClick={handleExport} 
            disabled={exportLoading}
          >
            {exportLoading ? (
              <LoadingIcon className="w-4 h-4 animate-spin" />
            ) : (
              <DownloadIcon className="w-4 h-4" />
            )}
            CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder="Kampanya ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
        {["ALL", "ACTIVE", "PAUSED", "ARCHIVED"].map(s => (
          <button 
            key={s} 
            onClick={() => setSelectedStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              selectedStatus === s 
                ? "bg-primary-50 border-primary-300 text-primary-700" 
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {s === "ALL" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Kampanya</th>
                <th className="text-left">Durum</th>
                <th onClick={() => handleSort("spend")} className="text-right cursor-pointer hover:text-slate-900">
                  Harcama<SortIcon col="spend" />
                </th>
                <th onClick={() => handleSort("impressions")} className="text-right cursor-pointer hover:text-slate-900">
                  Gösterim<SortIcon col="impressions" />
                </th>
                <th onClick={() => handleSort("clicks")} className="text-right cursor-pointer hover:text-slate-900">
                  Tıklama<SortIcon col="clicks" />
                </th>
                <th onClick={() => handleSort("ctr")} className="text-right cursor-pointer hover:text-slate-900">
                  CTR<SortIcon col="ctr" />
                </th>
                <th onClick={() => handleSort("cpc")} className="text-right cursor-pointer hover:text-slate-900">
                  CPC<SortIcon col="cpc" />
                </th>
                <th onClick={() => handleSort("cpm")} className="text-right cursor-pointer hover:text-slate-900">
                  CPM<SortIcon col="cpm" />
                </th>
                <th onClick={() => handleSort("roas")} className="text-right cursor-pointer hover:text-slate-900">
                  ROAS<SortIcon col="roas" />
                </th>
                <th onClick={() => handleSort("frequency")} className="text-right cursor-pointer hover:text-slate-900">
                  Frequency<SortIcon col="frequency" />
                </th>
                <th onClick={() => handleSort("conversions")} className="text-right cursor-pointer hover:text-slate-900">
                  Dönüşüm<SortIcon col="conversions" />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(11).fill(0).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 w-4/5 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : campaigns.map(c => {
                const statusStyle = STATUS_STYLES[c.status] || STATUS_STYLES.ARCHIVED;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-slate-900 max-w-[220px] truncate" title={c.name}>
                        {c.name}
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="text-right mono font-medium text-slate-900">{formatCurrency(c.spend)}</td>
                    <td className="text-right mono text-slate-600">{formatNum(c.impressions)}</td>
                    <td className="text-right mono text-slate-600">{formatNum(c.clicks)}</td>
                    <td className={`text-right mono font-medium ${
                      Number(c.ctr ?? 0) >= 1 ? "text-success-600" : 
                      Number(c.ctr ?? 0) >= 0.5 ? "text-warning-600" : "text-danger-600"
                    }`}>
                      %{Number(c.ctr ?? 0).toFixed(2)}
                    </td>
                    <td className="text-right mono text-slate-600">{formatCurrency(c.cpc)}</td>
                    <td className="text-right mono text-slate-600">{formatCurrency(c.cpm)}</td>
                    <td className={`text-right mono font-medium ${
                      Number(c.roas ?? 0) >= 2 ? "text-success-600" : 
                      Number(c.roas ?? 0) >= 1 ? "text-warning-600" : "text-danger-600"
                    }`}>
                      {Number(c.roas ?? 0).toFixed(2)}x
                    </td>
                    <td className={`text-right mono ${Number(c.frequency ?? 0) >= 3 ? "text-danger-600" : "text-slate-600"}`}>
                      {Number(c.frequency ?? 0).toFixed(1)}
                    </td>
                    <td className="text-right mono text-slate-600">{formatNum(c.conversions)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && campaigns.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm">Kampanya bulunamadı. Filtrelerinizi kontrol edin.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
