"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api, Campaign } from "../lib/api";
import { useAccount } from "../components/Providers";

/* Metric definitions */
type MetricKey = "spend" | "clicks" | "ctr" | "cpc" | "cpm" | "roas";

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  format: (v: number) => string;
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
  { key: "spend",  label: "Harcama", color: "#2563eb", format: formatCurrency, dailyAvailable: true },
  { key: "clicks", label: "Tıklama", color: "#10b981", format: formatNum, dailyAvailable: true },
  { key: "ctr",    label: "CTR",     color: "#f59e0b", format: (v) => `%${v.toFixed(2)}`, dailyAvailable: true },
  { key: "cpc",    label: "CPC",     color: "#8b5cf6", format: formatCurrency, dailyAvailable: false },
  { key: "cpm",    label: "CPM",     color: "#ec4899", format: formatCurrency, dailyAvailable: false },
  { key: "roas",   label: "ROAS",    color: "#3b82f6", format: (v) => `${v.toFixed(2)}x`, dailyAvailable: false },
];

const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricDef>;

export default function AnalyticsPage() {
  const { accountId } = useAccount();
  const [days, setDays] = useState(30);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["spend"]);

  /* API queries */
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", days, accountId],
    queryFn: () => api.getSummary(days, accountId),
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ["daily", days, accountId],
    queryFn: () => api.getDaily(days, accountId),
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", days, accountId],
    queryFn: () => api.getCampaigns(days, accountId),
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
        if (prev.length === 1) return prev;
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
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Analitik</h1>
        <p className="text-slate-500 text-sm">Gelişmiş karşılaştırmalı grafikler ve performans trendi</p>
      </div>

      {/* Period selector + Metric selector */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                days === d 
                  ? "bg-primary-600 text-white shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Son {d} gün
            </button>
          ))}
        </div>

        {/* Metric selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {METRICS.map((m) => {
            const active = selectedMetrics.includes(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  active 
                    ? "text-white border-transparent shadow-sm" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
                style={{ backgroundColor: active ? m.color : undefined }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="card p-5">
              <Skeleton h={12} w="60%" className="mb-3" />
              <Skeleton h={24} w="80%" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {summaryCards.map((card) => {
            const isSelected = selectedMetrics.includes(card.key);
            const def = metricByKey[card.key];
            return (
              <div
                key={card.key}
                onClick={() => toggleMetric(card.key)}
                className={`card p-5 cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-offset-2" : ""
                }`}
                style={{ 
                  borderColor: isSelected ? def.color : undefined,
                  ringColor: isSelected ? `${def.color}40` : undefined 
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  {isSelected && (
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: def.color }}
                    />
                  )}
                </div>
                <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign Comparison Bar Chart */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Kampanya Karşılaştırması — {metricByKey[primaryMetric].label}
          </h3>
          <span className="text-xs text-slate-500">
            En yüksek {topCampaigns.length} kampanya
          </span>
        </div>

        {campaignsLoading ? (
          <Skeleton h={300} />
        ) : topCampaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Bu dönem için kampanya verisi yok.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, topCampaigns.length * 42)}>
            <BarChart data={topCampaigns} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => metricByKey[primaryMetric].format(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={160}
                tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "..." : v}
              />
              <Tooltip
                contentStyle={{ 
                  background: "white", 
                  border: "1px solid #e2e8f0", 
                  borderRadius: 8, 
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                }}
                formatter={(v: number) => [metricByKey[primaryMetric].format(v), metricByKey[primaryMetric].label]}
              />
              <Bar 
                dataKey={primaryMetric} 
                fill={metricByKey[primaryMetric].color} 
                radius={[0, 6, 6, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Trend Chart */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Günlük Trend
          </h3>
          {trendMetrics.length === 0 && (
            <span className="text-xs text-slate-400 italic">
              Seçilen metrikler (CPC, CPM, ROAS) için günlük veri mevcut değil
            </span>
          )}
        </div>

        {dailyLoading ? (
          <Skeleton h={300} />
        ) : daily.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Bu dönem için günlük veri yok.
          </div>
        ) : trendMetrics.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Seçilen metrikler için günlük kırılım verisi mevcut değil.<br />
            Trend görmek için <strong>Harcama</strong>, <strong>Tıklama</strong> veya <strong>CTR</strong> seçin.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily}>
              <defs>
                {trendMetrics.map((mk) => (
                  <linearGradient key={`grad-${mk}`} id={`grad-${mk}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricByKey[mk].color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={metricByKey[mk].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date_start"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v?.slice(5)}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const def = metricByKey[trendMetrics[0]];
                  if (trendMetrics[0] === "ctr") return `%${v}`;
                  if (trendMetrics[0] === "spend") return `₺${v}`;
                  return String(v);
                }}
              />
              {trendMetrics.length > 1 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#64748b", fontSize: 11 }}
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
                contentStyle={{ 
                  background: "white", 
                  border: "1px solid #e2e8f0", 
                  borderRadius: 8, 
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                }}
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
                  wrapperStyle={{ fontSize: 11, color: "#64748b" }}
                  formatter={(value: string) => metricByKey[value as MetricKey]?.label || value}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Campaign Metrics Table */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-5">
          Kampanya Detay Tablosu
        </h3>
        {campaignsLoading ? (
          <Skeleton h={200} />
        ) : topCampaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Kampanya verisi yok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kampanya</th>
                  {selectedMetrics.map((mk) => (
                    <th key={mk} className="text-right" style={{ color: metricByKey[mk].color }}>
                      {metricByKey[mk].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((c: Campaign) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-slate-900 max-w-[220px] truncate" title={c.name}>
                        {c.name}
                      </div>
                    </td>
                    {selectedMetrics.map((mk) => (
                      <td key={mk} className="text-right mono font-medium text-slate-900">
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
