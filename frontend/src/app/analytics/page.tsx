"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api, Campaign, DailyData } from "../lib/api";
import { MetricCard } from "../components/MetricCard";

/* ── Formatters ── */
function formatCurrency(v: number) {
  return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatNum(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString("tr-TR");
}
function formatPct(v: number) { return `%${v.toFixed(2)}`; }
function formatRoas(v: number) { return `${v.toFixed(2)}x`; }

/* ── Metric definitions ── */
type MetricKey = "spend" | "clicks" | "impressions" | "ctr" | "cpc" | "cpm" | "roas";

interface MetricDef {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
  color: string;
  dailyAvailable: boolean;
  yPrefix?: string;
}

const METRICS: MetricDef[] = [
  { key: "spend",       label: "Harcama",  format: formatCurrency, color: "#1877F2", dailyAvailable: true,  yPrefix: "₺" },
  { key: "clicks",      label: "Tıklama",  format: formatNum,      color: "#00d68f", dailyAvailable: true },
  { key: "impressions", label: "Gösterim", format: formatNum,      color: "#8b5cf6", dailyAvailable: true },
  { key: "ctr",         label: "CTR",      format: formatPct,      color: "#ffd32a", dailyAvailable: true,  yPrefix: "%" },
  { key: "cpc",         label: "CPC",      format: formatCurrency, color: "#42A5F5", dailyAvailable: true,  yPrefix: "₺" },
  { key: "cpm",         label: "CPM",      format: formatCurrency, color: "#ff4757", dailyAvailable: true,  yPrefix: "₺" },
  { key: "roas",        label: "ROAS",     format: formatRoas,     color: "#00d68f", dailyAvailable: false, yPrefix: "" },
];

/* ── Helpers ── */
function enrichDaily(daily: DailyData[]): (DailyData & { cpc: number; cpm: number })[] {
  return daily.map(d => ({
    ...d,
    cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
  }));
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("spend");

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

  const summary = summaryData;
  const campaigns: Campaign[] = campaignsData?.data || [];
  const daily = enrichDaily(dailyData?.data || []);
  const metric = METRICS.find(m => m.key === selectedMetric)!;

  // Top 10 campaigns sorted by selected metric (descending)
  const sortedCampaigns = [...campaigns]
    .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
    .slice(0, 10);

  const isLoading = summaryLoading || campaignsLoading || dailyLoading;

  const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string }) => (
    <div className="skeleton" style={{ height: h, width: w }} />
  );

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Analitik
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Kampanya karşılaştırması ve performans trendleri
          </p>
        </div>
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
      </div>

      {/* Summary Cards */}
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

      {/* Metric Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Metrik Seçin
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setSelectedMetric(m.key)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer",
              border: selectedMetric === m.key ? `1px solid ${m.color}` : "1px solid var(--border)",
              background: selectedMetric === m.key ? `${m.color}18` : "var(--bg-card)",
              color: selectedMetric === m.key ? m.color : "var(--text-secondary)",
              fontWeight: selectedMetric === m.key ? 600 : 400,
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Campaign Comparison Bar Chart */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Kampanya Karşılaştırması — {metric.label}
          </h3>
          {campaignsLoading ? <Skeleton h={320} /> : sortedCampaigns.length === 0 ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Kampanya bulunamadı
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sortedCampaigns} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => metric.yPrefix === "₺" ? `₺${v}` : metric.yPrefix === "%" ? `%${v}` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#7a8ba8", fontSize: 11 }} tickLine={false} axisLine={false}
                  width={140} tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}
                  formatter={(v: number) => [metric.format(v), metric.label]}
                />
                <Bar dataKey={selectedMetric} fill={metric.color} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily Trend Chart */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Günlük Trend — {metric.label}
          </h3>
          {dailyLoading ? <Skeleton h={320} /> : !metric.dailyAvailable ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
              {metric.label} metriği günlük bazda mevcut değil.<br />
              Kampanya karşılaştırmasını kullanabilirsiniz.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metric.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" />
                <XAxis dataKey="date_start" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v?.slice(5)} />
                <YAxis tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => metric.yPrefix === "₺" ? `₺${v}` : metric.yPrefix === "%" ? `%${v}` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "var(--text-secondary)" }}
                  formatter={(v: number) => [metric.format(v), metric.label]}
                />
                <Area type="monotone" dataKey={selectedMetric} stroke={metric.color} strokeWidth={2}
                  fill="url(#trendGrad)" name={metric.label} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Campaign Detail Table */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Kampanya Detay — {metric.label} Sıralaması
        </h3>
        {campaignsLoading ? <Skeleton h={200} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Kampanya</th>
                  <th>Durum</th>
                  <th>Harcama</th>
                  <th>Tıklama</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>CPM</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>{i + 1}</td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                        background: c.status === "ACTIVE" ? "rgba(0,214,143,0.1)" : "rgba(122,139,168,0.1)",
                        color: c.status === "ACTIVE" ? "var(--meta-green)" : "var(--text-muted)",
                      }}>
                        {c.status === "ACTIVE" ? "Aktif" : c.status === "PAUSED" ? "Duraklatıldı" : c.status}
                      </span>
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "spend" ? metric.color : "var(--text-primary)" }}>
                      {formatCurrency(c.spend)}
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "clicks" ? metric.color : "var(--text-primary)" }}>
                      {formatNum(c.clicks)}
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "ctr" ? metric.color : c.ctr >= 1 ? "var(--meta-green)" : "var(--meta-red)" }}>
                      %{c.ctr?.toFixed(2)}
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "cpc" ? metric.color : "var(--text-primary)" }}>
                      {formatCurrency(c.cpc)}
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "cpm" ? metric.color : "var(--text-primary)" }}>
                      {formatCurrency(c.cpm)}
                    </td>
                    <td className="mono" style={{ color: selectedMetric === "roas" ? metric.color : c.roas >= 2 ? "var(--meta-green)" : c.roas >= 1 ? "var(--meta-yellow)" : "var(--meta-red)" }}>
                      {c.roas?.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
