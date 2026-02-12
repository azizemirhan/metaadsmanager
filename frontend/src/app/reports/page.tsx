"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";

/* ── Report type definitions ───────────────────────────────── */
type ReportType = "weekly_summary" | "campaign_comparison" | "performance_trend";
type ExportFormat = "csv" | "html";

interface ReportDef {
  key: ReportType;
  label: string;
  description: string;
  icon: string;
  csvType: string; // maps to backend CSV export type
}

const REPORT_TYPES: ReportDef[] = [
  {
    key: "weekly_summary",
    label: "Haftalik Ozet",
    description: "Hesap geneli harcama, gosterim, tiklama ve en iyi kampanyalar",
    icon: "📋",
    csvType: "campaigns",
  },
  {
    key: "campaign_comparison",
    label: "Kampanya Karsilastirma",
    description: "Tum kampanyalarin metriklerini yan yana karsilastirin",
    icon: "📊",
    csvType: "campaigns",
  },
  {
    key: "performance_trend",
    label: "Performans Trendi",
    description: "Gunluk harcama, gosterim ve tiklama verisi",
    icon: "📈",
    csvType: "daily",
  },
];

/* ── Page ──────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [selectedReport, setSelectedReport] = useState<ReportType>("weekly_summary");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const [exportLoading, setExportLoading] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const selectedDef = REPORT_TYPES.find((r) => r.key === selectedReport)!;

  const handleDownload = async () => {
    setExportLoading(true);
    try {
      if (exportFormat === "csv") {
        await api.exportCsv(selectedDef.csvType, days);
      } else {
        await api.exportHtml(selectedReport, days);
      }
    } catch {
      alert("Rapor indirilemedi. Backend baglantisinizi kontrol edin.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!emailAddr) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      await api.sendReport(emailAddr, days, true);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch {
      setEmailError("E-posta gonderilemedi. SMTP ayarlarini kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ── Header ────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Raporlar
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Rapor turu secin, indirin veya e-posta ile gonderin
        </p>
      </div>

      {/* ── Period selector ───────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
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

      {/* ── Report type selector ──────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {REPORT_TYPES.map((rt) => {
          const active = selectedReport === rt.key;
          return (
            <div
              key={rt.key}
              onClick={() => setSelectedReport(rt.key)}
              className="card"
              style={{
                padding: 20, cursor: "pointer", transition: "all 0.2s",
                borderColor: active ? "var(--meta-blue)" : undefined,
                boxShadow: active ? "0 0 0 1px rgba(24,119,242,0.4)" : undefined,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{rt.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {rt.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {rt.description}
              </div>
              {active && (
                <div style={{ marginTop: 10, width: 8, height: 8, borderRadius: "50%", background: "var(--meta-blue)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Download section ──────────────────────── */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Raporu Indir
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          <strong>{selectedDef.label}</strong> raporunu son {days} gun icin indirin.
        </p>

        {/* Format selector */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Format:</span>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 3 }}>
            {(["html", "csv"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: exportFormat === fmt ? "var(--meta-blue)" : "transparent",
                  color: exportFormat === fmt ? "white" : "var(--text-secondary)",
                  fontWeight: exportFormat === fmt ? 600 : 400,
                  fontSize: 12, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                  textTransform: "uppercase",
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {exportFormat === "html" ? "Goruntulenebilir HTML rapor dosyasi" : "Elektronik tablo uyumlu CSV"}
          </span>
        </div>

        {/* Download button */}
        <button
          className="btn-primary"
          onClick={handleDownload}
          disabled={exportLoading}
          style={{ minWidth: 180 }}
        >
          {exportLoading ? "Hazirlaniyor..." : `Raporu Indir (${exportFormat.toUpperCase()})`}
        </button>
      </div>

      {/* ── Quick CSV exports ─────────────────────── */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Hizli CSV Indirme
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Ham verileri CSV olarak indirin (son {days} gun).
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {([
            { type: "campaigns", label: "Kampanyalar" },
            { type: "adsets", label: "Reklam Setleri" },
            { type: "ads", label: "Reklamlar" },
            { type: "daily", label: "Gunluk Veri" },
          ] as const).map((item) => (
            <button
              key={item.type}
              className="btn-outline"
              onClick={() => { setExportLoading(true); api.exportCsv(item.type, days).finally(() => setExportLoading(false)); }}
              disabled={exportLoading}
            >
              {item.label} CSV
            </button>
          ))}
        </div>
      </div>

      {/* ── Email section ─────────────────────────── */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          E-posta ile Gonder
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          AI analizi ve CSV eki ile raporu e-posta adresine gonderin (son {days} gun).
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendReport(); }}
            style={{
              flex: 1, minWidth: 240,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              color: "var(--text-primary)", padding: "10px 16px",
              borderRadius: 10, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
          <button className="btn-primary" onClick={handleSendReport} disabled={!emailAddr || emailLoading}>
            {emailLoading ? "Gonderiliyor..." : "Raporu Gonder"}
          </button>
        </div>
        {emailSent && (
          <div style={{ marginTop: 12, background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--meta-green)" }}>
            Rapor {emailAddr} adresine gonderildi.
          </div>
        )}
        {emailError && (
          <div style={{ marginTop: 12, background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--meta-red)" }}>
            {emailError}
          </div>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
        Daha fazla AI analiz ve oneri icin{" "}
        <Link href="/ai-insights" style={{ color: "var(--meta-blue)", textDecoration: "none" }}>
          AI Analiz
        </Link>{" "}
        sayfasina gidin.
      </p>
    </div>
  );
}
