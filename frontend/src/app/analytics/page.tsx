"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";
import { MetricCard } from "../components/MetricCard";

function formatCurrency(v: number) {
  return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatNum(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toString();
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", days],
    queryFn: () => api.getSummary(days),
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ["daily", days],
    queryFn: () => api.getDaily(days),
  });

  const summary = summaryData;
  const daily = dailyData?.data || [];

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
            Gelişmiş karşılaştırmalı grafikler burada olacak. Detaylı analitik Faz 2'de eklenecektir.
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
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

      {/* Daily Spend Chart */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Günlük Harcama Trendi
        </h3>
        {dailyLoading ? <Skeleton h={300} /> : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="analyticsSpendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" />
              <XAxis dataKey="date_start" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₺${v}`} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "var(--text-secondary)" }}
                formatter={(v: number) => [formatCurrency(v), "Harcama"]}
              />
              <Area type="monotone" dataKey="spend" stroke="#1877F2" strokeWidth={2}
                fill="url(#analyticsSpendGrad)" name="Harcama (₺)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Info Banner */}
      <div style={{
        background: "rgba(24,119,242,0.06)", border: "1px solid rgba(24,119,242,0.15)",
        borderRadius: 10, padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div>
          <strong style={{ color: "var(--text-primary)" }}>Karşılaştırmalı grafikler yakında!</strong>
          <br />
          Kampanyalar arası karşılaştırma, metrik seçici ve detaylı trend analizleri Faz 2'de eklenecektir.
        </div>
      </div>
    </div>
  );
}
