"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ReportTemplate, SavedReport, JobStatusResponse } from "../lib/api";
import { WhatsAppSendButton } from "../components/WhatsAppSendButton";
import { useAccount } from "../components/Providers";

type JobItem = {
  jobId: string;
  reportId: string;
  reportName: string;
  jobType: "export" | "analyze";
  status: string;
  progress: number;
  resultText?: string | null;
  file_name?: string | null;
  error_message?: string | null;
};

/* Report type definitions */
type ReportType = "weekly_summary" | "campaign_comparison" | "performance_trend";
type ExportFormat = "csv" | "html";

interface ReportDef {
  key: ReportType;
  label: string;
  description: string;
  icon: string;
  csvType: string;
}

const REPORT_TYPES: ReportDef[] = [
  { key: "weekly_summary", label: "Haftalık Özet", description: "Hesap geneli harcama, gösterim, tıklama ve en iyi kampanyalar", icon: "📋", csvType: "campaigns" },
  { key: "campaign_comparison", label: "Kampanya Karşılaştırma", description: "Tüm kampanyaların metriklerini yan yana karşılaştırın", icon: "📊", csvType: "campaigns" },
  { key: "performance_trend", label: "Performans Trendi", description: "Günlük harcama, gösterim ve tıklama verisi", icon: "📈", csvType: "daily" },
];

