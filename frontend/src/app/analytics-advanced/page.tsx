"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  BarChart2,
  TrendingUp,
  GitBranch,
  Calculator,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Cell,
} from "recharts";

// ─── Tip tanımları ─────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
}

type Tab = "abtest" | "cohort" | "attribution" | "custom";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const AB_METRICS = [
  { id: "ctr", label: "CTR (%)" },
  { id: "roas", label: "ROAS (x)" },
  { id: "cpc", label: "CPC (₺)" },
  { id: "cpm", label: "CPM (₺)" },
  { id: "spend", label: "Harcama (₺)" },
  { id: "impressions", label: "Gösterim" },
  { id: "clicks", label: "Tıklama" },
  { id: "conversions", label: "Dönüşüm" },
];

const ATTRIBUTION_MODELS = [
  { id: "first_touch", label: "First Touch", desc: "Tüm kredi ilk kampanyaya" },
  { id: "last_touch", label: "Last Touch", desc: "Tüm kredi son kampanyaya" },
  { id: "linear", label: "Linear", desc: "Eşit dağılım" },
  { id: "time_decay", label: "Time Decay", desc: "Yakın zamandakine daha fazla" },
  { id: "position_based", label: "Position Based", desc: "İlk ve sona 40%, ortaya 20%" },
];

// ─── A/B Test sekmesi ─────────────────────────────────────────────────────────

