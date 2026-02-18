"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AlertRule, AlertHistoryItem } from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { useAccount } from "../components/Providers";

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

// Metric labels
const METRIC_LABELS: Record<string, string> = {
  ctr: "CTR",
  roas: "ROAS",
  spend: "Harcama",
  cpc: "CPC",
  cpm: "CPM",
  impressions: "Gösterim",
  clicks: "Tıklama",
  frequency: "Frequency",
};

const CONDITION_LABELS: Record<string, string> = {
  lt: "< Küçükse",
  gt: "> Büyükse",
  change_pct: "% Değişim",
};

export default function AlertsPage() {
  const { accountId } = useAccount();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    metric: "ctr",
    condition: "lt",
    threshold: 1,
    channels: ["email"],
    email_to: "",
    whatsapp_to: "",
    cooldown_minutes: 60,
  });

  // Queries
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["alert-rules", accountId],
    queryFn: () => api.getAlertRules(accountId),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["alert-history"],
    queryFn: () => api.getAlertHistory(undefined, 20),
    enabled: showHistoryModal,
  });

  const { data: metricsData } = useQuery({
    queryKey: ["alert-metrics"],
    queryFn: () => api.getAlertMetrics(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: api.createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: api.toggleAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (ruleId: string) => api.testAlertRule(ruleId, 7),
    onSuccess: (data) => {
      setTestResults(data.results || []);
      setShowTestModal(true);
    },
  });

  const checkAllMutation = useMutation({
    mutationFn: () => api.checkAllAlerts(accountId),
  });

  const rules = rulesData?.data || [];
  const history = historyData?.data || [];

  function resetForm() {
    setFormData({
      name: "",
      metric: "ctr",
      condition: "lt",
      threshold: 1,
      channels: ["email"],
      email_to: "",
      whatsapp_to: "",
      cooldown_minutes: 60,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      ad_account_id: accountId,
    });
  }

  function formatMetricValue(metric: string, value: number): string {
    if (metric === "ctr") return `%${value.toFixed(2)}`;
    if (metric === "roas") return `${value.toFixed(2)}x`;
    if (["spend", "cpc", "cpm"].includes(metric)) return `₺${value.toLocaleString("tr-TR")}`;
    return value.toLocaleString("tr-TR");
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <BellIcon className="w-7 h-7 text-primary-600" />
            Akıllı Uyarı Sistemi
          </h1>
          <p className="text-slate-500 text-sm">
            Kampanya metriklerini otomatik izle, anlık bildirim al
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => checkAllMutation.mutate()}
            disabled={checkAllMutation.isPending}
            className="btn-outline flex items-center gap-2"
          >
            <PlayIcon className="w-4 h-4" />
            {checkAllMutation.isPending ? "Kontrol ediliyor..." : "Tümünü Kontrol Et"}
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn-outline flex items-center gap-2"
          >
            <HistoryIcon className="w-4 h-4" />
            Geçmiş
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Yeni Kural
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Toplam Kural"
          value={String(rules.length)}
          icon="📋"
          color="#2563eb"
        />
        <MetricCard
          label="Aktif Kural"
          value={String(rules.filter((r) => r.is_active).length)}
          icon="🟢"
          color="#10b981"
        />
        <MetricCard
          label="Bugün Tetiklenen"
          value={String(history.filter((h) => {
            const today = new Date().toISOString().split("T")[0];
            return h.sent_at.startsWith(today);
          }).length)}
          icon="🔔"
          color="#f59e0b"
        />
        <MetricCard
          label="Toplam Tetiklenme"
          value={String(rules.reduce((acc, r) => acc + r.trigger_count, 0))}
          icon="📊"
          color="#8b5cf6"
        />
      </div>

      {/* Rules Grid */}
      {rulesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 skeleton h-64" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="card p-12 text-center">
          <BellIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Henüz uyarı kuralı yok</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            CTR, ROAS, harcama gibi metrikleri izlemek için ilk uyarı kuralınızı oluşturun.
            Sistem otomatik olarak kontrol edip size bildirecek.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            İlk Kuralı Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`card p-6 transition-all ${
                rule.is_active ? "border-l-4 border-l-success-500" : "border-l-4 border-l-slate-300 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {rule.is_active ? "🟢 Aktif" : "⚪ Pasif"} • {rule.cooldown_minutes} dk bekleme
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {rule.channels.includes("email") && (
                    <MailIcon className="w-4 h-4 text-slate-400" />
                  )}
                  {rule.channels.includes("whatsapp") && (
                    <WhatsAppIcon className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{METRIC_LABELS[rule.metric]}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {CONDITION_LABELS[rule.condition]} {formatMetricValue(rule.metric, rule.threshold)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-4 space-y-1">
                {rule.email_to && (
                  <div className="flex items-center gap-2">
                    <MailIcon className="w-3 h-3" />
                    {rule.email_to}
                  </div>
                )}
                {rule.whatsapp_to && (
                  <div className="flex items-center gap-2">
                    <WhatsAppIcon className="w-3 h-3" />
                    {rule.whatsapp_to}
                  </div>
                )}
                {rule.last_triggered && (
                  <div className="text-amber-600">
                    Son tetiklenme: {new Date(rule.last_triggered).toLocaleString("tr-TR")}
                  </div>
                )}
                {rule.trigger_count > 0 && (
                  <div>Toplam tetiklenme: {rule.trigger_count}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleMutation.mutate(rule.id)}
                  disabled={toggleMutation.isPending}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    rule.is_active
                      ? "bg-warning-50 text-warning-700 hover:bg-warning-100"
                      : "bg-success-50 text-success-700 hover:bg-success-100"
                  }`}
                >
                  {rule.is_active ? "Durdur" : "Başlat"}
                </button>
                <button
                  onClick={() => testMutation.mutate(rule.id)}
                  disabled={testMutation.isPending}
                  className="py-2 px-3 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                  title="Test Et"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(rule.id)}
                  disabled={deleteMutation.isPending}
                  className="py-2 px-3 bg-danger-50 text-danger-700 rounded-lg text-sm font-medium hover:bg-danger-100 transition-colors"
                  title="Sil"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Yeni Uyarı Kuralı</h2>
              <p className="text-slate-500 text-sm mt-1">
                Belirli bir metrik eşiği aştığında otomatik bildirim al
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kural Adı
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Düşük CTR Uyarısı"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Metrik
                  </label>
                  <select
                    value={formData.metric}
                    onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                    className="input w-full"
                  >
                    {metricsData?.metrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    )) || (
                      <>
                        <option value="ctr">CTR</option>
                        <option value="roas">ROAS</option>
                        <option value="spend">Harcama</option>
                        <option value="cpc">CPC</option>
                        <option value="cpm">CPM</option>
                        <option value="frequency">Frequency</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Koşul
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="input w-full"
                  >
                    <option value="lt">Küçükse (&lt;)</option>
                    <option value="gt">Büyükse (&gt;)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Eşik Değeri
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  className="input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {formData.metric === "ctr" && "Örnek: 1 = %1"}
                  {formData.metric === "roas" && "Örnek: 2 = 2x ROAS"}
                  {["spend", "cpc", "cpm"].includes(formData.metric) && "Örnek: 500 = ₺500"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bildirim Kanalları
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes("email")}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...formData.channels, "email"]
                          : formData.channels.filter((c) => c !== "email");
                        setFormData({ ...formData, channels });
                      }}
                      className="w-4 h-4 text-primary-600 rounded border-slate-300"
                    />
                    <MailIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">E-posta</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes("whatsapp")}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...formData.channels, "whatsapp"]
                          : formData.channels.filter((c) => c !== "whatsapp");
                        setFormData({ ...formData, channels });
                      }}
                      className="w-4 h-4 text-primary-600 rounded border-slate-300"
                    />
                    <WhatsAppIcon className="w-4 h-4 text-green-500" />
                    <span className="text-sm">WhatsApp</span>
                  </label>
                </div>
              </div>

              {formData.channels.includes("email") && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    value={formData.email_to}
                    onChange={(e) => setFormData({ ...formData, email_to: e.target.value })}
                    placeholder="ornek@email.com"
                    className="input w-full"
                  />
                </div>
              )}

              {formData.channels.includes("whatsapp") && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    WhatsApp Numarası
                  </label>
                  <input
                    type="tel"
                    value={formData.whatsapp_to}
                    onChange={(e) => setFormData({ ...formData, whatsapp_to: e.target.value })}
                    placeholder="905551234567"
                    className="input w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bekleme Süresi (dakika)
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.cooldown_minutes}
                  onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) })}
                  className="input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Aynı kuralın tekrar tetiklenmesi için beklenecek süre
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Oluşturuluyor..." : "Kural Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Uyarı Geçmişi</h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Henüz tetiklenmiş uyarı yok
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.campaign_name || "Bilinmeyen Kampanya"}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            {METRIC_LABELS[item.metric]}: {formatMetricValue(item.metric, item.actual_value)}
                            {" "}(eşik: {formatMetricValue(item.metric, item.threshold)})
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(item.sent_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {item.channels_sent.includes("email") && (
                            <MailIcon className="w-4 h-4 text-slate-400" />
                          )}
                          {item.channels_sent.includes("whatsapp") && (
                            <WhatsAppIcon className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Results Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Test Sonuçları</h2>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {testResults.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-slate-600">Hiçbir kampanya eşiği aşmadı.</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Kurallarınız şu an için normal çalışıyor.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    {testResults.length} kampanya uyarı kriterlerini karşılıyor:
                  </p>
                  {testResults.map((result, idx) => (
                    <div key={idx} className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-danger-600 font-semibold">🚨 Uyarı</span>
                      </div>
                      <p className="font-medium text-slate-900">{result.campaign_name}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {METRIC_LABELS[result.metric]}: {formatMetricValue(result.metric, result.actual_value)}
                        {" "}(eşik: {formatMetricValue(result.metric, result.threshold)})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
