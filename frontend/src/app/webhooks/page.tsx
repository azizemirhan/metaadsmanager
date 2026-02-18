"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MetricCard } from "../components/MetricCard";

// Icons
function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

export default function WebhooksPage() {
  const [showTestModal, setShowTestModal] = useState(false);
  const [testConfig, setTestConfig] = useState({
    object_type: "campaigns",
    object_id: "campaign_123456",
    field: "status",
    new_value: "PAUSED",
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ["webhook-config"],
    queryFn: () => api.getWebhookConfig(),
  });

  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["webhook-events"],
    queryFn: () => api.getWebhookEvents(20),
    refetchInterval: 30000, // 30 saniyede bir otomatik yenile
  });

  const testMutation = useMutation({
    mutationFn: api.testWebhookDelivery,
    onSuccess: () => {
      setShowTestModal(false);
      setTimeout(() => refetchEvents(), 1000);
    },
  });

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleTestSubmit(e: React.FormEvent) {
    e.preventDefault();
    testMutation.mutate(testConfig);
  }

  const isConfigured = configData?.is_configured;
  const events = eventsData?.events || [];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <WebhookIcon className="w-7 h-7 text-primary-600" />
            Meta Webhook Entegrasyonu
          </h1>
          <p className="text-slate-500 text-sm">
            Gerçek zamanlı kampanya güncellemeleri ve olay bildirimleri
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="btn-outline flex items-center gap-2"
          >
            <PlayIcon className="w-4 h-4" />
            Test Et
          </button>
          <button
            onClick={() => {
              refetchConfig();
              refetchEvents();
            }}
            className="btn-outline flex items-center gap-2"
          >
            <RefreshIcon className="w-4 h-4" />
            Yenile
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {configLoading ? (
        <div className="skeleton h-16 mb-6" />
      ) : isConfigured ? (
        <div className="bg-success-50 border border-success-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
            <CheckIcon className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <p className="font-semibold text-success-800">Webhook yapılandırması tamamlandı</p>
            <p className="text-sm text-success-600">Meta'dan gerçek zamanlı güncellemeler almaya hazır</p>
          </div>
        </div>
      ) : (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
            <AlertIcon className="w-5 h-5 text-warning-600" />
          </div>
          <div>
            <p className="font-semibold text-warning-800">Yapılandırma gerekli</p>
            <p className="text-sm text-warning-600">Aşağıdaki adımları tamamlayarak webhook'u etkinleştirin</p>
          </div>
        </div>
      )}

      {/* Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Configuration Card */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">1</span>
            Webhook URL
          </h2>
          <p className="text-slate-600 text-sm mb-4">
            Bu URL'yi Meta Developers Console'da webhook olarak kaydedin.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Callback URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 break-all">
                  {configData?.webhook_url || "https://your-domain.com/api/webhooks/meta"}
                </code>
                <button
                  onClick={() => copyToClipboard(configData?.webhook_url || "", "url")}
                  className="p-2 text-slate-500 hover:text-primary-600 transition-colors"
                  title="Kopyala"
                >
                  {copiedField === "url" ? (
                    <CheckIcon className="w-5 h-5 text-success-600" />
                  ) : (
                    <CopyIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Verify Token</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700">
                  {configData?.verify_token ? "***" + configData.verify_token.slice(-4) : "Tanımlı değil"}
                </code>
                <button
                  onClick={() => copyToClipboard(configData?.verify_token?.replace("***", "") || "", "token")}
                  className="p-2 text-slate-500 hover:text-primary-600 transition-colors"
                  title="Kopyala"
                >
                  {copiedField === "token" ? (
                    <CheckIcon className="w-5 h-5 text-success-600" />
                  ) : (
                    <CopyIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600">
              <strong>Environment Variables:</strong>
            </p>
            <code className="text-xs text-slate-500 block mt-1">
              META_WEBHOOK_VERIFY_TOKEN=your_secret_token<br />
              META_APP_SECRET=your_app_secret<br />
              WEBHOOK_BASE_URL=https://your-domain.com
            </code>
          </div>
        </div>

        {/* Supported Events Card */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">2</span>
            Desteklenen Olaylar
          </h2>
          <p className="text-slate-600 text-sm mb-4">
            Meta üzerinden takip edilen nesne ve alanlar.
          </p>

          <div className="space-y-3">
            {[
              { type: "Kampanyalar", fields: ["status", "name", "objective", "bütçe"], icon: "📢" },
              { type: "Reklam Setleri", fields: ["status", "name", "targeting", "bütçe", "teklif"], icon: "🎯" },
              { type: "Reklamlar", fields: ["status", "name", "kreatif", "inceleme"], icon: "📝" },
            ].map((item) => (
              <div key={item.type} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="font-medium text-slate-900">{item.type}</p>
                  <p className="text-xs text-slate-500">{item.fields.join(" • ")}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-primary-50 border border-primary-100 rounded-lg">
            <p className="text-sm text-primary-700">
              <strong>💡 İpucu:</strong> Kampanya duraklatıldığında, bütçe güncellendiğinde veya reklam reddedildiğinde anlık bildirim alırsınız.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Son Webhook Olayları</h2>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            Canlı
          </div>
        </div>

        {eventsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <WebhookIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p>Henüz webhook olayı alınmadı</p>
            <p className="text-sm mt-1">Meta'dan ilk olay geldiğinde burada görünecek</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <WebhookIcon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {event.object_type === "campaigns" && "📢 Kampanya"}
                      {event.object_type === "adsets" && "🎯 Reklam Seti"}
                      {event.object_type === "ads" && "📝 Reklam"}
                      {event.object_type === "ad_account" && "🏢 Hesap"}
                      {!event.object_type && "Bilinmeyen"}
                    </span>
                    <span className="text-slate-400">•</span>
                    <code className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                      {event.object_id}
                    </code>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    <span className="font-medium">{event.field}</span> alanı güncellendi
                    {(event.value as any)?.status && (
                      <span className="ml-2 px-2 py-0.5 bg-white rounded text-xs border">
                        Yeni durum: {String((event.value as any).status)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(event.time).toLocaleString("tr-TR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Webhook Testi</h2>
              <p className="text-slate-500 text-sm mt-1">
                Simüle edilmiş bir webhook olayı gönder
              </p>
            </div>
            <form onSubmit={handleTestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nesne Tipi
                </label>
                <select
                  value={testConfig.object_type}
                  onChange={(e) => setTestConfig({ ...testConfig, object_type: e.target.value })}
                  className="input w-full"
                >
                  <option value="campaigns">Kampanya</option>
                  <option value="adsets">Reklam Seti</option>
                  <option value="ads">Reklam</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nesne ID
                </label>
                <input
                  type="text"
                  value={testConfig.object_id}
                  onChange={(e) => setTestConfig({ ...testConfig, object_id: e.target.value })}
                  className="input w-full"
                  placeholder="campaign_123456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Alan
                  </label>
                  <select
                    value={testConfig.field}
                    onChange={(e) => setTestConfig({ ...testConfig, field: e.target.value })}
                    className="input w-full"
                  >
                    <option value="status">Durum</option>
                    <option value="name">İsim</option>
                    <option value="daily_budget">Günlük Bütçe</option>
                    <option value="lifetime_budget">Toplam Bütçe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Yeni Değer
                  </label>
                  <select
                    value={testConfig.new_value}
                    onChange={(e) => setTestConfig({ ...testConfig, new_value: e.target.value })}
                    className="input w-full"
                  >
                    <option value="PAUSED">PAUSED</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={testMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {testMutation.isPending ? "Gönderiliyor..." : "Test Et"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
