"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api, Campaign } from "../lib/api";
import { useAccount } from "../components/AccountContext";

/* ── Metric definitions ────────────────────────────────────── */
type MetricKey = "spend" | "clicks" | "ctr" | "cpc" | "cpm" | "roas";

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  format: (v: number) => string;
  /** Available in daily breakdown data */
  dailyAvailable: boolean;
}

function formatCurrency(v: number) {
  return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("tr-TR");
}

const METRICS: MetricDef[] = [
  { key: "spend",  label: "Harcama", color: "#1877F2", format: formatCurrency,            dailyAvailable: true },
  { key: "clicks", label: "Tıklama", color: "#00d68f", format: formatNum,                 dailyAvailable: true },
  { key: "ctr",    label: "CTR",     color: "#ffd32a", format: (v) => `%${v.toFixed(2)}`, dailyAvailable: true },
  { key: "cpc",    label: "CPC",     color: "#8b5cf6", format: formatCurrency,            dailyAvailable: false },
  { key: "cpm",    label: "CPM",     color: "#ff4757", format: formatCurrency,            dailyAvailable: false },
  { key: "roas",   label: "ROAS",    color: "#42A5F5", format: (v) => `${v.toFixed(2)}x`, dailyAvailable: false },
];

const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

/* ── Page ──────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["spend"]);
  const { selectedAccountId } = useAccount();

  /* API queries */
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", days, selectedAccountId],
    queryFn: () => api.getSummary(days, selectedAccountId),
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ["daily", days, selectedAccountId],
    queryFn: () => api.getDaily(days, selectedAccountId),
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", days, selectedAccountId],
    queryFn: () => api.getCampaigns(days, selectedAccountId),
  });

  const daily = dailyData?.data || [];
  const summary = summaryData;
  const campaigns = campaignsData?.data || [];

  /* Derived: top 10 campaigns for comparison */
  const primaryMetric = selectedMetrics[0] || "spend";
  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => Number(b[primaryMetric] ?? 0) - Number(a[primaryMetric] ?? 0))
      .slice(0, 10);
  }, [campaigns, primaryMetric]);

  /* Metric selector toggle */
  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // at least one
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  /* Daily-available selected metrics for trend chart */
  const trendMetrics = selectedMetrics.filter((k) => metricByKey[k].dailyAvailable);

  /* Summary card values */
  const summaryCards: { label: string; value: string; key: MetricKey }[] = [
    { label: "Toplam Harcama", value: formatCurrency(Number(summary?.spend ?? 0)), key: "spend" },
    { label: "Tıklama",       value: formatNum(Number(summary?.clicks ?? 0)),       key: "clicks" },
    { label: "Ort. CTR",      value: `%${Number(summary?.ctr ?? 0).toFixed(2)}`,    key: "ctr" },
    { label: "Ort. CPC",      value: formatCurrency(Number(summary?.cpc ?? 0)),     key: "cpc" },
    { label: "CPM",           value: formatCurrency(Number(summary?.cpm ?? 0)),     key: "cpm" },
  ];

  const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string }) => (
    <div className="skeleton" style={{ height: h, width: w }} />
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Analitik
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Gelismis karsilastirmali grafikler ve performans trendi
        </p>
      </div>

      {/* ── Period selector ─────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: days === d ? "var(--meta-blue)" : "transparent",
                color: days === d ? "white" : "var(--text-secondary)",
                fontWeight: days === d ? 600 : 400,
                fontSize: 13, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
              }}
            >
              Son {d} gun
            </button>
          ))}
        </div>

        {/* ── Metric selector (multi-select) ────────── */}
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          {METRICS.map((m) => {
            const active = selectedMetrics.includes(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? m.color : "transparent",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                  fontSize: 12, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                  opacity: active ? 1 : 0.7,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────── */}
      {summaryLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ padding: 20 }}><Skeleton h={12} w="60%" /><br /><Skeleton h={24} w="80%" /></div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          {summaryCards.map((card) => {
            const isSelected = selectedMetrics.includes(card.key);
            const def = metricByKey[card.key];
            return (
              <div
                key={card.key}
                className="card"
                onClick={() => toggleMetric(card.key)}
                style={{
                  padding: 20, cursor: "pointer", transition: "all 0.2s",
                  borderColor: isSelected ? def.color : undefined,
                  boxShadow: isSelected ? `0 0 0 1px ${def.color}40` : undefined,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {card.label}
                  {isSelected && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: def.color, display: "inline-block" }} />
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Campaign Comparison Bar Chart ───────────── */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Kampanya Karsilastirmasi — {metricByKey[primaryMetric].label}
          </h3>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            En yuksek {topCampaigns.length} kampanya
          </span>
        </div>

        {campaignsLoading ? (
          <Skeleton h={300} />
        ) : topCampaigns.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            Bu donem icin kampanya verisi yok.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, topCampaigns.length * 42)}>
            <BarChart data={topCampaigns} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#4a5a72", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => metricByKey[primaryMetric].format(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#7a8ba8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={160}
                tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "..." : v}
              />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                formatter={(v: number) => [metricByKey[primaryMetric].format(v), metricByKey[primaryMetric].label]}
              />
              <Bar dataKey={primaryMetric} fill={metricByKey[primaryMetric].color} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Daily Trend Chart ───────────────────────── */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Gunluk Trend
          </h3>
          {trendMetrics.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
              Secilen metrikler (CPC, CPM, ROAS) icin gunluk veri mevcut degil. Harcama, Tiklama veya CTR secin.
            </span>
          )}
        </div>

        {dailyLoading ? (
          <Skeleton h={300} />
        ) : daily.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            Bu donem icin gunluk veri yok. Meta API baglantisi ve .env ayarlarini kontrol edin.
          </div>
        ) : trendMetrics.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            Secilen metrikler icin gunluk kirilim verisi mevcut degil.<br />
            Trend gormek icin <strong>Harcama</strong>, <strong>Tiklama</strong> veya <strong>CTR</strong> metriklerinden birini secin.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily}>
              <defs>
                {trendMetrics.map((mk) => (
                  <linearGradient key={`grad-${mk}`} id={`grad-${mk}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricByKey[mk].color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={metricByKey[mk].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" />
              <XAxis
                dataKey="date_start"
                tick={{ fill: "#4a5a72", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v?.slice(5)}
              />
              {/* Left Y-axis for the first metric */}
              <YAxis
                yAxisId="left"
                tick={{ fill: "#4a5a72", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const def = metricByKey[trendMetrics[0]];
                  if (trendMetrics[0] === "ctr") return `%${v}`;
                  if (trendMetrics[0] === "spend") return `₺${v}`;
                  return String(v);
                }}
              />
              {/* Right Y-axis if 2+ metrics with different scales */}
              {trendMetrics.length > 1 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#4a5a72", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const mk = trendMetrics[1];
                    if (mk === "ctr") return `%${v}`;
                    if (mk === "spend") return `₺${v}`;
                    return String(v);
                  }}
                />
              )}
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "var(--text-secondary)" }}
                formatter={(v: number, name: string) => {
                  const def = metricByKey[name as MetricKey];
                  return def ? [def.format(v), def.label] : [v, name];
                }}
              />
              {trendMetrics.map((mk, idx) => (
                <Area
                  key={mk}
                  yAxisId={idx === 0 ? "left" : trendMetrics.length > 1 ? "right" : "left"}
                  type="monotone"
                  dataKey={mk}
                  stroke={metricByKey[mk].color}
                  strokeWidth={2}
                  fill={`url(#grad-${mk})`}
                  name={mk}
                />
              ))}
              {trendMetrics.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
                  formatter={(value: string) => metricByKey[value as MetricKey]?.label || value}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Campaign Metrics Table ──────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Kampanya Detay Tablosu
        </h3>
        {campaignsLoading ? (
          <Skeleton h={200} />
        ) : topCampaigns.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            Kampanya verisi yok.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kampanya</th>
                  {selectedMetrics.map((mk) => (
                    <th key={mk} style={{ color: metricByKey[mk].color }}>
                      {metricByKey[mk].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((c: Campaign) => (
                  <tr key={c.id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </td>
                    {selectedMetrics.map((mk) => (
                      <td key={mk} className="mono" style={{ color: "var(--text-primary)" }}>
                        {metricByKey[mk].format(Number(c[mk] ?? 0))}
                      </td>
                    ))}
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
