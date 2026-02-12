"use client";
import { useState } from "react";
import { api } from "../lib/api";

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<"campaigns" | "ads" | "adsets">("campaigns");
  const [emailAddr, setEmailAddr] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await api.exportCsv(exportType, days);
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
      await api.sendReport(emailAddr, days, true);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch {
      alert("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Raporlar
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Hazır raporları indirin veya e-posta ile gönderin. Detaylı rapor şablonları Faz 3'te eklenecektir.
        </p>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Rapor Periyodu
        </label>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
          {[7, 14, 30, 90].map(d => (
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

      {/* CSV Export Section */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          CSV İndir
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Seçtiğiniz veri türünü CSV dosyası olarak indirin
        </p>

        {/* Export Type Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Veri Türü
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { value: "campaigns", label: "Kampanyalar" },
              { value: "ads", label: "Reklamlar" },
              { value: "adsets", label: "Reklam Setleri" },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => setExportType(opt.value)} style={{
                padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                border: exportType === opt.value ? "1px solid var(--meta-blue)" : "1px solid var(--border)",
                background: exportType === opt.value ? "rgba(24,119,242,0.12)" : "var(--bg-secondary)",
                color: exportType === opt.value ? "var(--meta-blue)" : "var(--text-secondary)",
                fontWeight: exportType === opt.value ? 600 : 400,
                fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.15s",
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleExport} disabled={exportLoading}>
          {exportLoading ? "⏳ İndiriliyor..." : "⬇️ CSV İndir"}
        </button>
      </div>

      {/* Email Report Section */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          E-posta ile Rapor Gönder
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          AI analiz ve CSV raporunu e-posta ile gönderin
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={emailAddr}
            onChange={e => setEmailAddr(e.target.value)}
            style={{
              flex: 1, minWidth: 240,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              color: "var(--text-primary)", padding: "10px 16px",
              borderRadius: 10, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSendEmail}
            disabled={!emailAddr || emailLoading}
          >
            {emailLoading ? "⏳ Gönderiliyor..." : "📤 Raporu Gönder"}
          </button>
        </div>
        {emailSent && (
          <div style={{
            marginTop: 12, background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.2)",
            borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--meta-green)",
          }}>
            Rapor {emailAddr} adresine gönderildi!
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div style={{
        marginTop: 24,
        background: "rgba(24,119,242,0.06)", border: "1px solid rgba(24,119,242,0.15)",
        borderRadius: 10, padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>📄</span>
        <div>
          <strong style={{ color: "var(--text-primary)" }}>Rapor şablonları yakında!</strong>
          <br />
          Haftalık özet, kampanya karşılaştırma ve performans trendi rapor türleri Faz 3'te eklenecektir.
        </div>
      </div>
    </div>
  );
}
