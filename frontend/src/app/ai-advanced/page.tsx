"use client";
import { useState, useEffect } from "react";

type TabId = "templates" | "context" | "language";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const authHeader = () => ({
  Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("meta_ads_token") : ""}`,
  "Content-Type": "application/json",
});

interface AITemplate {
  id: string;
  name: string;
  description?: string;
  context_type: string;
  prompt_template: string;
  language: string;
  is_default: boolean;
  created_at?: string;
}

interface ContextEntry {
  id: string;
  context_type: string;
  period_label: string;
  key_metrics?: Record<string, unknown>;
  insights: string;
  ad_account_id?: string;
  created_at?: string;
}

const CONTEXT_TYPES = [
  { id: "general", name: "Genel Analiz" },
  { id: "campaign", name: "Kampanya Analizi" },
  { id: "weekly", name: "Haftalık Özet" },
  { id: "forecast", name: "Tahmin" },
  { id: "anomaly", name: "Anomali Tespiti" },
];

const LANGUAGES: Record<string, string> = {
  tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", pt: "Português",
};

export default function AIAdvancedPage() {
  const [tab, setTab] = useState<TabId>("templates");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">AI Geliştirmeleri</h1>
      <p className="text-gray-500 mb-6">Özelleştirilebilir analiz şablonları, trend hafızası ve çok dilli çıktı</p>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["templates", "context", "language"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "templates" ? "Analiz Şablonları" : t === "context" ? "Trend Hafızası" : "Dil Ayarı"}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesTab />}
      {tab === "context" && <ContextTab />}
      {tab === "language" && <LanguageTab />}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [editing, setEditing] = useState<Partial<AITemplate> | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fetch_ = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/templates`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setTemplates(d.data || []); }
  };

  useEffect(() => { fetch_(); }, []);

  const save = async () => {
    if (!editing?.name?.trim() || !editing?.prompt_template?.trim()) {
      setMsg("Ad ve şablon metni zorunlu."); return;
    }
    setLoading(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? `${BASE}/api/ai-templates/templates` : `${BASE}/api/ai-templates/templates/${editing.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: authHeader(),
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          context_type: editing.context_type || "general",
          prompt_template: editing.prompt_template,
          language: editing.language || "tr",
          is_default: editing.is_default || false,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setEditing(null);
      setMsg(isNew ? "Şablon oluşturuldu." : "Şablon güncellendi.");
      fetch_();
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  const del = async (id: string) => {
    await fetch(`${BASE}/api/ai-templates/templates/${id}`, { method: "DELETE", headers: authHeader() });
    fetch_();
  };

  const seedDefaults = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/templates/seed-defaults`, { method: "POST", headers: authHeader() });
    const d = await res.json();
    setMsg(`${d.added?.length || 0} varsayılan şablon eklendi.`);
    fetch_();
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700">{msg}</div>}

      <div className="flex gap-3">
        <button onClick={() => setEditing({ context_type: "general", language: "tr" })} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Yeni Şablon
        </button>
        <button onClick={seedDefaults} className="border px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">
          Varsayılanları Yükle
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">{editing.id ? "Şablonu Düzenle" : "Yeni Şablon"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Şablon Adı</label>
              <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Bağlam Türü</label>
              <select value={editing.context_type || "general"} onChange={(e) => setEditing({ ...editing, context_type: e.target.value })} className="border rounded-lg px-3 py-2 w-full">
                {CONTEXT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Dil</label>
              <select value={editing.language || "tr"} onChange={(e) => setEditing({ ...editing, language: e.target.value })} className="border rounded-lg px-3 py-2 w-full">
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="isDefault" checked={editing.is_default || false} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
              <label htmlFor="isDefault" className="text-sm">Bu türün varsayılan şablonu yap</label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Açıklama</label>
            <input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Şablon Metni{" "}
              <span className="text-gray-400 font-normal">(Değişkenler: {"{data}"}, {"{context}"}, {"{period}"})</span>
            </label>
            <textarea
              value={editing.prompt_template || ""}
              onChange={(e) => setEditing({ ...editing, prompt_template: e.target.value })}
              rows={8}
              className="border rounded-lg px-3 py-2 w-full font-mono text-sm"
              placeholder="AI'ya gönderilecek sistem/kullanıcı promptu..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">Kaydet</button>
            <button onClick={() => setEditing(null)} className="border px-4 py-2 rounded-lg hover:bg-gray-50">İptal</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.is_default && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Varsayılan</span>}
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{LANGUAGES[t.language] || t.language}</span>
                  <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{CONTEXT_TYPES.find(c => c.id === t.context_type)?.name || t.context_type}</span>
                </div>
                {t.description && <p className="text-gray-500 text-sm mt-1">{t.description}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(t)} className="text-blue-600 hover:underline text-sm">Düzenle</button>
                <button onClick={() => del(t.id)} className="text-red-600 hover:underline text-sm">Sil</button>
              </div>
            </div>
            <pre className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap line-clamp-3">{t.prompt_template}</pre>
          </div>
        ))}
        {templates.length === 0 && <div className="text-center text-gray-400 py-12">Henüz şablon yok. "Varsayılanları Yükle" ile başlayın.</div>}
      </div>
    </div>
  );
}

// ─── Context (Trend Memory) Tab ───────────────────────────────────────────────

