"use client";
import { useState, useEffect, useCallback } from "react";
import { api, SettingsResponse } from "../lib/api";

/* ── Field definitions ─────────────────────────────────────── */
interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type: string;
  hint?: string;
  sensitive: boolean;
}

const META_FIELDS: FieldDef[] = [
  { key: "meta_access_token", label: "Access Token", placeholder: "EAAxxxxxxxxxxxxx...", type: "password", sensitive: true, hint: "Meta Developers -> Tools -> Graph API Explorer'dan alin" },
  { key: "meta_ad_account_id", label: "Ad Account ID", placeholder: "act_123456789", type: "text", sensitive: false, hint: "Business Manager -> Ad Accounts'ta bulabilirsiniz" },
  { key: "meta_app_id", label: "App ID", placeholder: "123456789012345", type: "text", sensitive: false },
  { key: "meta_app_secret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxx", type: "password", sensitive: true },
];

const AI_FIELDS: FieldDef[] = [
  { key: "anthropic_api_key", label: "Anthropic API Key", placeholder: "sk-ant-xxxxxxxxxxxxx", type: "password", sensitive: true, hint: "console.anthropic.com adresinden alin" },
  { key: "gemini_api_key", label: "Gemini API Key", placeholder: "AIzaXXXXXXXXXXXX", type: "password", sensitive: true, hint: "Google AI Studio'dan alin (opsiyonel)" },
  { key: "ai_provider", label: "AI Saglayici", placeholder: "claude veya gemini", type: "text", sensitive: false, hint: "Bos birakilirsa otomatik secilir" },
];

const EMAIL_FIELDS: FieldDef[] = [
  { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com", type: "text", sensitive: false },
  { key: "smtp_port", label: "SMTP Port", placeholder: "587", type: "text", sensitive: false },
  { key: "smtp_user", label: "E-posta Adresi", placeholder: "rapor@sirketiniz.com", type: "email", sensitive: false },
  { key: "smtp_password", label: "Sifre / App Password", placeholder: "", type: "password", sensitive: true, hint: "Gmail icin: Hesap -> Guvenlik -> Uygulama sifreleri" },
];

/* ── Page ──────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.getSettings();
      setSettings(data);
      // Pre-fill non-sensitive fields with their current values
      const initial: Record<string, string> = {};
      for (const [key, field] of Object.entries(data)) {
        if (field.value !== undefined) {
          initial[key] = field.value;
        }
        // Sensitive fields start empty (user must type new value to update)
      }
      setFormValues(initial);
    } catch {
      setLoadError("Ayarlar yuklenemedi. Backend baglantisini kontrol edin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Only send fields that have values (skip empty sensitive fields = no change)
      const payload: Record<string, string> = {};
      for (const [key, value] of Object.entries(formValues)) {
        if (value) {
          payload[key] = value;
        }
      }
      const result = await api.updateSettings(payload);
      setSaveMsg({ type: "success", text: `Ayarlar kaydedildi (${result.updated.length} alan guncellendi)` });
      // Refresh to get updated masked values
      await fetchSettings();
      setTimeout(() => setSaveMsg(null), 4000);
    } catch {
      setSaveMsg({ type: "error", text: "Ayarlar kaydedilemedi. Backend baglantisini kontrol edin." });
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ field }: { field: FieldDef }) => {
    const settingsField = settings?.[field.key];
    const isConfigured = settingsField?.configured;
    const maskedValue = settingsField?.masked || "";

    return (
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
          {field.label}
          {isConfigured && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 10, background: "rgba(0,214,143,0.1)", color: "var(--meta-green)" }}>
              Yapilandirildi
            </span>
          )}
        </label>
        <input
          type={field.type}
          placeholder={field.sensitive && isConfigured ? `Mevcut: ${maskedValue}` : field.placeholder}
          value={formValues[field.key] || ""}
          onChange={(e) => handleChange(field.key, e.target.value)}
          style={{
            width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: "var(--text-primary)", padding: "11px 16px", borderRadius: 10,
            fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--meta-blue)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        {field.hint && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{field.hint}</div>}
        {field.sensitive && isConfigured && !formValues[field.key] && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
            Degistirmek icin yeni deger girin, bos birakirsaniz mevcut deger korunur
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, icon: string, description: string, fields: FieldDef[]) => (
    <div className="card" style={{ padding: 28, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
        {icon} {title}
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>{description}</p>
      {fields.map((f) => (
        <InputField key={f.key} field={f} />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Ayarlar</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>API baglantilari ve bildirim ayarlari</p>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 28, marginBottom: 24 }}>
            <div className="skeleton" style={{ height: 20, width: "40%", marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 14, width: "70%", marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 42, width: "100%", marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 42, width: "100%", marginBottom: 16 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Ayarlar</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>API baglantilari ve bildirim ayarlari</p>
      </div>

      {loadError && (
        <div style={{ marginBottom: 24, padding: 16, background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 12, fontSize: 13, color: "var(--meta-red)" }}>
          {loadError}
        </div>
      )}

      {renderSection("Meta API Ayarlari", "🔵", "Meta Business Manager'dan alinan API kimlik bilgileri", META_FIELDS)}
      {renderSection("AI Ayarlari", "🤖", "Anthropic veya Gemini API anahtari ile AI analizi etkinlestirin", AI_FIELDS)}
      {renderSection("E-posta Ayarlari", "📧", "Otomatik raporlar icin SMTP yapilandirmasi", EMAIL_FIELDS)}

      {/* Save button & feedback */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "12px 32px" }}>
          {saving ? "Kaydediliyor..." : "Ayarlari Kaydet"}
        </button>
        {saveMsg && (
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: saveMsg.type === "success" ? "var(--meta-green)" : "var(--meta-red)",
          }}>
            {saveMsg.text}
          </span>
        )}
      </div>

      {/* Info box */}
      <div style={{
        background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)",
        borderRadius: 16, padding: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>
          Bilgi
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
          Ayarlar sunucuda <code style={{ background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4 }}>settings.json</code> dosyasina kaydedilir.
          Hassas degerler (token, sifre) API yanitinda maskelenir.
          Alternatif olarak <code style={{ background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4 }}>backend/.env</code> dosyasini dogrudan duzenleyebilirsiniz.
        </div>
      </div>
    </div>
  );
}
