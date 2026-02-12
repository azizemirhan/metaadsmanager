"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const InputField = ({ label, id, placeholder, type = "text", hint }: {
    label: string; id: string; placeholder: string; type?: string; hint?: string;
  }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        style={{
          width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
          color: "var(--text-primary)", padding: "11px 16px", borderRadius: 10,
          fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={e => e.target.style.borderColor = "var(--meta-blue)"}
        onBlur={e => e.target.style.borderColor = "var(--border)"}
      />
      {hint && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Ayarlar</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>API bağlantıları ve bildirim ayarları</p>
      </div>

      {/* Meta API */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          🔵 Meta API Ayarları
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Meta Business Manager'dan alınan API kimlik bilgileri
        </p>
        <InputField label="Access Token" id="meta_token" placeholder="EAAxxxxxxxxxxxxx..."
          type="password" hint="Meta Developers → Tools → Graph API Explorer'dan alın" />
        <InputField label="Ad Account ID" id="ad_account_id" placeholder="act_123456789"
          hint="Business Manager → Ad Accounts'ta bulabilirsiniz" />
        <InputField label="App ID" id="app_id" placeholder="123456789012345" />
        <InputField label="App Secret" id="app_secret" placeholder="xxxxxxxxxxxxxxxxxxxxx" type="password" />
      </div>

      {/* Claude AI */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          🤖 Claude AI Ayarları
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Anthropic API anahtarı ile AI analizi etkinleştirin
        </p>
        <InputField label="Anthropic API Key" id="anthropic_key" placeholder="sk-ant-xxxxxxxxxxxxx"
          type="password" hint="console.anthropic.com adresinden alın" />
      </div>

      {/* Email */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          📧 E-posta Ayarları
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Otomatik raporlar için SMTP yapılandırması
        </p>
        <InputField label="SMTP Host" id="smtp_host" placeholder="smtp.gmail.com" />
        <InputField label="SMTP Port" id="smtp_port" placeholder="587" />
        <InputField label="E-posta Adresi" id="smtp_user" placeholder="rapor@sirketiniz.com" type="email" />
        <InputField label="Şifre / App Password" id="smtp_pass" placeholder="••••••••••••••••" type="password"
          hint="Gmail için: Hesap → Güvenlik → Uygulama şifreleri" />
      </div>

      {/* .env info */}
      <div style={{
        background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)",
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 12 }}>
          💡 Bu değerleri .env dosyasına yazın
        </div>
        <pre style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 2,
          background: "var(--bg-primary)", padding: 16, borderRadius: 10,
          overflow: "auto",
        }}>
{`# backend/.env
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rapor@sirketiniz.com
SMTP_PASSWORD=uygulama_sifresi`}
        </pre>
      </div>

      <button className="btn-primary" onClick={handleSave} style={{ padding: "12px 32px" }}>
        {saved ? "✅ Kaydedildi!" : "💾 Ayarları Kaydet"}
      </button>
    </div>
  );
}
