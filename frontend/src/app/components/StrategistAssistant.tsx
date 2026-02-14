"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, BehaviorMode } from "../lib/api";

interface AnalysisHistoryItem {
  id: string;
  report_id: string;
  created_at?: string | null;
}

interface StrategistAssistantProps {
  onStrategyGenerated: (formData: Record<string, unknown>, strategyInfo: StrategyInfo) => void;
  analysisHistoryItems: AnalysisHistoryItem[];
  savedReportsMap: Record<string, string>;
}

export interface StrategyInfo {
  behavior_mode: string;
  mode_name: string;
  risk_level: string;
  budget_multiplier: number;
  applied_rules: string[];
  performance_insights: {
    best_platforms: string[];
    best_ages: string[];
    excluded_platforms: string[];
    excluded_ages: string[];
  };
  lessons_applied: number;
}

const BEHAVIOR_MODE_DETAILS: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  RISK_MINIMIZER: {
    icon: "🛡️",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  CREATIVE_LAB: {
    icon: "🧪",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  BUDGET_GUARD: {
    icon: "💰",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  FAST_CONVERSION: {
    icon: "⚡",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  SCALE_READY: {
    icon: "🚀",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

const RISK_LEVEL_BADGE: Record<string, { text: string; className: string }> = {
  low: { text: "Düşük Risk", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  medium: { text: "Orta Risk", className: "bg-amber-100 text-amber-700 border-amber-200" },
  high: { text: "Yüksek Risk", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function StrategistAssistant({ 
  onStrategyGenerated, 
  analysisHistoryItems,
  savedReportsMap 
}: StrategistAssistantProps) {
  const [selectedMode, setSelectedMode] = useState<string>("RISK_MINIMIZER");
  const [userContext, setUserContext] = useState("");
  const [rawData, setRawData] = useState<string>("");
  const [dataFormat, setDataFormat] = useState<"csv" | "json">("csv");
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawDataFileRef = useRef<HTMLInputElement>(null);

  const { data: behaviorModesData } = useQuery({
    queryKey: ["behavior-modes"],
    queryFn: () => api.getBehaviorModes(),
  });

  const behaviorModes = behaviorModesData?.modes || [];

  const selectedModeDetails = useMemo(() => {
    return behaviorModes.find((m) => m.key === selectedMode);
  }, [behaviorModes, selectedMode]);

  const handleModeChange = (modeKey: string) => {
    setSelectedMode(modeKey);
    setError(null);
  };

  const handleAiImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      const base64 = data.includes(",") ? data.split(",")[1] : data;
      setAiImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRawDataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');
    
    if (!isJson && !isCsv) {
      setError("Lütfen CSV veya JSON dosyası yükleyin.");
      return;
    }
    
    setDataFormat(isJson ? "json" : "csv");
    
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setRawData(content);
    };
    reader.readAsText(file);
  };

  const toggleJob = (id: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!userContext.trim()) {
      setError("Reklam çıkacağınız ürün/hizmet hakkında metin yazın.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const body: {
        user_context: string;
        behavior_mode: string;
        job_ids: string[];
        user_context_image_base64?: string;
        raw_data_csv?: string;
        raw_data_json?: string;
      } = {
        user_context: userContext.trim(),
        behavior_mode: selectedMode,
        job_ids: selectedJobIds,
      };

      if (aiImageBase64) {
        body.user_context_image_base64 = aiImageBase64;
      }

      if (rawData.trim()) {
        if (dataFormat === "csv") {
          body.raw_data_csv = rawData;
        } else {
          body.raw_data_json = rawData;
        }
      }

      const response = await api.generateStrategicAdSummary(body);
      onStrategyGenerated(response.form, response.strategy);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Strateji oluşturulurken bir hata oluştu.";
      const isNetwork = /failed to fetch|network error|fetch failed|load failed|Connection refused|ERR_CONNECTION_REFUSED/i.test(msg);
      setError(
        isNetwork
          ? "Backend'e ulaşılamıyor. Backend'in (http://localhost:8000) çalıştığından emin olun. Ayarlar'dan AI API anahtarınızı (Gemini veya Claude) kontrol edin."
          : msg
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const modeStyle = BEHAVIOR_MODE_DETAILS[selectedMode] || BEHAVIOR_MODE_DETAILS.RISK_MINIMIZER;
  const riskBadge = selectedModeDetails ? RISK_LEVEL_BADGE[selectedModeDetails.risk_level] : null;

  return (
    <div className={`card p-6 mb-6 border-2 ${modeStyle.borderColor} ${modeStyle.bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Stratejist Asistanı
          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
            Next Medya
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-slate-500 hover:text-slate-700 font-medium"
        >
          {showDetails ? "Gizle" : "Göster"}
        </button>
      </div>

      {showDetails && (
        <div className="space-y-5">
          {/* Davranış Modu Seçimi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              1. Stratejik Davranış Modeli Seçin
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {behaviorModes.map((mode) => {
                const style = BEHAVIOR_MODE_DETAILS[mode.key];
                const isSelected = selectedMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => handleModeChange(mode.key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${style.bgColor} ${style.borderColor} ring-2 ring-offset-1`
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold text-sm ${isSelected ? style.color : "text-slate-700"}`}>
                            {mode.name}
                          </span>
                          {isSelected && <span className="text-emerald-500 text-xs">✓</span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{mode.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Seçili Mod Detayları */}
            {selectedModeDetails && (
              <div className={`mt-3 p-4 rounded-lg border ${modeStyle.bgColor} ${modeStyle.borderColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{modeStyle.icon}</span>
                    <span className="font-semibold text-slate-800">{selectedModeDetails.name}</span>
                    {riskBadge && (
                      <span className={`text-xs px-2 py-0.5 rounded border ${riskBadge.className}`}>
                        {riskBadge.text}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-600">
                    Bütçe: {selectedModeDetails.budget_multiplier}x
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedModeDetails.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-white/70 rounded border border-slate-200 text-slate-600"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ürün/Hizmet Bilgisi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              2. Reklam Çıkılacak Ürün/Hizmet *
            </label>
            <textarea
              placeholder="Örn: WordPress web tasarım hizmeti, profesyonel görünümlü site, 10.000 TL dahil paket. Hedef: KOBİ sahipleri, girişimciler."
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          {/* Ham Veri Yükleme */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              3. Ham Performans Verisi (CSV/JSON) - İsteğe Bağlı
            </label>
            <div className="flex items-center gap-3 mb-2">
              <input
                ref={rawDataFileRef}
                type="file"
                accept=".csv,.json"
                onChange={handleRawDataFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => rawDataFileRef.current?.click()}
                className="btn-outline text-sm flex items-center gap-2"
              >
                📊 Veri Dosyası Yükle
              </button>
              {rawData && (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                  ✓ {dataFormat.toUpperCase()} dosyası yüklendi
                  <button
                    type="button"
                    onClick={() => setRawData("")}
                    className="text-slate-400 hover:text-red-500 ml-2"
                  >
                    Kaldır
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Meta Ads kampanya verilerinizi yükleyin. En düşük CPC ve en yüksek CTR değerleri otomatik analiz edilecek.
            </p>
            
            {rawData && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Veri Önizleme:</span>
                  <span className="text-xs text-slate-400">
                    {rawData.length.toLocaleString()} karakter
                  </span>
                </div>
                <pre className="text-xs text-slate-500 overflow-x-auto max-h-32 whitespace-pre-wrap">
                  {rawData.slice(0, 500)}{rawData.length > 500 ? "..." : ""}
                </pre>
              </div>
            )}
          </div>

          {/* Görsel Yükleme */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              4. Görsel (İsteğe Bağlı)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAiImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline text-sm"
              >
                🖼️ Görsel Yükle
              </button>
              {aiImageBase64 && (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                  ✓ Görsel eklendi
                  <button
                    type="button"
                    onClick={() => setAiImageBase64(null)}
                    className="text-slate-400 hover:text-red-500 ml-2"
                  >
                    Kaldır
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Geçmiş Analiz Seçimi */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              5. Geçmiş Analiz Notları (PDF Özetleri) - İsteğe Bağlı
            </label>
            {analysisHistoryItems.length === 0 ? (
              <p className="text-sm text-slate-500 py-2 bg-slate-50 rounded-lg px-3">
                Henüz tamamlanmış analiz yok.{" "}
                <Link href="/reports" className="text-primary-600 hover:underline font-medium">
                  Raporlar
                </Link>{" "}
                sayfasından kayıtlı rapor seçip "AI&apos;da Analiz Et" ile analiz başlatın.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                {analysisHistoryItems.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                      selectedJobIds.includes(item.id)
                        ? "border-primary-500 bg-primary-100"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(item.id)}
                      onChange={() => toggleJob(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600"
                    />
                    <span className="text-xs font-medium" title={item.id}>
                      {savedReportsMap[item.report_id] ?? item.id.slice(0, 8)}
                    </span>
                    {item.created_at && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Seçilen raporlardaki &quot;Somut Öneriler&quot; ve dikkat edilmesi gerekenler analiz edilerek yeni stratejiye entegre edilecek.
            </p>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div className="alert alert-error py-3">
              <AlertIcon className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !userContext.trim()}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-3 ${
              isGenerating
                ? "bg-slate-400 cursor-not-allowed"
                : modeStyle.bgColor.replace("bg-", "bg-gradient-to-r from-").replace("50", "500") + " to-" + modeStyle.color.replace("text-", "").replace("-700", "-600") + " hover:opacity-90 shadow-lg"
            }`}
            style={{
              background: isGenerating 
                ? undefined 
                : selectedMode === "RISK_MINIMIZER" 
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : selectedMode === "CREATIVE_LAB"
                  ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                  : selectedMode === "BUDGET_GUARD"
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : selectedMode === "FAST_CONVERSION"
                  ? "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)"
                  : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
            }}
          >
            {isGenerating ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Strateji Oluşturuluyor...
                <span className="text-xs opacity-80">
                  ({selectedModeDetails?.name})
                </span>
              </>
            ) : (
              <>
                <span className="text-xl">{modeStyle.icon}</span>
                Stratejik Reklam Planı Oluştur
                <ArrowRightIcon className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Bilgi Notu */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <InfoIcon className="w-4 h-4 text-slate-400" />
              Analiz ve Karar Mekanizması
            </h4>
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
              <li>Ham verideki sayısal başarı (En düşük CPC/En yüksek CTR) tespit edilir</li>
              <li>Geçmiş analiz notlarındaki &quot;Somut Öneriler&quot; okunur</li>
              <li>
                <strong>{selectedModeDetails?.name}</strong> modunun kuralları uygulanarak nihai reklam kurulumu oluşturulur
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
