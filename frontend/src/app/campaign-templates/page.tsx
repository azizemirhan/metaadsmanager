"use client";
import { useState, useEffect } from "react";
import { api } from "../lib/api";

type TabId = "templates" | "clone";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const authHeader = () => ({
  Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("meta_ads_token") : ""}`,
  "Content-Type": "application/json",
});

interface CampaignTemplate {
  id: string;
  name: string;
  description?: string;
  objective: string;
  status: string;
  daily_budget?: number;
  lifetime_budget?: number;
  ad_account_id?: string;
  source_campaign_id?: string;
  created_at?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

const OBJECTIVES = [
  "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION",
];

export default function CampaignTemplatesPage() {
  const [tab, setTab] = useState<TabId>("templates");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Kampanya Şablonları & Klonlama</h1>
      <p className="text-gray-500 mb-6">Kampanya yapılandırmalarını kaydedin, klonlayın ve şablon olarak uygulayın</p>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["templates", "clone"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "templates" ? "Şablon Kitaplığı" : "Kampanya Klonla"}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesTab />}
      {tab === "clone" && <CloneTab />}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<CampaignTemplate> | null>(null);
  const [applying, setApplying] = useState<CampaignTemplate | null>(null);
  const [applyName, setApplyName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTemplates = async () => {
    const res = await fetch(`${BASE}/api/campaign-templates`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setTemplates(d.data || []); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const save = async () => {
    if (!editing?.name?.trim()) { setMsg("Şablon adı zorunlu."); return; }
    setLoading(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? `${BASE}/api/campaign-templates` : `${BASE}/api/campaign-templates/${editing.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: authHeader(),
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          objective: editing.objective || "OUTCOME_TRAFFIC",
          status: "PAUSED",
          daily_budget: editing.daily_budget,
          lifetime_budget: editing.lifetime_budget,
          ad_account_id: editing.ad_account_id,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setEditing(null);
      setMsg(isNew ? "Şablon oluşturuldu." : "Şablon güncellendi.");
      fetchTemplates();
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  const del = async (id: string) => {
    await fetch(`${BASE}/api/campaign-templates/${id}`, { method: "DELETE", headers: authHeader() });
    fetchTemplates();
  };

  const apply = async () => {
    if (!applying || !applyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/campaign-templates/${applying.id}/apply`, {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({ name: applyName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setApplying(null);
      setApplyName("");
      setMsg(`Kampanya '${d.name}' oluşturuldu. ID: ${d.campaign_id}`);
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700">{msg}</div>}

      <button onClick={() => setEditing({ objective: "OUTCOME_TRAFFIC" })} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
        + Yeni Şablon
      </button>

      {/* Edit form */}
      {editing !== null && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">{editing.id ? "Şablonu Düzenle" : "Yeni Kampanya Şablonu"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Şablon Adı</label>
              <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Hedef</label>
              <select value={editing.objective || "OUTCOME_TRAFFIC"} onChange={(e) => setEditing({ ...editing, objective: e.target.value })} className="border rounded-lg px-3 py-2 w-full">
                {OBJECTIVES.map((o) => <option key={o} value={o}>{o.replace("OUTCOME_", "")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Günlük Bütçe (kuruş)</label>
              <input type="number" value={editing.daily_budget || ""} onChange={(e) => setEditing({ ...editing, daily_budget: parseFloat(e.target.value) || undefined })} className="border rounded-lg px-3 py-2 w-full" placeholder="örn. 1000 = 10 TL" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Toplam Bütçe (kuruş)</label>
              <input type="number" value={editing.lifetime_budget || ""} onChange={(e) => setEditing({ ...editing, lifetime_budget: parseFloat(e.target.value) || undefined })} className="border rounded-lg px-3 py-2 w-full" placeholder="örn. 10000 = 100 TL" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium block mb-1">Açıklama</label>
              <input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">Kaydet</button>
            <button onClick={() => setEditing(null)} className="border px-4 py-2 rounded-lg hover:bg-gray-50">İptal</button>
          </div>
        </div>
      )}

      {/* Apply dialog */}
      {applying && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-3">
          <h2 className="font-semibold">Şablon Uygula: <span className="text-blue-600">{applying.name}</span></h2>
          <p className="text-gray-500 text-sm">Bu şablondan Meta'da yeni bir kampanya oluşturulacak.</p>
          <input value={applyName} onChange={(e) => setApplyName(e.target.value)} placeholder="Yeni kampanya adı" className="border rounded-lg px-3 py-2 w-full" />
          <div className="flex gap-3">
            <button onClick={apply} disabled={loading || !applyName.trim()} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">Meta'da Oluştur</button>
            <button onClick={() => setApplying(null)} className="border px-4 py-2 rounded-lg hover:bg-gray-50">İptal</button>
          </div>
        </div>
      )}

      {/* Templates grid */}
      <div className="grid gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{t.name}</h3>
                {t.description && <p className="text-gray-500 text-sm mt-0.5">{t.description}</p>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">{t.objective?.replace("OUTCOME_", "")}</span>
                  {t.daily_budget && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Günlük: {(t.daily_budget / 100).toFixed(0)} TL</span>}
                  {t.lifetime_budget && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Toplam: {(t.lifetime_budget / 100).toFixed(0)} TL</span>}
                  {t.source_campaign_id && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">Klondan</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setApplying(t); setApplyName(`${t.name} - ${new Date().toLocaleDateString("tr")}`); }} className="text-green-600 hover:underline text-sm">Uygula</button>
                <button onClick={() => setEditing(t)} className="text-blue-600 hover:underline text-sm">Düzenle</button>
                <button onClick={() => del(t.id)} className="text-red-600 hover:underline text-sm">Sil</button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t.created_at ? new Date(t.created_at).toLocaleDateString("tr") : ""}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="text-lg mb-2">Şablon kitaplığı boş</p>
            <p className="text-sm">Yeni şablon oluşturun veya Klonla sekmesinde kampanya kopyalayın.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clone Tab ────────────────────────────────────────────────────────────────

function CloneTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [result, setResult] = useState<{ new_campaign_id?: string; new_name?: string; saved_template?: unknown } | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCampaigns(30).then((d) => setCampaigns(d.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedId) {
      const c = campaigns.find((c) => c.id === selectedId);
      if (c) setNewName(`${c.name} (Kopya)`);
    }
  }, [selectedId, campaigns]);

  const clone = async () => {
    if (!selectedId) { setMsg("Kampanya seçin."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/campaign-templates/clone`, {
        method: "POST", headers: authHeader(),
        body: JSON.stringify({
          campaign_id: selectedId,
          new_name: newName || undefined,
          status: "PAUSED",
          save_as_template: saveAsTemplate,
          template_name: templateName || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setResult(d);
      setMsg(`Kampanya başarıyla klonlandı!`);
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes("başarı") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg}</div>}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h3 className="font-semibold text-green-800">Klonlama Başarılı!</h3>
          <p className="text-green-700 text-sm mt-1">Yeni Kampanya ID: <code className="font-mono">{result.new_campaign_id}</code></p>
          <p className="text-green-700 text-sm">Ad: {result.new_name}</p>
          {result.saved_template && <p className="text-green-700 text-sm">Şablon olarak kaydedildi ✓</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="font-semibold">Kampanya Klonla</h2>

        <div>
          <label className="text-sm font-medium block mb-2">Klonlanacak Kampanya</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="border rounded-lg px-3 py-2 w-full">
            <option value="">Kampanya seçin...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Yeni Kampanya Adı</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border rounded-lg px-3 py-2 w-full" placeholder="Boş bırakılırsa otomatik ad oluşturulur" />
        </div>

        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="saveTemplate" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
            <label htmlFor="saveTemplate" className="text-sm font-medium">Şablon olarak da kaydet</label>
          </div>
          {saveAsTemplate && (
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="border rounded-lg px-3 py-2 w-full" placeholder="Şablon adı (boş = kampanya adı)" />
          )}
        </div>

        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
          <strong>Not:</strong> Klonlanan kampanya PAUSED durumunda oluşturulur. Reklam setleri ve reklamlar kopyalanmaz, yalnızca kampanya yapılandırması klonlanır.
        </div>

        <button onClick={clone} disabled={loading || !selectedId} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Klonlanıyor..." : "Klonla"}
        </button>
      </div>
    </div>
  );
}
