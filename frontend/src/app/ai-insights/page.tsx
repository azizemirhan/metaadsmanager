"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, AnomalyAlert } from "../lib/api";
import { useAccount } from "../components/Providers";
import { WhatsAppSendButton } from "../components/WhatsAppSendButton";

export default function AIInsightsPage() {
  const searchParams = useSearchParams();
  const reportIdFromUrl = searchParams.get("reportId");
  const { accountId } = useAccount();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [reportAnalysis, setReportAnalysis] = useState<string | null>(null);
  const [reportAnalyzing, setReportAnalyzing] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: savedReportsData } = useQuery({ queryKey: ["savedReports"], queryFn: api.getSavedReports });
  const savedReports = savedReportsData?.data ?? [];

  useEffect(() => {
    if (reportIdFromUrl && savedReports.some((r: { id: string }) => r.id === reportIdFromUrl)) {
      setSelectedReportId(reportIdFromUrl);
    }
  }, [reportIdFromUrl, savedReports]);

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", days, accountId],
    queryFn: () => api.getCampaigns(days, accountId),
  });

  const { data: anomaliesData } = useQuery({
    queryKey: ["anomalies", 14, accountId],
    queryFn: () => api.getAnomalies(14, accountId),
  });

  const campaigns = campaignsData?.data || [];
  const anomalies = anomaliesData?.data || [];
  const anomaliesCount = anomaliesData?.count ?? 0;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await api.analyzeAll(days, accountId);
      setAnalysis(res.analysis);
    } catch (e) {
      setAnalysis("❌ Analiz yapılırken hata oluştu. API bağlantısını kontrol edin.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeReport = async () => {
    if (!selectedReportId) return;
    setReportAnalyzing(true);
    setReportAnalysis(null);
    try {
      const res = await api.analyzeReport(selectedReportId);
      setReportAnalysis(res.analysis ?? "Analiz tamamlandı.");
    } catch (e) {
      setReportAnalysis("❌ Rapor analiz edilirken hata oluştu. API bağlantısını kontrol edin.");
    } finally {
      setReportAnalyzing(false);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setApplyingId(campaignId);
    try {
      await api.updateCampaignStatus(campaignId, "PAUSED");
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["anomalies"] });
    } catch (e) {
      alert("Kampanya duraklatılamadı: " + (e instanceof Error ? e.message : "Bilinmeyen hata"));
    } finally {
      setApplyingId(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddr) return;
    setEmailLoading(true);
    try {
      await api.sendReport(emailAddr, days, true);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch (e) {
      alert("E-posta gönderilemedi. SMTP ayarlarını kontrol edin.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
            <RobotIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Analiz & Öneriler</h1>
            <p className="text-slate-500 text-sm">Claude AI ile reklam performansınızı analiz edin ve somut öneriler alın</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {[7, 14, 30, 90].map(d => (
            <button 
              key={d} 
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                days === d 
                  ? "bg-primary-600 text-white shadow-sm" 
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Son {d} Gün
            </button>
          ))}
        </div>
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={handleAnalyze} 
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <LoadingIcon className="w-4 h-4 animate-spin" />
              Analiz ediliyor...
            </>
          ) : (
            <>
              <SparkleIcon className="w-4 h-4" />
              AI Analizi Başlat
            </>
          )}
        </button>
      </div>

      {/* Kayıtlı Raporu Analiz Et */}
      <div className="card p-6 mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Kayıtlı Raporu Analiz Et</h3>
        <p className="text-sm text-slate-500 mb-4">Raporlar sayfasında kaydettiğiniz bir raporu seçin; AI bu raporun verisini analiz etsin.</p>
        {savedReports.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıtlı rapor yok. <Link href="/reports" className="text-primary-600 hover:underline">Raporlar</Link> sayfasından hazır şablonlarla rapor kaydedebilirsiniz.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedReportId ?? ""}
              onChange={(e) => setSelectedReportId(e.target.value || null)}
              className="input min-w-[280px]"
            >
              <option value="">Rapor seçin</option>
              {savedReports.map((r: { id: string; name: string }) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleAnalyzeReport}
              disabled={!selectedReportId || reportAnalyzing}
            >
              {reportAnalyzing ? (
                <>
                  <LoadingIcon className="w-4 h-4 animate-spin" />
                  Analiz ediliyor...
                </>
              ) : (
                <>
                  <SparkleIcon className="w-4 h-4" />
                  Raporu Analiz Et
                </>
              )}
            </button>
          </div>
        )}
        {reportAnalysis && !reportAnalyzing && (
          <div className="mt-5 p-5 bg-white rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 mb-2">Kayıtlı rapor analizi</div>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{reportAnalysis}</div>
          </div>
        )}
      </div>

      {/* Alerts / Anomalies */}
      {anomaliesCount > 0 && (
        <div className="card p-6 mb-6 border-l-4 border-l-warning-500">
          <div className="flex items-center gap-2 mb-4">
            <AlertIcon className="w-5 h-5 text-warning-600" />
            <h3 className="text-base font-bold text-slate-900">
              Uyarılar ({anomaliesCount})
            </h3>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Son 14 güne göre düşük performans veya sapma tespit edilen kampanyalar.
          </p>
          <div className="space-y-3">
            {anomalies.map((a: AnomalyAlert, i: number) => (
              <div
                key={`${a.campaign_id}-${a.type}-${i}`}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-[280px]">
                  <div className="font-semibold text-slate-900 mb-1">{a.campaign_name}</div>
                  <div className="text-sm text-slate-600">{a.message}</div>
                </div>
                <div className="flex items-center gap-2">
                  {(a.action === "reduce_budget_or_pause" || a.action === "review_budget" || a.type === "low_roas" || a.type === "low_ctr") && (
                    <button
                      className="btn-outline text-xs py-1.5 px-3"
                      onClick={() => handlePauseCampaign(a.campaign_id)}
                      disabled={applyingId === a.campaign_id}
                    >
                      {applyingId === a.campaign_id ? (
                        <LoadingIcon className="w-3 h-3 animate-spin inline mr-1" />
                      ) : (
                        <PauseIcon className="w-3 h-3 inline mr-1" />
                      )}
                      Duraklat
                    </button>
                  )}
                  <Link
                    href={`/campaigns?highlight=${encodeURIComponent(a.campaign_id)}`}
                    className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-all font-medium"
                  >
                    Kampanyaya git →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Count Info */}
      {campaigns.length > 0 && (
        <div className="alert alert-info mb-6">
          <ChartIcon className="w-5 h-5 text-primary-600" />
          <div>
            <strong className="text-slate-900">{campaigns.length} kampanya</strong> analiz için hazır · Son {days} gün verisi kullanılacak
          </div>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="card p-10 text-center border-2 border-dashed border-primary-200 bg-gradient-to-br from-primary-50/50 to-indigo-50/50">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <RobotIcon className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold text-slate-900 mb-2">
            Kampanyalarınız analiz ediliyor...
          </div>
          <div className="text-sm text-slate-500 mb-6">
            Claude AI verilerinizi işliyor ve öneriler hazırlıyor
          </div>
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <div 
                key={i} 
                className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysis && !isAnalyzing && (
        <div className="card p-6 mb-6 border-t-4 border-t-primary-500 bg-gradient-to-br from-primary-50/30 to-white">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <RobotIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">AI Analiz Sonuçları</div>
              <div className="text-xs text-slate-500">Claude AI tarafından oluşturuldu · Son {days} gün</div>
            </div>
          </div>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-white rounded-xl p-5 border border-slate-100">
            {analysis}
          </div>
        </div>
      )}

      {/* Email Report Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
            <MailIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Haftalık Rapor E-postası</h3>
            <p className="text-sm text-slate-500">AI analiz ve CSV raporunu e-posta ile gönderin</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={emailAddr}
            onChange={e => setEmailAddr(e.target.value)}
            className="input flex-1 min-w-[240px]"
          />
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleSendEmail}
            disabled={!emailAddr || emailLoading}
          >
            {emailLoading ? (
              <>
                <LoadingIcon className="w-4 h-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <SendIcon className="w-4 h-4" />
                Raporu Gönder
              </>
            )}
          </button>
        </div>
        {emailSent && (
          <div className="alert alert-success mt-4">
            <CheckIcon className="w-4 h-4" />
            Rapor {emailAddr} adresine başarıyla gönderildi!
          </div>
        )}
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: "📈", title: "CTR Optimizasyonu", desc: "CTR %1'in altındaysa reklam görseli veya hedef kitleyi değiştirin." },
          { icon: "💰", title: "ROAS Takibi", desc: "ROAS 2x altındaysa bütçeyi azaltın veya dönüşüm izlemeyi kontrol edin." },
          { icon: "🔄", title: "Reklam Yorgunluğu", desc: "Frequency 3'ün üzerine çıkarsa yeni kreatifler eklemeyi düşünün." },
          { icon: "🎯", title: "Hedef Kitle", desc: "CPM çok yüksekse hedef kitleniz çok dardır, genişletin." },
        ].map(tip => (
          <div key={tip.title} className="card p-5 hover:shadow-md transition-all">
            <div className="text-2xl mb-3">{tip.icon}</div>
            <div className="text-sm font-bold text-slate-900 mb-2">{tip.title}</div>
            <div className="text-xs text-slate-600 leading-relaxed">{tip.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Icons
function RobotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