function ABTestTab() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [metric, setMetric] = useState("ctr");
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", days],
    queryFn: () => api.getCampaigns(days),
  });
  const campaigns: Campaign[] = campaignsData?.data ?? [];

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );

  const run = async () => {
    if (selectedIds.length < 2) { setError("En az 2 kampanya seçin."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await api.runABTest({ campaign_ids: selectedIds, metric, days });
      setResult(r);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Config */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Metrik</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {AB_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Süre</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Son {d} gün</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading || selectedIds.length < 2}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Analiz Et
            </button>
          </div>
        </div>

        {/* Kampanya seçimi */}
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Karşılaştırılacak Kampanyalar ({selectedIds.length} seçildi, en az 2)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {campaigns.slice(0, 20).map((c) => (
            <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedIds.includes(c.id) ? "bg-blue-50 border border-blue-300" : "border border-slate-200 hover:bg-slate-50"}`}>
              <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" />
              <span className="text-sm text-slate-800 truncate">{c.name}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.status}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Sonuç */}
      {result && (
        <div className="space-y-4">
          {/* En iyi varyant */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Kazanan: {result.best_variant?.name} ({result.best_variant?.label})
              </div>
              <div className="text-xs text-amber-700">
                {metric.toUpperCase()}: {result.best_variant?.value}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-sm font-semibold text-slate-700 mb-3">{AB_METRICS.find(m => m.id === metric)?.label} karşılaştırması</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={result.variants.map((v: any) => ({ name: `${v.label}: ${v.name.slice(0, 20)}`, value: v.value }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {result.variants.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* İstatistiksel anlamlılık */}
          {result.comparisons.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-sm font-semibold text-slate-700 mb-3">İstatistiksel Anlamlılık</div>
              <div className="space-y-3">
                {result.comparisons.map((comp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold">{comp.variant_a}</span> vs <span className="font-semibold">{comp.variant_b}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">z={comp.z_score}</span>
                      <span className="text-slate-500">p={comp.p_value}</span>
                      <span className={`font-semibold ${comp.lift_pct >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {comp.lift_pct >= 0 ? "+" : ""}{comp.lift_pct}%
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${comp.significant ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {comp.significant ? <><CheckCircle className="w-3 h-3" /> Anlamlı ({comp.confidence}%)</> : "Anlamlı değil"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cohort Analizi sekmesi ───────────────────────────────────────────────────

function CohortTab() {
  const [days, setDays] = useState(90);
  const [cohortBy, setCohortBy] = useState("week");
  const [metric, setMetric] = useState("spend");

  const { data, isLoading } = useQuery({
    queryKey: ["cohort", days, cohortBy, metric],
    queryFn: () => api.getCohortAnalysis({ days, cohortBy, metric }),
  });

  const cohorts = data?.cohorts ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4">
        {[
          { label: "Süre", value: days, onChange: (v: number) => setDays(v), options: [30, 60, 90, 180, 365], suffix: " gün" },
        ].map(({ label, value, onChange, options, suffix }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{label}</label>
            <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {options.map((o) => <option key={o} value={o}>Son {o}{suffix}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gruplama</label>
          <select value={cohortBy} onChange={(e) => setCohortBy(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="week">Haftalık</option>
            <option value="month">Aylık</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Metrik</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="spend">Harcama</option>
            <option value="impressions">Gösterim</option>
            <option value="clicks">Tıklama</option>
            <option value="ctr">CTR</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Yükleniyor...</div>
      ) : cohorts.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Veri bulunamadı.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">
            {cohortBy === "week" ? "Haftalık" : "Aylık"} {metric} dağılımı
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cohorts.map((c: any) => ({ label: c.label, total: c.total, avg: c.average }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Toplam" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="avg" name="Günlük Ort." fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Tablo */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Dönem</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Toplam</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Günlük Ort.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Gün Sayısı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cohorts.map((c: any) => (
                  <tr key={c.label} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-slate-700">{c.label}</td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-900">{c.total.toLocaleString("tr-TR")}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{c.average.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                    <td className="py-2 px-2 text-right text-slate-400">{c.days.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attribution sekmesi ──────────────────────────────────────────────────────

function AttributionTab() {
  const [model, setModel] = useState("linear");
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await api.runAttributionModel({ model, days });
      setResult(r);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const selectedModel = ATTRIBUTION_MODELS.find((m) => m.id === model);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {ATTRIBUTION_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Süre</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Son {d} gün</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Uygula
            </button>
          </div>
        </div>
        {selectedModel && (
          <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
            <span className="font-semibold">{selectedModel.label}:</span> {selectedModel.desc}
          </div>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-sm font-semibold text-slate-700 mb-1">Toplam Dönüşüm Değeri</div>
            <div className="text-3xl font-bold text-slate-900">
              ₺{result.total_conversion_value.toLocaleString("tr-TR")}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-sm font-semibold text-slate-700 mb-3">Kampanya Katkı Dağılımı</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={result.results.map((r: any) => ({
                name: r.campaign_name.slice(0, 25),
                weight: r.weight_pct,
                value: r.attributed_value,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="weight" name="Ağırlık (%)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500 uppercase">Kampanya</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Ağırlık</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Atfedilen Değer</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Atfedilen ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.results.map((r: any) => (
                  <tr key={r.campaign_id} className="hover:bg-slate-50">
                    <td className="py-2 px-4 font-medium text-slate-800 max-w-xs truncate">{r.campaign_name}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 rounded-full bg-purple-200 w-16 overflow-hidden">
                          <div className="h-full bg-purple-600 rounded-full" style={{ width: `${r.weight_pct}%` }} />
                        </div>
                        <span className="text-slate-700 font-mono text-xs">{r.weight_pct}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">₺{r.attributed_value.toLocaleString("tr-TR")}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{r.roas_attributed}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Metric sekmesi ────────────────────────────────────────────────────

function CustomMetricTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", formula: "", description: "", format: "number", unit: "" });
  const [calcResult, setCalcResult] = useState<{ metric: any; results: any[] } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["customMetrics"],
    queryFn: () => api.getCustomMetrics(),
  });

  const metrics = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.createCustomMetric(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customMetrics"] });
      setShowForm(false);
      setForm({ name: "", formula: "", description: "", format: "number", unit: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCustomMetric(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customMetrics"] }),
  });

  const calculate = async (metricId: string) => {
    setCalcLoading(true);
    try {
      const r = await api.calculateCustomMetric(metricId);
      setCalcResult(r);
    } catch (e) { alert(`Hata: ${e}`); }
    finally { setCalcLoading(false); }
  };

  const FORMULA_EXAMPLES = [
    { name: "Maliyet / Dönüşüm", formula: "spend / conversions if conversions > 0 else 0" },
    { name: "Gelir / Gösterim", formula: "conversion_value / impressions * 1000 if impressions > 0 else 0" },
    { name: "Gerçek CTR (görsel)", formula: "clicks / reach * 100 if reach > 0 else 0" },
    { name: "Kazanç Marjı (%)", formula: "(conversion_value - spend) / conversion_value * 100 if conversion_value > 0 else 0" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Mevcut metrikleri kullanarak özel formüller oluşturun ve kampanyalara uygulayın.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Yeni Formül
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Yeni Özel Metrik</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ad *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="örn. Gerçek ROAS" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Birim</label>
              <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="örn. %, ₺, x" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Formül *</label>
              <input
                value={form.formula}
                onChange={(e) => setForm((f) => ({ ...f, formula: e.target.value }))}
                placeholder="örn. spend / clicks"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                Kullanılabilir değişkenler: spend, impressions, clicks, ctr, cpc, cpm, roas, conversions, conversion_value, reach, frequency
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Örnek Formüller</label>
              <div className="flex flex-wrap gap-2">
                {FORMULA_EXAMPLES.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => setForm((f) => ({ ...f, name: f.name || ex.name, formula: ex.formula }))}
                    className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-1 rounded-lg"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.formula || createMutation.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm">İptal</button>
          </div>
        </div>
      )}

      {/* Formül listesi */}
      {metrics.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Henüz özel metrik yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((m: any) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{m.name}
                    {m.unit && <span className="text-xs text-slate-400 ml-1">({m.unit})</span>}
                  </div>
                  <code className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">{m.formula}</code>
                  {m.description && <p className="text-xs text-slate-500 mt-1">{m.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => calculate(m.id)}
                    disabled={calcLoading}
                    title="Hesapla"
                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    {calcLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { if (confirm(`"${m.name}" silinsin mi?`)) deleteMutation.mutate(m.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hesaplama sonucu */}
      {calcResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">
            "{calcResult.metric.name}" — Kampanya Sonuçları
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500 uppercase">Kampanya</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500 uppercase">
                    {calcResult.metric.name} {calcResult.metric.unit ? `(${calcResult.metric.unit})` : ""}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calcResult.results
                  .filter((r: any) => r.value !== null)
                  .sort((a: any, b: any) => b.value - a.value)
                  .map((r: any) => (
                    <tr key={r.campaign_id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-slate-700">{r.campaign_name}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">
                        {r.value?.toFixed(4)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "abtest", label: "A/B Test", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "cohort", label: "Cohort Analizi", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "attribution", label: "Attribution", icon: <GitBranch className="w-4 h-4" /> },
  { id: "custom", label: "Özel Metrik", icon: <Calculator className="w-4 h-4" /> },
];

export default function AnalyticsAdvancedPage() {
  const [tab, setTab] = useState<Tab>("abtest");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Başlık */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Gelişmiş Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          A/B test, cohort analizi, attribution modelleme ve özel metrik hesaplayıcı.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {tab === "abtest" && <ABTestTab />}
      {tab === "cohort" && <CohortTab />}
      {tab === "attribution" && <AttributionTab />}
      {tab === "custom" && <CustomMetricTab />}
    </div>
  );
}
