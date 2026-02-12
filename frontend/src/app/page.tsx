"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { api, Campaign } from "./lib/api";
import { MetricCard } from "./components/MetricCard";

const COLORS = ["#1877F2", "#42A5F5", "#00d68f", "#ffd32a", "#8b5cf6", "#ff4757"];

function formatCurrency(v: number) {
  return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatNum(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toString();
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif", PAUSED: "Duraklatıldı", DELETED: "Silindi", ARCHIVED: "Arşivlendi"
};

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", days],
    queryFn: () => api.getSummary(days),
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", days],
    queryFn: () => api.getCampaigns(days),
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ["daily", days],
    queryFn: () => api.getDaily(days),
  });

  const campaigns = campaignsData?.data || [];
  const summary = summaryData;
  const daily = dailyData?.data || [];

  // Objective breakdown for pie
  const objectiveBreakdown = campaigns.reduce((acc: Record<string, number>, c: Campaign) => {
    acc[c.objective || "Other"] = (acc[c.objective || "Other"] || 0) + (c.spend || 0);
    return acc;
  }, {});
  const pieData = Object.entries(objectiveBreakdown).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  // Top 5 campaigns by spend
  const topCampaigns = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 5);

  const handleExport = async () => {
    setExportLoading(true);
    try { await api.exportCsv("campaigns", days); }
    finally { setExportLoading(false); }
  };

  const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string }) => (
    <div className="skeleton" style={{ height: h, width: w }} />
  );

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Genel Bakış
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Meta Ads hesabınızın performans özeti
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Period Selector */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: days === d ? "var(--meta-blue)" : "transparent",
                color: days === d ? "white" : "var(--text-secondary)",
                fontWeight: days === d ? 600 : 400,
                fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.15s",
              }}>
                {d}G
              </button>
            ))}
          </div>
          <button className="btn-outline" onClick={handleExport} disabled={exportLoading}>
            {exportLoading ? "⏳ İndiriliyor..." : "⬇️ CSV İndir"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {summaryLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ padding: 24 }}>
              <Skeleton h={12} w="60%" /><br />
              <Skeleton h={28} w="80%" /><br />
              <Skeleton h={12} w="40%" />
            </div>
          ))
        ) : (
          <>
            <MetricCard label="Toplam Harcama" value={formatCurrency(summary?.spend || 0)} icon="💸" color="var(--meta-blue)" />
            <MetricCard label="Gösterim" value={formatNum(summary?.impressions || 0)} icon="👁️" color="var(--meta-purple)" />
            <MetricCard label="Tıklama" value={formatNum(summary?.clicks || 0)} icon="🖱️" color="var(--meta-green)" />
            <MetricCard label="Ort. CTR" value={`%${(summary?.ctr || 0).toFixed(2)}`} icon="📊"
              color={(summary?.ctr || 0) >= 1 ? "var(--meta-green)" : "var(--meta-red)"}
              trend={(summary?.ctr || 0) >= 1 ? "up" : "down"}
              trendLabel={(summary?.ctr || 0) >= 1 ? "İyi" : "Düşük"} />
          </>
        )}
      </div>

      {/* Second row KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {summaryLoading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="card" style={{ padding: 24, height: 100 }}><Skeleton h={60} /></div>)
        ) : (
          <>
            <MetricCard label="Ort. CPC" value={formatCurrency(summary?.cpc || 0)} icon="💰" />
            <MetricCard label="CPM" value={formatCurrency(summary?.cpm || 0)} icon="📱" />
            <MetricCard label="Aktif Kampanya" value={String(campaigns.filter(c => c.status === "ACTIVE").length)} icon="🟢" color="var(--meta-green)" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Spend & Clicks Chart */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Günlük Harcama & Tıklama
          </h3>
          {dailyLoading ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d68f" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00d68f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" />
                <XAxis dataKey="date_start" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v?.slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₺${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#1877F2" strokeWidth={2}
                  fill="url(#spendGrad)" name="Harcama (₺)" />
                <Area yAxisId="right" type="monotone" dataKey="clicks" stroke="#00d68f" strokeWidth={2}
                  fill="url(#clicksGrad)" name="Tıklama" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Objective Pie */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Harcama Dağılımı
          </h3>
          {campaignsLoading ? <Skeleton h={220} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), "Harcama"]} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Campaigns Table */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            En İyi Kampanyalar
          </h3>
          <a href="/campaigns" style={{ fontSize: 12, color: "var(--meta-blue)", textDecoration: "none" }}>Tümünü Gör →</a>
        </div>
        {campaignsLoading ? <Skeleton h={200} /> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Kampanya Adı</th>
                <th>Durum</th>
                <th>Harcama</th>
                <th>Gösterim</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                      background: c.status === "ACTIVE" ? "rgba(0,214,143,0.1)" : "rgba(122,139,168,0.1)",
                      color: c.status === "ACTIVE" ? "var(--meta-green)" : "var(--text-muted)",
                    }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="mono" style={{ color: "var(--text-primary)" }}>{formatCurrency(c.spend)}</td>
                  <td className="mono">{formatNum(c.impressions)}</td>
                  <td className="mono" style={{ color: c.ctr >= 1 ? "var(--meta-green)" : "var(--meta-red)" }}>
                    %{c.ctr?.toFixed(2)}
                  </td>
                  <td className="mono">{formatCurrency(c.cpc)}</td>
                  <td className="mono" style={{ color: c.roas >= 2 ? "var(--meta-green)" : c.roas >= 1 ? "var(--meta-yellow)" : "var(--meta-red)" }}>
                    {c.roas?.toFixed(2)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top Campaigns Bar Chart */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Kampanya Harcama Karşılaştırması
        </h3>
        {campaignsLoading ? <Skeleton h={200} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topCampaigns} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₺${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#7a8ba8", fontSize: 11 }} tickLine={false} axisLine={false}
                width={150} tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "..." : v} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), "Harcama"]} />
              <Bar dataKey="spend" fill="#1877F2" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
