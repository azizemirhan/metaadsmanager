"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AutomationRule, AutomationLog } from "../lib/api";
import {
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
} from "lucide-react";

// ─── Sabit etiketler ──────────────────────────────────────────────────────────
const METRIC_LABELS: Record<string, string> = {
  ctr: "CTR (%)",
  roas: "ROAS (x)",
  spend: "Harcama (₺)",
  cpc: "CPC (₺)",
  cpm: "CPM (₺)",
  impressions: "Gösterim",
  clicks: "Tıklama",
  frequency: "Frequency",
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  pause: { label: "Duraklat", color: "text-yellow-700 bg-yellow-100", icon: "⏸" },
  resume: { label: "Başlat", color: "text-green-700 bg-green-100", icon: "▶" },
  notify: { label: "Bildirim", color: "text-blue-700 bg-blue-100", icon: "🔔" },
  budget_decrease: { label: "Bütçe ↓", color: "text-red-700 bg-red-100", icon: "📉" },
  budget_increase: { label: "Bütçe ↑", color: "text-emerald-700 bg-emerald-100", icon: "📈" },
};

const CONDITION_LABELS: Record<string, string> = {
  lt: "<",
  gt: ">",
};

// ─── Kural Oluşturma Formu ──────────────────────────────────────────────────────

interface RuleFormState {
  name: string;
  description: string;
  metric: string;
  condition: string;
  threshold: string;
  action: string;
  action_value: string;
  notify_email: string;
  notify_whatsapp: string;
  cooldown_minutes: string;
}

const DEFAULT_FORM: RuleFormState = {
  name: "",
  description: "",
  metric: "ctr",
  condition: "lt",
  threshold: "",
  action: "pause",
  action_value: "20",
  notify_email: "",
  notify_whatsapp: "",
  cooldown_minutes: "60",
};

function RuleForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (form: RuleFormState) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);
  const set = (key: keyof RuleFormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const needsActionValue =
    form.action === "budget_decrease" || form.action === "budget_increase";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 mb-5">
        Yeni Otomasyon Kuralı
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ad */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Kural Adı <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="örn. Düşük CTR → Duraklat"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Açıklama */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Açıklama
          </label>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Opsiyonel açıklama"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Metrik */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Metrik <span className="text-red-500">*</span>
          </label>
          <select
            value={form.metric}
            onChange={(e) => set("metric", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(METRIC_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Koşul */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Koşul <span className="text-red-500">*</span>
          </label>
          <select
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="lt">Küçükse (&lt;)</option>
            <option value="gt">Büyükse (&gt;)</option>
          </select>
        </div>

        {/* Eşik */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Eşik Değeri <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={form.threshold}
            onChange={(e) => set("threshold", e.target.value)}
            placeholder="örn. 1.5"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Aksiyon */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Aksiyon <span className="text-red-500">*</span>
          </label>
          <select
            value={form.action}
            onChange={(e) => set("action", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="pause">Kampanyayı Duraklat</option>
            <option value="resume">Kampanyayı Başlat</option>
            <option value="notify">Bildirim Gönder</option>
            <option value="budget_decrease">Bütçeyi Azalt (%)</option>
            <option value="budget_increase">Bütçeyi Artır (%)</option>
          </select>
        </div>

        {/* Bütçe yüzdesi */}
        {needsActionValue && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Değişim Yüzdesi (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.action_value}
              onChange={(e) => set("action_value", e.target.value)}
              placeholder="örn. 20"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* E-posta */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Bildirim E-postası
          </label>
          <input
            type="email"
            value={form.notify_email}
            onChange={(e) => set("notify_email", e.target.value)}
            placeholder="ornek@firma.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Cooldown */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Bekleme Süresi (dakika)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={form.cooldown_minutes}
            onChange={(e) => set("cooldown_minutes", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Önizleme */}
      {form.metric && form.condition && form.threshold && form.action && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
          <span className="font-semibold">Önizleme: </span>
          {METRIC_LABELS[form.metric]} {CONDITION_LABELS[form.condition]}{" "}
          <span className="font-mono">{form.threshold}</span> olduğunda →{" "}
          <span className="font-semibold">{ACTION_LABELS[form.action]?.label}</span>
          {needsActionValue && form.action_value && ` (%${form.action_value})`}
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {loading ? "Kaydediliyor..." : "Kural Oluştur"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          İptal
        </button>
      </div>
    </div>
  );
}

// ─── Kural Kartı ──────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onRun,
  onPreview,
  running,
}: {
  rule: AutomationRule;
  onToggle: () => void;
  onDelete: () => void;
  onRun: () => void;
  onPreview: () => void;
  running: boolean;
}) {
  const action = ACTION_LABELS[rule.action] ?? {
    label: rule.action,
    color: "text-slate-700 bg-slate-100",
    icon: "⚙",
  };

  return (
    <div
      className={`bg-white border rounded-xl p-5 transition-all ${
        rule.is_active
          ? "border-slate-200 shadow-sm"
          : "border-slate-100 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{rule.name}</span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${action.color}`}
            >
              {action.icon} {action.label}
              {rule.action_value && ` %${rule.action_value}`}
            </span>
            {!rule.is_active && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Pasif
              </span>
            )}
          </div>

          {rule.description && (
            <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
          )}

          {/* Koşul özeti */}
          <div className="mt-2 text-sm text-slate-600">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">
              {METRIC_LABELS[rule.metric] ?? rule.metric}{" "}
              {CONDITION_LABELS[rule.condition] ?? rule.condition}{" "}
              {rule.threshold}
            </span>
          </div>

          {/* İstatistikler */}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {rule.trigger_count} tetikleme
            </span>
            {rule.last_triggered && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(rule.last_triggered).toLocaleDateString("tr-TR")}
              </span>
            )}
            <span>{rule.cooldown_minutes} dk bekleme</span>
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPreview}
            title="Önizle (dry-run)"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onRun}
            disabled={running}
            title="Şimdi çalıştır"
            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            title={rule.is_active ? "Pasif yap" : "Aktif yap"}
            className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
          >
            <Pause className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Sil"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Tablosu ──────────────────────────────────────────────────────────────

function LogsTable({ logs }: { logs: AutomationLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        Henüz otomasyon çalıştırma geçmişi yok.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Tarih</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Kampanya</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Metrik</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Değer / Eşik</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Aksiyon</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                {new Date(log.executed_at).toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-2 px-3 font-medium text-slate-800 max-w-[180px] truncate">
                {log.campaign_name ?? log.campaign_id}
              </td>
              <td className="py-2 px-3 text-slate-600 uppercase text-xs font-mono">
                {log.metric}
              </td>
              <td className="py-2 px-3 font-mono text-slate-700">
                {log.actual_value.toFixed(3)} / {log.threshold}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    ACTION_LABELS[log.action_taken]?.color ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {ACTION_LABELS[log.action_taken]?.icon ?? "⚙"}{" "}
                  {ACTION_LABELS[log.action_taken]?.label ?? log.action_taken}
                </span>
              </td>
              <td className="py-2 px-3">
                {log.success ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle className="w-3 h-3" /> Başarılı
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-xs" title={log.error ?? ""}>
                    <AlertTriangle className="w-3 h-3" /> Hata
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [runResult, setRunResult] = useState<{ title: string; results: { message: string; success: boolean }[] } | null>(null);

  // Veri çek
  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ["automationRules"],
    queryFn: () => api.getAutomationRules(),
  });

  const { data: logsData, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["automationLogs"],
    queryFn: () => api.getAutomationLogs(undefined, 50),
    enabled: showLogs,
  });

  // Mutasyonlar
  const createMutation = useMutation({
    mutationFn: (form: RuleFormState) =>
      api.createAutomationRule({
        name: form.name,
        description: form.description || undefined,
        metric: form.metric,
        condition: form.condition,
        threshold: parseFloat(form.threshold),
        action: form.action,
        action_value: form.action_value ? parseFloat(form.action_value) : undefined,
        notify_email: form.notify_email || undefined,
        cooldown_minutes: parseInt(form.cooldown_minutes) || 60,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
      setShowForm(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (ruleId: string) => api.toggleAutomationRule(ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automationRules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => api.deleteAutomationRule(ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automationRules"] }),
  });

  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const runRule = async (ruleId: string, dryRun: boolean) => {
    setRunningIds((s) => new Set(s).add(ruleId));
    try {
      const result = await api.runAutomationRule(ruleId, dryRun);
      setRunResult({
        title: dryRun ? "Önizleme Sonucu" : "Çalıştırma Sonucu",
        results: result.results.map((r) => ({
          message: r.message,
          success: r.success,
        })),
      });
      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: ["automationRules"] });
        if (showLogs) refetchLogs();
      }
    } catch (err) {
      setRunResult({
        title: "Hata",
        results: [{ message: String(err), success: false }],
      });
    } finally {
      setRunningIds((s) => {
        const next = new Set(s);
        next.delete(ruleId);
        return next;
      });
    }
  };

  const runAll = async () => {
    try {
      const result = await api.runAllAutomationRules();
      setRunResult({
        title: `Tüm Kurallar Çalıştırıldı (${result.rules_checked} kural, ${result.total_triggered} tetikleme)`,
        results: result.results.map((r) => ({ message: r.message, success: r.success })),
      });
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
      if (showLogs) refetchLogs();
    } catch (err) {
      alert(`Hata: ${err}`);
    }
  };

  const rules = rulesData?.data ?? [];
  const logs = logsData?.data ?? [];
  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kampanya Otomasyonu</h1>
          <p className="text-sm text-slate-500 mt-1">
            Metrik eşiklerine göre kampanyaları otomatik duraklat, başlat veya bütçe ayarla.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAll}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <RefreshCw className="w-4 h-4" />
            Tümünü Çalıştır
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Yeni Kural
          </button>
        </div>
      </div>

      {/* İstatistik şeridi */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Toplam Kural", value: rules.length, color: "text-slate-900" },
          { label: "Aktif Kural", value: activeCount, color: "text-green-700" },
          {
            label: "Toplam Tetikleme",
            value: rules.reduce((s, r) => s + r.trigger_count, 0),
            color: "text-blue-700",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Yeni kural formu */}
      {showForm && (
        <div className="mb-6">
          <RuleForm
            onSubmit={(form) => createMutation.mutate(form)}
            onCancel={() => setShowForm(false)}
            loading={createMutation.isPending}
          />
          {createMutation.isError && (
            <div className="mt-2 text-sm text-red-600">
              Hata: {String(createMutation.error)}
            </div>
          )}
        </div>
      )}

      {/* Çalıştırma sonucu */}
      {runResult && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">{runResult.title}</h3>
            <button
              onClick={() => setRunResult(null)}
              className="text-slate-400 hover:text-slate-700 text-sm"
            >
              Kapat ✕
            </button>
          </div>
          {runResult.results.length === 0 ? (
            <p className="text-sm text-slate-500">Hiçbir kampanya eşiği aşmadı.</p>
          ) : (
            <ul className="space-y-1">
              {runResult.results.map((r, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${r.success ? "text-green-700" : "text-red-700"}`}>
                  {r.success ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {r.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Kural listesi */}
      {loadingRules ? (
        <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Henüz otomasyon kuralı oluşturulmadı.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-blue-600 text-sm hover:underline"
          >
            İlk kuralı oluştur →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => toggleMutation.mutate(rule.id)}
              onDelete={() => {
                if (confirm(`"${rule.name}" silinsin mi?`)) deleteMutation.mutate(rule.id);
              }}
              onRun={() => runRule(rule.id, false)}
              onPreview={() => runRule(rule.id, true)}
              running={runningIds.has(rule.id)}
            />
          ))}
        </div>
      )}

      {/* Geçmiş bölümü */}
      <div className="mt-8">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Çalıştırma Geçmişi {logsData ? `(${logsData.count})` : ""}
        </button>

        {showLogs && (
          <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingLogs ? (
              <div className="p-6 text-center text-slate-500 text-sm">Yükleniyor...</div>
            ) : (
              <LogsTable logs={logs} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
