"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [exportLoading, setExportLoading] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleExportCsv = async (type: "campaigns" | "ads" | "adsets") => {
    setExportLoading(true);
    try {
      await api.exportCsv(type, days);
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!emailAddr) return;
    setEmailLoading(true);
    try {
      await api.sendReport(emailAddr, days, true);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch (e) {
      alert("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Raporlar
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Hazır raporları indirin veya e-posta ile gönderin
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
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

      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          CSV İndir
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Kampanya, reklam seti veya reklam verilerini CSV olarak indirin (son {days} gün).
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-outline" onClick={() => handleExportCsv("campaigns")} disabled={exportLoading}>
            {exportLoading ? "⏳ İndiriliyor..." : "📊 Kampanyalar CSV"}
          </button>
          <button className="btn-outline" onClick={() => handleExportCsv("adsets")} disabled={exportLoading}>
            Reklam setleri CSV
          </button>
          <button className="btn-outline" onClick={() => handleExportCsv("ads")} disabled={exportLoading}>
            Reklamlar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          E-posta ile rapor gönder
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          AI özeti ve CSV eki ile haftalık raporu e-posta adresine gönderin.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            style={{
              flex: 1,
              minWidth: 240,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <button className="btn-primary" onClick={handleSendReport} disabled={!emailAddr || emailLoading}>
            {emailLoading ? "⏳ Gönderiliyor..." : "📤 Raporu Gönder"}
          </button>
        </div>
        {emailSent && (
          <div style={{ marginTop: 12, background: "rgba(0,214,143,0.1)", border: "1px solid rgba(0,214,143,0.2)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "var(--meta-green)" }}>
            ✅ Rapor {emailAddr} adresine gönderildi.
          </div>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
        Daha fazla AI analiz ve öneri için <Link href="/ai-insights" style={{ color: "var(--meta-blue)", textDecoration: "none" }}>AI Analiz</Link> sayfasına gidin.
      </p>
    </div>
  );
}
