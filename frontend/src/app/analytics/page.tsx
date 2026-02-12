"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";

function formatCurrency(v: unknown) {
  const n = Number(v ?? 0);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const daily = dailyData?.data || [];
  const summary = summaryData;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Analitik
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Gelişmiş karşılaştırmalı grafikler ve performans trendi
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: days === d ? "var(--meta-blue)" : "transparent",
              color: days === d ? "white" : "var(--text-secondary)",
              fontWeight: days === d ? 600 : 400,
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}
          >
            Son {d} gün
          </button>
        ))}
      </div>

      {summaryLoading ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div className="skeleton" style={{ height: 24, width: "60%", margin: "0 auto 16px" }} />
          <div className="skeleton" style={{ height: 200, width: "100%" }} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Toplam Harcama</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                {formatCurrency(summary?.spend)}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Gösterim</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                {Number(summary?.impressions ?? 0).toLocaleString("tr-TR")}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Tıklama</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                {Number(summary?.clicks ?? 0).toLocaleString("tr-TR")}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Ort. CTR</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Mono', monospace" }}>
                %{Number(summary?.ctr ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Günlük Harcama Trendi
            </h3>
            {dailyLoading ? (
              <div className="skeleton" style={{ height: 280 }} />
            ) : daily.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                Bu dönem için veri yok. Meta API bağlantısı ve .env ayarlarını kontrol edin.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="analyticsSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" />
                  <XAxis dataKey="date_start" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v?.slice(5)} />
                  <YAxis tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₺${v}`} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Harcama"]} />
                  <Area type="monotone" dataKey="spend" stroke="#1877F2" strokeWidth={2} fill="url(#analyticsSpend)" name="Harcama (₺)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
