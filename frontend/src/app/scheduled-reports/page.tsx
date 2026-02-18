"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ScheduledReport } from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { useAccount } from "../components/Providers";

// Icons
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Labels
const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

const DAYS_OF_WEEK = [
  "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"
];

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily_summary: "Günlük Özet",
  weekly_summary: "Haftalık Özet",
  campaign_list: "Kampanya Listesi",
  performance: "Performans Analizi",
};

export default function ScheduledReportsPage() {
  const { accountId } = useAccount();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    report_type: "weekly_summary",
    days: 7,
    frequency: "weekly",
    day_of_week: 1, // Pazartesi
    day_of_month: 1,
    hour: 9,
    minute: 0,
    channels: ["email"],
    email_to: "",
    whatsapp_to: "",
  });

  // Queries
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["scheduled-reports", accountId],
    queryFn: () => api.getScheduledReports(accountId),
  });

  const { data: metadata } = useQuery({
    queryKey: ["scheduled-reports-metadata"],
    queryFn: () => api.getScheduledReportMetadata(),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["scheduled-report-logs", selectedReport?.id],
    queryFn: () => api.getScheduledReportLogs(selectedReport!.id, 20),
    enabled: !!selectedReport && showLogsModal,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: api.createScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: api.toggleScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: api.runScheduledReportNow,
  });

  const reports = reportsData?.data || [];
  const logs = logsData?.data || [];

  function resetForm() {
    setFormData({
      name: "",
      report_type: "weekly_summary",
      days: 7,
      frequency: "weekly",
      day_of_week: 1,
      day_of_month: 1,
      hour: 9,
      minute: 0,
      channels: ["email"],
      email_to: "",
      whatsapp_to: "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      ad_account_id: accountId,
    });
  }

  function formatSchedule(report: ScheduledReport): string {
    const time = `${String(report.hour).padStart(2, "0")}:${String(report.minute).padStart(2, "0")}`;
    
    if (report.frequency === "daily") {
      return `Her gün ${time}`;
    } else if (report.frequency === "weekly" && report.day_of_week !== undefined) {
      return `Her ${DAYS_OF_WEEK[report.day_of_week]} ${time}`;
    } else if (report.frequency === "monthly" && report.day_of_month) {
      return `Her ayın ${report.day_of_month}'inde ${time}`;
    }
    return "Belirtilmemiş";
  }

  function formatNextRun(dateStr?: string): string {
    if (!dateStr) return "Hesaplanmadı";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return "Şimdi";
    if (diff < 3600000) return `${Math.ceil(diff / 60000)} dk içinde`;
    if (diff < 86400000) return `${Math.ceil(diff / 3600000)} saat içinde`;
    return date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-primary-600" />
            Zamanlanmış Raporlar
          </h1>
          <p className="text-slate-500 text-sm">
            Otomatik periyodik raporlar oluştur ve planla
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Yeni Rapor Planı
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Toplam Plan"
          value={String(reports.length)}
          icon="📋"
          color="#2563eb"
        />
        <MetricCard
          label="Aktif Plan"
          value={String(reports.filter((r) => r.is_active).length)}
          icon="🟢"
          color="#10b981"
        />
        <MetricCard
          label="Bu Hafta Çalışan"
          value={String(reports.filter((r) => r.run_count > 0).length)}
          icon="⚡"
          color="#f59e0b"
        />
        <MetricCard
          label="Toplam Gönderim"
          value={String(reports.reduce((acc, r) => acc + r.run_count, 0))}
          icon="📊"
          color="#8b5cf6"
        />
      </div>

      {/* Reports Grid */}
      {reportsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 skeleton h-72" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Henüz zamanlanmış rapor yok</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Her Pazartesi sabah haftalık rapor veya her gün özet gibi otomatik raporlar planlayın.
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            İlk Rapor Planını Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`card p-6 transition-all ${
                report.is_active ? "border-l-4 border-l-success-500" : "border-l-4 border-l-slate-300 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{report.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {report.channels.includes("email") && (
                    <MailIcon className="w-4 h-4 text-slate-400" />
                  )}
                  {report.channels.includes("whatsapp") && (
                    <WhatsAppIcon className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <ClockIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{formatSchedule(report)}</span>
                </div>
                
                {report.is_active && report.next_run_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                    <span className="text-success-600 font-medium">
                      Sonraki: {formatNextRun(report.next_run_at)}
                    </span>
                  </div>
                )}

                {report.last_run_at && (
                  <div className="text-xs text-slate-500">
                    Son çalışma: {new Date(report.last_run_at).toLocaleString("tr-TR")}
                  </div>
                )}

                {report.run_count > 0 && (
                  <div className="text-xs text-slate-500">
                    Toplam {report.run_count} kez çalıştırıldı
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleMutation.mutate(report.id)}
                  disabled={toggleMutation.isPending}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    report.is_active
                      ? "bg-warning-50 text-warning-700 hover:bg-warning-100"
                      : "bg-success-50 text-success-700 hover:bg-success-100"
                  }`}
                >
                  {report.is_active ? "Durdur" : "Başlat"}
                </button>
                <button
                  onClick={() => runNowMutation.mutate(report.id)}
                  disabled={runNowMutation.isPending}
                  className="py-2 px-3 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                  title="Şimdi Çalıştır"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedReport(report);
                    setShowLogsModal(true);
                  }}
                  className="py-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  title="Geçmiş"
                >
                  <HistoryIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(report.id)}
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
              <h2 className="text-xl font-bold text-slate-900">Yeni Zamanlanmış Rapor</h2>
              <p className="text-slate-500 text-sm mt-1">
                Belirli aralıklarla otomatik rapor alın
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rapor Adı
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Haftalık Pazartesi Raporu"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rapor Tipi
                </label>
                <select
                  value={formData.report_type}
                  onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                  className="input w-full"
                >
                  <option value="daily_summary">Günlük Özet</option>
                  <option value="weekly_summary">Haftalık Özet</option>
                  <option value="campaign_list">Kampanya Listesi</option>
                  <option value="performance">Performans Analizi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Periyot (Son kaç gün)
                </label>
                <select
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) })}
                  className="input w-full"
                >
                  <option value={1}>Son 1 gün</option>
                  <option value={7}>Son 7 gün</option>
                  <option value={14}>Son 14 gün</option>
                  <option value={30}>Son 30 gün</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sıklık
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => {
                    const freq = e.target.value;
                    setFormData({
                      ...formData,
                      frequency: freq,
                      day_of_week: freq === "weekly" ? 1 : 1,
                      day_of_month: freq === "monthly" ? 1 : 1,
                    });
                  }}
                  className="input w-full"
                >
                  <option value="daily">Günlük</option>
                  <option value="weekly">Haftalık</option>
                  <option value="monthly">Aylık</option>
                </select>
              </div>

              {formData.frequency === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gün
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.frequency === "monthly" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ayın Günü
                  </label>
                  <select
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Saat
                  </label>
                  <select
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dakika
                  </label>
                  <select
                    value={formData.minute}
                    onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) })}
                    className="input w-full"
                  >
                    <option value={0}>00</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={45}>45</option>
                  </select>
                </div>
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
                  {createMutation.isPending ? "Oluşturuluyor..." : "Plan Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Rapor Geçmişi</h2>
                <p className="text-sm text-slate-500">{selectedReport.name}</p>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {logsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Henüz çalışma kaydı yok
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border ${
                        log.status === "success"
                          ? "bg-success-50 border-success-200"
                          : log.status === "failed"
                          ? "bg-danger-50 border-danger-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.status === "success"
                                ? "bg-success-500"
                                : log.status === "failed"
                                ? "bg-danger-500"
                                : "bg-slate-400"
                            }`}
                          />
                          <span className="font-medium text-slate-900">
                            {log.status === "success" ? "Başarılı" : log.status === "failed" ? "Başarısız" : "Çalışıyor"}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {new Date(log.started_at).toLocaleString("tr-TR")}
                        </span>
                      </div>
                      
                      {log.summary_data && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="text-slate-600">
                            💰 Harcama: ₺{log.summary_data.total_spend?.toLocaleString("tr-TR")}
                          </div>
                          <div className="text-slate-600">
                            👁️ Gösterim: {log.summary_data.total_impressions?.toLocaleString("tr-TR")}
                          </div>
                        </div>
                      )}
                      
                      {log.error_message && (
                        <p className="mt-2 text-sm text-danger-600">{log.error_message}</p>
                      )}
                      
                      <div className="mt-2 flex gap-1">
                        {log.channels_sent?.includes("email") && (
                          <MailIcon className="w-4 h-4 text-slate-400" />
                        )}
                        {log.channels_sent?.includes("whatsapp") && (
                          <WhatsAppIcon className="w-4 h-4 text-green-500" />
                        )}
                      </div>
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
