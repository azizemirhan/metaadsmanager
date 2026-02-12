"use client";
import { useState } from "react";

const ENV_TEMPLATE = `# backend/.env

# META API — https://developers.facebook.com
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789

# ANTHROPIC (Claude AI) — https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx

# E-POSTA (Gmail ornegi)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=raporlama@sirketiniz.com
SMTP_PASSWORD=gmail_uygulama_sifresi

# ORTAM AYARLARI
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000

# FRONTEND (.env.local)
# NEXT_PUBLIC_API_URL=http://localhost:8000`;

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = ENV_TEMPLATE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const EnvVar = ({ name, example, desc, secret }: {
    name: string; example: string; desc: string; secret?: boolean;
  }) => (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <code style={{
        flexShrink: 0, fontSize: 12, fontFamily: "'Space Mono', monospace",
        color: "var(--meta-blue)", background: "rgba(24,119,242,0.08)",
        padding: "4px 8px", borderRadius: 6,
      }}>
        {name}
      </code>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>{desc}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>
          {secret ? example.slice(0, 8) + "..." : example}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 750 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Ayarlar</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>API ve servis yapilandirmasi rehberi</p>
      </div>

      {/* Important Notice */}
      <div style={{
        background: "rgba(255,211,42,0.06)", border: "1px solid rgba(255,211,42,0.25)",
        borderRadius: 12, padding: "16px 20px", marginBottom: 28,
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>&#9888;&#65039;</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--meta-yellow)", marginBottom: 4 }}>
            Yapilandirma .env dosyasindan yapilir
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Bu sayfa bir rehberdir; form degerleri sunucuya gonderilmez.
            Asagidaki degerleri <code style={{ color: "var(--meta-blue)", fontSize: 12 }}>backend/.env</code> dosyasina yazin
            ve backend'i yeniden baslatin.
          </div>
        </div>
      </div>

      {/* Meta API */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Meta API Ayarlari
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Meta Business Manager'dan alinan API kimlik bilgileri
        </p>
        <EnvVar name="META_ACCESS_TOKEN" example="EAAxxxxxxxxxxxxx" secret
          desc="Meta Developers → Tools → Graph API Explorer'dan alin" />
        <EnvVar name="META_AD_ACCOUNT_ID" example="act_123456789"
          desc="Business Manager → Ad Accounts'ta bulabilirsiniz" />
      </div>

      {/* Claude AI */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Claude AI Ayarlari
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Anthropic API anahtari ile AI analizi etkinlestirin
        </p>
        <EnvVar name="ANTHROPIC_API_KEY" example="sk-ant-api03-xxxxxxxx" secret
          desc="console.anthropic.com adresinden alin" />
      </div>

      {/* Email */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          E-posta Ayarlari
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Otomatik raporlar icin SMTP yapilandirmasi
        </p>
        <EnvVar name="SMTP_HOST" example="smtp.gmail.com"
          desc="SMTP sunucu adresi" />
        <EnvVar name="SMTP_PORT" example="587"
          desc="SMTP port (TLS icin genellikle 587)" />
        <EnvVar name="SMTP_USER" example="raporlama@sirketiniz.com"
          desc="Gonderici e-posta adresi" />
        <EnvVar name="SMTP_PASSWORD" example="gmail_uygulama_sifresi" secret
          desc="Gmail icin: Hesap → Guvenlik → Uygulama sifreleri" />
      </div>

      {/* Environment */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Ortam Ayarlari
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Production ve CORS yapilandirmasi
        </p>
        <EnvVar name="ENVIRONMENT" example="development"
          desc="development veya production — production'da hata detaylari gizlenir" />
        <EnvVar name="CORS_ORIGINS" example="http://localhost:3000"
          desc="Izin verilen origin'ler (virgul ile ayirin: http://localhost:3000,https://yourdomain.com)" />
      </div>

      {/* .env Template — Copy Section */}
      <div style={{
        background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)",
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>
            .env Sablonu
          </div>
          <button onClick={handleCopy} style={{
            padding: "6px 16px", borderRadius: 8, cursor: "pointer",
            border: copied ? "1px solid var(--meta-green)" : "1px solid rgba(139,92,246,0.3)",
            background: copied ? "rgba(0,214,143,0.1)" : "rgba(139,92,246,0.08)",
            color: copied ? "var(--meta-green)" : "#a78bfa",
            fontWeight: 600, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
          }}>
            {copied ? "Kopyalandi!" : "Panoya Kopyala"}
          </button>
        </div>
        <pre style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8,
          background: "var(--bg-primary)", padding: 16, borderRadius: 10,
          overflow: "auto", margin: 0,
        }}>
{ENV_TEMPLATE}
        </pre>
      </div>

      {/* Setup Steps */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          Kurulum Adimlari
        </h2>
        {[
          { step: 1, text: "Yukaridaki .env sablonunu kopyalayin" },
          { step: 2, text: "backend/.env dosyasi olusturun ve icine yapisitirin" },
          { step: 3, text: "Kendi degerlerinizle degistirin (token, key, vb.)" },
          { step: 4, text: "Backend'i yeniden baslatin: uvicorn app.main:app --reload" },
          { step: 5, text: "Frontend icin frontend/.env.local dosyasina NEXT_PUBLIC_API_URL ekleyin (opsiyonel)" },
        ].map(({ step, text }) => (
          <div key={step} style={{
            display: "flex", gap: 12, alignItems: "center", padding: "10px 0",
            borderBottom: step < 5 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "rgba(24,119,242,0.1)", color: "var(--meta-blue)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>
              {step}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
