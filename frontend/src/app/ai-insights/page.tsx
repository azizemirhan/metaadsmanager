"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function AIInsightsPage() {
  const [days, setDays] = useState(30);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", days],
    queryFn: () => api.getCampaigns(days),
  });

  const campaigns = campaignsData?.data || [];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await api.analyzeAll(days);
      setAnalysis(res.analysis);
    } catch (e) {
      setAnalysis("❌ Analiz yapılırken hata oluştu. API bağlantısını kontrol edin.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendEmail = async () => {
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
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          🤖 AI Analiz & Öneriler
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Claude AI ile reklam performansınızı analiz edin ve somut öneriler alın
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: days === d ? "var(--meta-blue)" : "transparent",
              color: days === d ? "white" : "var(--text-secondary)",
              fontWeight: days === d ? 600 : 400,
              fontSize: 13, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
            }}>
              Son {d} Gün
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? "⏳ Analiz ediliyor..." : "✨ AI Analizi Başlat"}
        </button>
      </div>

      {/* Campaign Count Info */}
      {campaigns.length > 0 && (
        <div style={{
          background: "rgba(24,119,242,0.06)", border: "1px solid rgba(24,119,242,0.15)",
          borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13,
          color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8,
        }}>
          📊 <strong style={{ color: "var(--text-primary)" }}>{campaigns.length} kampanya</strong> analiz için hazır · Son {days} gün verisi kullanılacak
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="ai-box" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Kampanyalarınız analiz ediliyor...
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Claude AI verilerinizi işliyor ve öneriler hazırlıyor
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--meta-blue)",
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
        </div>
      )}

      {/* Analysis Result */}
      {analysis && !isAnalyzing && (
        <div className="ai-box" style={{ padding: 32, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>AI Analiz Sonuçları</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Claude AI tarafından oluşturuldu · Son {days} gün</div>
            </div>
          </div>
          <div style={{
            fontSize: 14, lineHeight: 1.9, color: "var(--text-secondary)",
            whiteSpace: "pre-line",
          }}>
            {analysis}
          </div>
        </div>
      )}

      {/* Email Report Section */}
      <div className="card" style={{ padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          📧 Haftalık Rapor E-postası
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
            ✅ Rapor {emailAddr} adresine başarıyla gönderildi!
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 24 }}>
        {[
          { icon: "📈", title: "CTR Optimizasyonu", desc: "CTR %1'in altındaysa reklam görseli veya hedef kitleyi değiştirin." },
          { icon: "💰", title: "ROAS Takibi", desc: "ROAS 2x altındaysa bütçeyi azaltın veya dönüşüm izlemeyi kontrol edin." },
          { icon: "🔄", title: "Reklam Yorgunluğu", desc: "Frequency 3'ün üzerine çıkarsa yeni kreatifler eklemeyi düşünün." },
          { icon: "🎯", title: "Hedef Kitle", desc: "CPM çok yüksekse hedef kitleniz çok dardır, genişletin." },
        ].map(tip => (
          <div key={tip.title} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{tip.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{tip.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{tip.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
