"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
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

/* ── Report type definitions ── */
type ReportType = "weekly" | "comparison" | "trend";

interface ReportDef {
  key: ReportType;
  label: string;
  desc: string;
  icon: string;
  csvType: "campaigns" | "ads" | "adsets";
}

const REPORT_TYPES: ReportDef[] = [
  { key: "weekly",     label: "Haftalık Özet",          desc: "Hesap geneli performans metrikleri ve kampanya özeti",        icon: "📋", csvType: "campaigns" },
  { key: "comparison", label: "Kampanya Karşılaştırma", desc: "Kampanyalar arası harcama, tıklama ve dönüşüm karşılaştırması", icon: "📊", csvType: "campaigns" },
  { key: "trend",      label: "Performans Trendi",      desc: "Günlük harcama ve tıklama trendleri",                        icon: "📈", csvType: "campaigns" },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [days, setDays] = useState(7);
  const [exportLoading, setExportLoading] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [includeCsv, setIncludeCsv] = useState(true);

  const report = REPORT_TYPES.find(r => r.key === reportType)!;

  /* ── Data fetching for preview ── */
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
    enabled: reportType === "trend",
  });

  const summary = summaryData;
  const campaigns: Campaign[] = campaignsData?.data || [];
  const daily: DailyData[] = dailyData?.data || [];
  const topCampaigns = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, 5);

  /* ── Handlers ── */
  const handleExport = async () => {
    setExportLoading(true);
    try {
      await api.exportCsv(report.csvType, days);
    } catch {
      alert("CSV indirme sırasında hata oluştu.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddr) return;
    setEmailLoading(true);
    try {
      await api.sendReport(emailAddr, days, includeCsv);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch {
      alert("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  const Skeleton = ({ h = 20, w = "100%" }: { h?: number; w?: string }) => (
    <div className="skeleton" style={{ height: h, width: w }} />
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Raporlar
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Rapor türü ve periyot seçin, önizleyin, indirin veya e-posta ile gönderin
        </p>
      </div>

      {/* Report Type Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Rapor Türü
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {REPORT_TYPES.map(r => (
            <button key={r.key} onClick={() => setReportType(r.key)} style={{
              padding: "16px 18px", borderRadius: 10, cursor: "pointer", textAlign: "left",
              border: reportType === r.key ? "1px solid var(--meta-blue)" : "1px solid var(--border)",
              background: reportType === r.key ? "rgba(24,119,242,0.08)" : "var(--bg-card)",
              transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{r.icon}</div>
              <div style={{
                fontSize: 14, fontWeight: 600, marginBottom: 4,
                color: reportType === r.key ? "var(--meta-blue)" : "var(--text-primary)",
              }}>
                {r.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {r.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Periyot
        </label>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: days === d ? "var(--meta-blue)" : "transparent",
              color: days === d ? "white" : "var(--text-secondary)",
              fontWeight: days === d ? 600 : 400,
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}>
              Son {d} Gün
            </button>
          ))}
        </div>
      </div>

      {/* ── Report Preview ── */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>{report.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {report.label} — Son {days} Gün
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Rapor Önizleme</div>
          </div>
        </div>

        {/* Weekly Summary Preview */}
        {reportType === "weekly" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {summaryLoading ? (
                Array(4).fill(0).map((_, i) => <div key={i}><Skeleton h={70} /></div>)
              ) : (
                <>
                  <MetricCard label="Harcama" value={formatCurrency(summary?.spend || 0)} icon="💸" color="var(--meta-blue)" />
                  <MetricCard label="Gösterim" value={formatNum(summary?.impressions || 0)} icon="👁️" color="var(--meta-purple)" />
                  <MetricCard label="Tıklama" value={formatNum(summary?.clicks || 0)} icon="🖱️" color="var(--meta-green)" />
                  <MetricCard label="CTR" value={`%${(summary?.ctr || 0).toFixed(2)}`} icon="📊"
                    color={(summary?.ctr || 0) >= 1 ? "var(--meta-green)" : "var(--meta-red)"} />
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 16 }}>
              <span>Toplam kampanya: <strong style={{ color: "var(--text-primary)" }}>{campaigns.length}</strong></span>
              <span>Aktif: <strong style={{ color: "var(--meta-green)" }}>{campaigns.filter(c => c.status === "ACTIVE").length}</strong></span>
              <span>CPC: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(summary?.cpc || 0)}</strong></span>
              <span>CPM: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(summary?.cpm || 0)}</strong></span>
            </div>
          </>
        )}

        {/* Comparison Preview */}
        {reportType === "comparison" && (
          <>
            {campaignsLoading ? <Skeleton h={220} /> : topCampaigns.length === 0 ? (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Kampanya bulunamadı
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topCampaigns} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.8)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#4a5a72", fontSize: 11 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₺${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#7a8ba8", fontSize: 11 }} tickLine={false} axisLine={false}
                      width={130} tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number) => [formatCurrency(v), "Harcama"]}
                    />
                    <Bar dataKey="spend" fill="#1877F2" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Harcamaya göre ilk {topCampaigns.length} kampanya — toplam {campaigns.length} kampanya raporda yer alacak
                </div>
              </>
            )}
          </>
        )}

        {/* Trend Preview */}
        {reportType === "trend" && (
          <>
            {dailyLoading ? <Skeleton h={220} /> : daily.length === 0 ? (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Günlük veri bulunamadı
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="reportSpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="reportClicksGrad" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#reportSpendGrad)" name="Harcama (₺)" />
                    <Area yAxisId="right" type="monotone" dataKey="clicks" stroke="#00d68f" strokeWidth={2}
                      fill="url(#reportClicksGrad)" name="Tıklama" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  Son {days} günlük harcama ve tıklama trendi
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* CSV Download */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            CSV İndir
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            {report.label} verilerini CSV dosyası olarak indirin
          </p>
          <button className="btn-primary" onClick={handleExport} disabled={exportLoading} style={{ width: "100%" }}>
            {exportLoading ? "İndiriliyor..." : "CSV İndir"}
          </button>
        </div>

        {/* Email Report */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            E-posta ile Gönder
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            AI analiz raporu e-posta ile gönderilsin
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="email"
              placeholder="ornek@sirket.com"
              value={emailAddr}
              onChange={e => setEmailAddr(e.target.value)}
              style={{
                flex: 1, minWidth: 0,
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                color: "var(--text-primary)", padding: "9px 14px",
                borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
            />
            <button
              className="btn-primary"
              onClick={handleSendEmail}
              disabled={!emailAddr || emailLoading}
            >
              {emailLoading ? "..." : "Gönder"}
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeCsv}
              onChange={e => setIncludeCsv(e.target.checked)}
              style={{ accentColor: "var(--meta-blue)" }}
            />
            CSV dosyasını e-postaya ekle
          </label>
          {emailSent && (
            <div style={{
              marginTop: 10, background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.2)",
              borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "var(--meta-green)",
            }}>
              Rapor {emailAddr} adresine gönderildi!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