export default function ReportsPage() {
  const { accountId } = useAccount();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [selectedReport, setSelectedReport] = useState<ReportType>("weekly_summary");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const [exportLoading, setExportLoading] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [savedReportName, setSavedReportName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedReportSuccess, setSavedReportSuccess] = useState(false);

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const jobsRef = useRef<JobItem[]>([]);
  jobsRef.current = jobs;

  const { data: templatesData, isLoading: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useQuery({
    queryKey: ["reportTemplates"],
    queryFn: api.getReportTemplates,
    refetchOnWindowFocus: false,
  });
  const { data: savedData, isLoading: savedLoading } = useQuery({ queryKey: ["savedReports"], queryFn: api.getSavedReports });

  const templates: ReportTemplate[] = Array.isArray(templatesData?.data) ? templatesData.data : [];
  const savedReports: SavedReport[] = savedData?.data ?? [];
  const selectedDef = REPORT_TYPES.find((r) => r.key === selectedReport)!;
  const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addJob = (jobId: string, reportId: string, reportName: string, jobType: "export" | "analyze") => {
    setJobs((prev) => [
      ...prev,
      { jobId, reportId, reportName, jobType, status: "pending", progress: 0 },
    ]);
  };

  const updateJob = (jobId: string, data: Partial<JobItem>) => {
    setJobs((prev) =>
      prev.map((j) => (j.jobId === jobId ? { ...j, ...data } : j))
    );
  };

  useEffect(() => {
    const poll = async () => {
      const active = jobsRef.current.filter((j) => j.status === "pending" || j.status === "running");
      for (const j of active) {
        try {
          const res: JobStatusResponse = await api.getJobStatus(j.jobId);
          setJobs((prev) =>
            prev.map((x) =>
              x.jobId === j.jobId
                ? {
                    ...x,
                    status: res.status,
                    progress: res.progress,
                    resultText: res.result_text ?? undefined,
                    file_name: res.file_name ?? undefined,
                    error_message: res.error_message ?? undefined,
                  }
                : x
            )
          );
        } catch {
          // ignore
        }
      }
    };
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, []);

  const handleStartExport = async (r: SavedReport) => {
    try {
      const res = await api.startExportJob(r.id);
      addJob(res.job_id, r.id, r.name, "export");
    } catch (e) {
      alert("İndirme başlatılamadı: " + (e instanceof Error ? e.message : "Hata"));
    }
  };

  const handleStartAnalyze = async (r: SavedReport) => {
    try {
      const res = await api.startAnalyzeJob(r.id);
      addJob(res.job_id, r.id, r.name, "analyze");
    } catch (e) {
      alert("Analiz başlatılamadı: " + (e instanceof Error ? e.message : "Hata"));
    }
  };

  const handleJobDownload = async (jobId: string) => {
    try {
      await api.getJobDownload(jobId);
    } catch {
      alert("İndirilemedi.");
    }
  };

  const handleDownload = async () => {
    setExportLoading(true);
    try {
      if (exportFormat === "csv") {
        await api.exportCsv(selectedDef.csvType, days);
      } else {
        await api.exportHtml(selectedReport, days);
      }
    } catch {
      alert("Rapor indirilemedi. Backend bağlantınızı kontrol edin.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleTemplateCsv = async () => {
    if (selectedTemplateIds.length === 0) return;
    setExportLoading(true);
    try {
      if (selectedTemplateIds.length === 1) {
        await api.exportTemplateCsv(selectedTemplateIds[0], days, accountId);
      } else {
        await api.exportTemplatesZip(selectedTemplateIds, days, accountId);
      }
    } catch {
      alert("İndirme başarısız. Backend ve Meta API bağlantısını kontrol edin.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleSaveAsReport = async () => {
    if (selectedTemplateIds.length === 0 || !savedReportName.trim()) {
      alert("En az bir şablon seçin ve rapor adı girin.");
      return;
    }
    setSaveLoading(true);
    setSavedReportSuccess(false);
    try {
      const res = await api.createSavedReport({
        name: savedReportName.trim(),
        template_ids: selectedTemplateIds,
        days,
        ad_account_id: accountId,
      });
      setSavedReportSuccess(true);
      setSavedReportName("");
      queryClient.invalidateQueries({ queryKey: ["savedReports"] });

      const reportId = res?.id;
      if (reportId) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const writeRes = await api.writeSavedReportCsvToDisk(reportId);
          if (writeRes?.written !== undefined && writeRes.written > 0) {
            setSavedReportSuccess(true);
          }
          if (writeRes?.errors?.length) {
            alert(
              `Rapor kaydedildi. CSV'lerin bir kısmı yazılamadı (Meta API):\n${writeRes.errors.slice(0, 3).join("\n")}${writeRes.errors.length > 3 ? "\n..." : ""}`
            );
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
          alert(`Rapor kaydedildi ancak CSV dosyaları backend/data/reports klasörüne yazılamadı: ${msg}`);
        }
      }
      setTimeout(() => setSavedReportSuccess(false), 5000);
    } catch (e) {
      alert("Kaydedilemedi: " + (e instanceof Error ? e.message : "Bilinmeyen hata"));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!emailAddr) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      await api.sendReport(emailAddr, days, true);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch {
      setEmailError("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sol panel: Arka plan işleri */}
      <aside className="w-72 shrink-0 space-y-4">
        <div className="card p-4 sticky top-4">
          <h2 className="text-sm font-bold text-slate-900 mb-2">İşlemler</h2>
          <p className="text-xs text-slate-500 mb-3">CSV indir veya AI analiz başlatınca burada ilerleme görünür.</p>
          {jobs.length === 0 ? (
            <p className="text-xs text-slate-400">Henüz işlem yok.</p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((j) => (
                <li key={j.jobId} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="text-xs font-medium text-slate-700 truncate" title={j.reportName}>
                    {j.reportName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {j.jobType === "export" ? "CSV İndir" : "AI Analiz"}
                  </div>
                  {(j.status === "pending" || j.status === "running") && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all duration-300"
                          style={{ width: `${j.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{j.progress}%</div>
                    </div>
                  )}
                  {j.status === "failed" && (
                    <p className="text-xs text-red-600 mt-2">{j.error_message || "Hata"}</p>
                  )}
                  {j.status === "completed" && j.jobType === "export" && (
                    <button
                      type="button"
                      onClick={() => handleJobDownload(j.jobId)}
                      className="mt-2 btn-primary text-xs w-full"
                    >
                      İndir
                    </button>
                  )}
                  {j.status === "completed" && j.jobType === "analyze" && j.resultText && (
                    <details className="mt-2">
                      <summary className="text-xs text-primary-600 cursor-pointer hover:underline">Sonucu gör</summary>
                      <div className="mt-2 text-xs text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap border border-slate-100 rounded p-2">
                        {j.resultText}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Raporlar</h1>
        <p className="text-slate-500 text-sm">Rapor türü seçin, indirin veya e-posta ile gönderin</p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 mb-6 w-fit">
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              days === d 
                ? "bg-primary-600 text-white shadow-sm" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Son {d} gün
          </button>
        ))}
      </div>

      {/* Hazır Rapor Şablonları */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Hazır Rapor Şablonları</h2>
        <p className="text-sm text-slate-500 mb-4">Şablon seçin, tarih aralığını belirleyin ve CSV indirin veya hazır rapor olarak kaydedin.</p>

        {templatesLoading ? (
          <p className="text-sm text-slate-500 py-4">Şablonlar yükleniyor…</p>
        ) : templatesError ? (
          <div className="py-4">
            <p className="text-sm text-red-600 mb-2">Şablonlar yüklenemedi. Backend API&apos;nin çalıştığından emin olun.</p>
            <button type="button" onClick={() => refetchTemplates()} className="btn-outline text-sm">
              Tekrar dene
            </button>
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Şablon listesi boş. Backend /api/reports/templates yanıtını kontrol edin.</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto mb-5 pr-1">
          {templates.map((t) => {
            const isSelected = selectedTemplateIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTemplate(t.id)}
                className={`relative text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs">✓</span>
                )}
                <span className="text-sm font-medium text-slate-900 line-clamp-2">{t.title}</span>
                <span className="text-xs text-slate-500 mt-1 block">Kırılım: {t.breakdown}</span>
              </button>
            );
          })}
        </div>
        )}

        {selectedTemplateIds.length > 0 && (
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{selectedTemplateIds.length} şablon</strong> seçili — Son {days} gün
              {selectedTemplates.length > 0 && (
                <span className="text-slate-500 font-normal ml-1">
                  ({selectedTemplates.map((t) => t.title).slice(0, 2).join(", ")}
                  {selectedTemplates.length > 2 ? "…" : ""})
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTemplateCsv}
                disabled={exportLoading}
                className="btn-primary"
              >
                {exportLoading ? "İndiriliyor…" : selectedTemplateIds.length === 1 ? "CSV İndir" : "CSV’leri ZIP Olarak İndir"}
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Rapor adı (örn: Ocak Kampanya Analizi)"
                  value={savedReportName}
                  onChange={(e) => setSavedReportName(e.target.value)}
                  className="input w-64"
                />
                <button
                  type="button"
                  onClick={handleSaveAsReport}
                  disabled={saveLoading || !savedReportName.trim()}
                  className="btn-primary"
                >
                  {saveLoading ? "Kaydediliyor…" : "Hazır Rapor Olarak Kaydet"}
                </button>
              </div>
            </div>
            {savedReportSuccess && <p className="text-sm text-green-600">Rapor kaydedildi.</p>}
          </div>
        )}
      </div>

      {/* Kayıtlı Raporlarım */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Kayıtlı Raporlarım</h2>
        <p className="text-sm text-slate-500 mb-4">Kaydettiğiniz raporları CSV olarak indirin veya AI ile analiz ettirin.</p>
        {savedLoading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : savedReports.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz kayıtlı rapor yok. Yukarıdan bir şablon seçip &quot;Hazır Rapor Olarak Kaydet&quot; ile kaydedebilirsiniz.</p>
        ) : (
          <ul className="space-y-2">
            {savedReports.map((r) => {
              const ids = r.template_ids ?? (r.template_id ? [r.template_id] : []);
              const firstT = templates.find((x) => x.id === ids[0]);
              const label = ids.length > 1 ? `${ids.length} şablon` : (firstT?.title ?? ids[0] ?? "Rapor");
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <span className="text-slate-500 text-sm ml-2">— {label} · Son {r.days} gün</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartExport(r)}
                      className="btn-outline text-sm"
                    >
                      CSV İndir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartAnalyze(r)}
                      className="btn-primary text-sm"
                    >
                      AI&apos;da Analiz Et
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm("Bu raporu silmek istediğinize emin misiniz?")) {
                          await api.deleteSavedReport(r.id);
                          queryClient.invalidateQueries({ queryKey: ["savedReports"] });
                        }
                      }}
                      className="text-slate-500 hover:text-red-600 text-sm"
                    >
                      Sil
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Report type selector (legacy) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {REPORT_TYPES.map((rt) => {
          const active = selectedReport === rt.key;
          return (
            <div
              key={rt.key}
              onClick={() => setSelectedReport(rt.key)}
              className={`card p-5 cursor-pointer transition-all ${
                active ? "ring-2 ring-primary-500 ring-offset-2" : ""
              }`}
            >
              <div className="text-3xl mb-3">{rt.icon}</div>
              <div className="text-sm font-bold text-slate-900 mb-1">
                {rt.label}
              </div>
              <div className="text-xs text-slate-500 leading-relaxed">
                {rt.description}
              </div>
              {active && (
                <div className="mt-3 w-2 h-2 rounded-full bg-primary-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Download section */}
      <div className="card p-6 mb-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Raporu İndir
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          <strong>{selectedDef.label}</strong> raporunu son {days} gün için indirin.
        </p>

        {/* Format selector */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="text-sm text-slate-600">Format:</span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["html", "csv"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase transition-all ${
                  exportFormat === fmt 
                    ? "bg-primary-600 text-white" 
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {exportFormat === "html" ? "Görüntülenebilir HTML" : "Elektronik tablo uyumlu CSV"}
          </span>
        </div>

        {/* Download button */}
        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleDownload}
          disabled={exportLoading}
        >
          {exportLoading ? (
            <LoadingIcon className="w-4 h-4 animate-spin" />
          ) : (
            <DownloadIcon className="w-4 h-4" />
          )}
          {exportLoading ? "Hazırlanıyor..." : `Raporu İndir (${exportFormat.toUpperCase()})`}
        </button>
      </div>

      {/* Quick CSV exports */}
      <div className="card p-6 mb-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Hızlı CSV İndirme
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Ham verileri CSV olarak indirin (son {days} gün).
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { type: "campaigns", label: "Kampanyalar" },
            { type: "adsets", label: "Reklam Setleri" },
            { type: "ads", label: "Reklamlar" },
            { type: "daily", label: "Günlük Veri" },
          ] as const).map((item) => (
            <button
              key={item.type}
              className="btn-outline text-sm"
              onClick={() => { 
                setExportLoading(true); 
                api.exportCsv(item.type, days).finally(() => setExportLoading(false)); 
              }}
              disabled={exportLoading}
            >
              {item.label} CSV
            </button>
          ))}
        </div>
      </div>

      {/* Email section */}
      <div className="card p-6 mb-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          E-posta ile Gönder
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          AI analizi ve CSV eki ile raporu e-posta adresine gönderin (son {days} gün).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={emailAddr}
            onChange={(e) => setEmailAddr(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendReport(); }}
            className="input flex-1 min-w-[240px]"
          />
          <button 
            className="btn-primary flex items-center gap-2"
            onClick={handleSendReport} 
            disabled={!emailAddr || emailLoading}
          >
            {emailLoading ? (
              <LoadingIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SendIcon className="w-4 h-4" />
            )}
            {emailLoading ? "Gönderiliyor..." : "Raporu Gönder"}
          </button>
        </div>
        {emailSent && (
          <div className="alert alert-success mt-4">
            <CheckIcon className="w-4 h-4" />
            Rapor {emailAddr} adresine gönderildi.
          </div>
        )}
        {emailError && (
          <div className="alert alert-error mt-4">
            <AlertIcon className="w-4 h-4" />
            {emailError}
          </div>
        )}
      </div>

      {/* WhatsApp section */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <WhatsAppIcon className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">WhatsApp ile Gönder</h2>
            <p className="text-sm text-slate-500">Özet raporu doğrudan WhatsApp'a mesaj olarak gönderin</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WhatsAppSendButton 
            periodDays={days} 
            variant="report" 
            buttonText={`Son ${days} günü WhatsApp'a gönder`}
          />
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Daha fazla AI analiz ve öneri için{" "}
        <Link href="/ai-insights" className="text-primary-600 hover:text-primary-700 font-medium">
          AI Analiz
        </Link>{" "}
        sayfasına gidin.
      </p>
      </div>
    </div>
  );
}

// Icons
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
