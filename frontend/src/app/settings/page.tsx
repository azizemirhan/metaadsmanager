"use client";

import { useState, useEffect } from "react";
import { api } from "../lib/api";

const SETTING_KEYS = [
  { id: "META_ACCESS_TOKEN", label: "Access Token", type: "password", placeholder: "EAAxxxxxxxxxxxxx...", hint: "Meta Developers → Tools → Graph API Explorer'dan alın" },
  { id: "META_AD_ACCOUNT_ID", label: "Ad Account ID", type: "text", placeholder: "act_123456789", hint: "Business Manager → Ad Accounts'ta bulabilirsiniz" },
  { id: "META_APP_ID", label: "App ID", type: "text", placeholder: "123456789012345" },
  { id: "META_APP_SECRET", label: "App Secret", type: "password", placeholder: "xxxxxxxxxxxxxxxxxxxxx" },
  { id: "ANTHROPIC_API_KEY", label: "Anthropic API Key (Claude)", type: "password", placeholder: "sk-ant-xxxxxxxxxxxxx", hint: "console.anthropic.com" },
  { id: "GEMINI_API_KEY", label: "Gemini API Key", type: "password", placeholder: "AIza...", hint: "aistudio.google.com/apikey" },
  { id: "AI_PROVIDER", label: "AI Sağlayıcı", type: "text", placeholder: "gemini veya claude" },
  { id: "SMTP_HOST", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com" },
  { id: "SMTP_PORT", label: "SMTP Port", type: "text", placeholder: "587" },
  { id: "SMTP_USER", label: "E-posta (SMTP)", type: "email", placeholder: "rapor@sirketiniz.com" },
  { id: "SMTP_PASSWORD", label: "SMTP Şifre / App Password", type: "password", placeholder: "••••••••", hint: "Gmail: Hesap → Güvenlik → Uygulama şifreleri" },
] as const;

const WHATSAPP_KEYS = [
  { id: "WHATSAPP_PHONE_ID", label: "WhatsApp Phone ID", type: "text", placeholder: "123456789012345", hint: "Meta Developers → WhatsApp → Phone Number ID" },
  { id: "WHATSAPP_ACCESS_TOKEN", label: "WhatsApp Access Token (opsiyonel)", type: "password", placeholder: "EAA...", hint: "Boş bırakılırsa META_ACCESS_TOKEN kullanılır" },
  { id: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", label: "Webhook Verify Token", type: "password", placeholder: "your_secure_token", hint: "WhatsApp webhook doğrulama için güvenli token" },
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const loadSettings = () => {
    setLoading(true);
    setError("");
    api.getSettings()
      .then((data) => setSettings(data || {}))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Ayarlar yüklenemedi.";
        setError(/failed to fetch|network error/i.test(String(msg))
          ? "Backend'e ulaşılamıyor. Backend'in çalıştığından emin olun."
          : msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      for (const { id } of [...SETTING_KEYS, ...WHATSAPP_KEYS]) {
        const v = settings[id];
        if (v != null && v !== "" && v !== "***") body[id] = v;
      }
      await api.updateSettings(body);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kaydetme hatası.";
      setError(/failed to fetch|network error/i.test(String(msg))
        ? "Backend'e ulaşılamıyor. Ayarlar kaydedilemedi. Backend'in (örn. http://localhost:8000) çalıştığını kontrol edin."
        : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Ayarlar</h1>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Ayarlar</h1>
        <p className="text-slate-500 text-sm">API bağlantıları ve bildirim ayarları. Kaydedilen değerler sunucuda saklanır.</p>
      </div>

      <div className="card p-7 mb-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Meta & AI & E-posta</h2>
            <p className="text-xs text-slate-500">API anahtarları ve yapılandırma</p>
          </div>
        </div>

        <div className="space-y-5">
          {SETTING_KEYS.map((setting) => {
            const { id, label, type, placeholder } = setting;
            const hint = "hint" in setting ? setting.hint : undefined;
            return (
            <div key={id}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label}
              </label>
              <input
                type={type}
                value={settings[id] ?? ""}
                onChange={(e) => handleChange(id, e.target.value)}
                placeholder={placeholder}
                className="input w-full"
              />
              {hint && <div className="text-xs text-slate-400 mt-1.5">{hint}</div>}
            </div>
            );
          })}
        </div>
      </div>

      {/* WhatsApp Ayarları */}
      <div className="card p-7 mb-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
            <WhatsAppIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">WhatsApp Business API</h2>
            <p className="text-xs text-slate-500">Rapor ve uyarıları WhatsApp ile göndermek için</p>
          </div>
        </div>

        <div className="space-y-5">
          {WHATSAPP_KEYS.map(({ id, label, type, placeholder, hint }) => (
            <div key={id}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label}
              </label>
              <input
                type={type}
                value={settings[id] ?? ""}
                onChange={(e) => handleChange(id, e.target.value)}
                placeholder={placeholder}
                className="input w-full"
              />
              {hint && <div className="text-xs text-slate-400 mt-1.5">{hint}</div>}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <div className="flex items-start gap-3">
            <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {/ulaşılamıyor|failed to fetch/i.test(error) && (
                <p className="mt-2 text-sm">
                  <a href={apiBase} target="_blank" rel="noopener noreferrer" className="underline">Backend adresini</a> tarayıcıda açarak test edin. Çalışıyorsa sayfayı yenileyip{" "}
                  <button type="button" onClick={loadSettings} className="font-medium underline">tekrar deneyin</button>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="alert alert-success mb-4">
          <CheckIcon className="w-4 h-4" />
          Ayarlar başarıyla kaydedildi!
        </div>
      )}

      <button 
        className="btn-primary flex items-center gap-2 px-8"
        onClick={handleSave} 
        disabled={saving}
      >
        {saving ? (
          <LoadingIcon className="w-4 h-4 animate-spin" />
        ) : (
          <SaveIcon className="w-4 h-4" />
        )}
        {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
      </button>

      <p className="mt-6 text-sm text-slate-500">
        Hassas alanlar (token, şifre) API yanıtında maskelenir (***). Değiştirmek için yeni değeri yazıp kaydedin.
      </p>
    </div>
  );
}

// Icons
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