function ContextTab() {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [summary, setSummary] = useState("");
  const [form, setForm] = useState({ context_type: "weekly_summary", period_label: "", insights: "", key_metrics: "" });
  const [msg, setMsg] = useState("");

  const fetchEntries = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/context-entries?limit=30`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setEntries(d.data || []); }
  };

  const fetchSummary = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/context-entries/summary`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setSummary(d.summary || ""); }
  };

  useEffect(() => { fetchEntries(); fetchSummary(); }, []);

  const add = async () => {
    if (!form.period_label.trim() || !form.insights.trim()) { setMsg("Dönem ve bulgular zorunlu."); return; }
    let metrics = undefined;
    if (form.key_metrics.trim()) {
      try { metrics = JSON.parse(form.key_metrics); } catch { setMsg("Metrikler geçerli JSON olmalı."); return; }
    }
    const res = await fetch(`${BASE}/api/ai-templates/context-entries`, {
      method: "POST", headers: authHeader(),
      body: JSON.stringify({ ...form, key_metrics: metrics }),
    });
    if (res.ok) { setForm({ context_type: "weekly_summary", period_label: "", insights: "", key_metrics: "" }); setMsg("Bağlam eklendi."); fetchEntries(); fetchSummary(); }
  };

  const del = async (id: string) => {
    await fetch(`${BASE}/api/ai-templates/context-entries/${id}`, { method: "DELETE", headers: authHeader() });
    fetchEntries(); fetchSummary();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700">{msg}</div>}

      {/* Summary */}
      {summary && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
          <h2 className="font-semibold text-indigo-800 mb-3">AI Bağlam Özeti (Son 10 Girdi)</h2>
          <pre className="text-sm text-indigo-700 whitespace-pre-wrap font-sans">{summary}</pre>
        </div>
      )}

      {/* Add form */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Yeni Trend Girdisi Ekle</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Bağlam Türü</label>
            <select value={form.context_type} onChange={(e) => setForm({ ...form, context_type: e.target.value })} className="border rounded-lg px-3 py-2 w-full">
              {["weekly_summary", "anomaly", "forecast", "insight"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Dönem (örn. 2024-W05)</label>
            <input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} className="border rounded-lg px-3 py-2 w-full" placeholder="2024-W05" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Temel Bulgular</label>
          <textarea value={form.insights} onChange={(e) => setForm({ ...form, insights: e.target.value })} rows={3} className="border rounded-lg px-3 py-2 w-full" placeholder="Bu dönemde ROAS %20 düştü, mobil trafiği arttı..." />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Anahtar Metrikler (JSON, isteğe bağlı)</label>
          <input value={form.key_metrics} onChange={(e) => setForm({ ...form, key_metrics: e.target.value })} className="border rounded-lg px-3 py-2 w-full font-mono text-sm" placeholder='{"spend": 5000, "roas": 2.1}' />
        </div>
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">Ekle</button>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="bg-white rounded-xl border p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-blue-700">{e.period_label}</span>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{e.context_type}</span>
                {e.key_metrics && (
                  <span className="text-xs text-gray-400">{Object.entries(e.key_metrics).map(([k, v]) => `${k}: ${v}`).join(" | ")}</span>
                )}
              </div>
              <p className="text-sm text-gray-700">{e.insights}</p>
              <p className="text-xs text-gray-400 mt-1">{e.created_at ? new Date(e.created_at).toLocaleString("tr") : ""}</p>
            </div>
            <button onClick={() => del(e.id)} className="text-red-500 hover:text-red-700 text-xs">Sil</button>
          </div>
        ))}
        {entries.length === 0 && <div className="text-center text-gray-400 py-12">Henüz bağlam girdisi yok.</div>}
      </div>
    </div>
  );
}

// ─── Language Tab ─────────────────────────────────────────────────────────────

function LanguageTab() {
  const [current, setCurrent] = useState("tr");
  const [saved, setSaved] = useState(false);

  const fetchLang = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/language`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setCurrent(d.language || "tr"); }
  };

  useEffect(() => { fetchLang(); }, []);

  const save = async () => {
    const res = await fetch(`${BASE}/api/ai-templates/language`, {
      method: "PUT", headers: authHeader(), body: JSON.stringify({ language: current }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const PREVIEWS: Record<string, string> = {
    tr: "ROAS değeriniz bu hafta 2.4'e yükseldi. Bütçenizi %20 artırmanızı öneririm.",
    en: "Your ROAS increased to 2.4 this week. I recommend increasing your budget by 20%.",
    de: "Ihr ROAS ist diese Woche auf 2,4 gestiegen. Ich empfehle, Ihr Budget um 20% zu erhöhen.",
    fr: "Votre ROAS a augmenté à 2,4 cette semaine. Je recommande d'augmenter votre budget de 20%.",
    es: "Su ROAS aumentó a 2.4 esta semana. Recomiendo aumentar su presupuesto en un 20%.",
    ar: "ارتفع معدل ROAS الخاص بك إلى 2.4 هذا الأسبوع. أوصي بزيادة ميزانيتك بنسبة 20%.",
    pt: "Seu ROAS aumentou para 2,4 esta semana. Recomendo aumentar seu orçamento em 20%.",
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div>
          <h2 className="font-semibold mb-1">AI Çıktı Dili</h2>
          <p className="text-gray-500 text-sm">Seçilen dil tüm AI analizlerinde kullanılacak.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(LANGUAGES).map(([code, name]) => (
            <button
              key={code}
              onClick={() => setCurrent(code)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${current === code ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="font-medium">{name}</div>
              <div className="text-gray-400 text-xs mt-0.5">{code.toUpperCase()}</div>
            </button>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">Örnek AI çıktısı:</p>
          <p className="text-sm text-gray-700 italic">{PREVIEWS[current] || "..."}</p>
        </div>
        <button onClick={save} className={`px-6 py-2 rounded-lg text-white ${saved ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"}`}>
          {saved ? "Kaydedildi ✓" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
