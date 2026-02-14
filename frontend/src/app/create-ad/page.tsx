"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StrategistAssistant, StrategyInfo } from "../components/StrategistAssistant";

const STEPS = ["Kampanya", "Reklam seti", "Kreatif", "Reklam"];

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Bilinirlik",
  OUTCOME_TRAFFIC: "Trafik",
  OUTCOME_ENGAGEMENT: "Etkileşim",
  OUTCOME_LEADS: "Potansiyel müşteriler",
  OUTCOME_SALES: "Satışlar",
  OUTCOME_APP_PROMOTION: "Uygulama tanıtımı",
  LINK_CLICKS: "Link tıklamaları",
  CONVERSIONS: "Dönüşümler",
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Daha fazla bilgi",
  SHOP_NOW: "Şimdi alışveriş yap",
  SIGN_UP: "Kayıt ol",
  CONTACT_US: "Bize ulaşın",
  MESSAGE: "Mesaj Gönder",
  CALL_NOW: "Şimdi ara",
};

const CONVERSION_LABELS: Record<string, string> = {
  MESSAGES: "Mesaj yönlendirme (Messenger, Instagram, WhatsApp)",
  WEBSITE: "İnternet sitesi",
  CALLS: "Aramalar",
  APP: "Uygulama",
  PROFILE: "Instagram veya Facebook profili",
};

const PERFORMANCE_GOAL_LABELS: Record<string, string> = {
  MESSAGES: "Mesaj sayısını en üst düzeye çıkar",
  WEBSITE: "Link tıklamalarını en üst düzeye çıkar",
  CALLS: "Arama sayısını en üst düzeye çıkar",
  APP: "Uygulama etkileşimlerini en üst düzeye çıkar",
  PROFILE: "Etkileşim sayısını en üst düzeye çıkar",
};

export default function CreateAdPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    campaignName: "",
    campaignObjective: "OUTCOME_ENGAGEMENT",
    buyingType: "auction" as "auction",
    budgetStrategy: "adset" as "campaign" | "adset",
    budgetSharing: true,
    bidStrategy: "highest_volume",
    abTestEnabled: false,
    specialAdCategory: "" as string,
    adsetName: "",
    dailyBudget: 10000,
    performanceGoal: "" as string,
    startDate: new Date().toISOString().slice(0, 10),
    endDateEnabled: false,
    endDate: "",
    budgetPlanning: false,
    savedAudience: "",
    excludeAudience: "",
    languages: "",
    valueRules: false,
    deliveryType: "standard" as string,
    conversionGoal: "MESSAGES" as "MESSAGES" | "WEBSITE" | "CALLS" | "APP" | "PROFILE",
    platforms: ["facebook", "instagram"] as string[],
    placementsAuto: true,
    placements: {
      feeds: true,
      stories: true,
      reels: true,
      search: false,
      audienceNetwork: false,
    },
    messageTargets: ["messenger", "instagram", "whatsapp"] as string[],
    whatsappNumber: "",
    location: "Türkiye",
    ageMin: 18,
    ageMax: 65,
    gender: "all" as "all" | "male" | "female",
    selectedDemographics: [] as string[],
    selectedInterests: [] as string[],
    selectedBehaviors: [] as string[],
    targetingLogicWithin: "or" as "or" | "and",
    targetingLogicBetween: "and" as "and" | "or",
    creativeName: "",
    fbPageName: "",
    instagramHandle: "",
    creativeSource: "manual" as "manual" | "catalog",
    format: "single" as "single" | "carousel",
    primaryText: "",
    headline: "",
    link: "https://www.facebook.com",
    cta: "MESSAGE",
    multiAdvertiser: false,
    welcomeMessage: "Merhaba! Size nasıl yardımcı olabilirim?",
    faqQuestions: [] as { q: string; a: string }[],
    phoneNumber: "",
    callbackEnabled: false,
    adName: "",
    partnershipAd: false,
    trackWebsiteEvents: false,
    trackAppEvents: false,
    creativeTestEnabled: false,
    adSetExtras: [] as { adsetName: string; dailyBudget: number }[],
    creativeExtras: [] as { creativeName: string; primaryText: string; headline: string; adName: string }[],
  });

  const { data: targetingData, isLoading: targetingLoading } = useQuery({
    queryKey: ["targeting-options"],
    queryFn: () => api.getTargetingOptions(),
  });

  const { data: pagesData } = useQuery({
    queryKey: ["campaigns-pages"],
    queryFn: api.getPages,
    retry: false,
  });
  const pages = pagesData?.data ?? [];

  const { data: analysisHistory } = useQuery({
    queryKey: ["analysisHistory"],
    queryFn: api.getAnalysisHistory,
  });
  const { data: savedReportsData } = useQuery({
    queryKey: ["savedReports"],
    queryFn: api.getSavedReports,
  });
  const savedReportsMap = useMemo(() => {
    const arr = savedReportsData?.data ?? [];
    return Object.fromEntries(arr.map((r: { id: string; name: string }) => [r.id, r.name]));
  }, [savedReportsData]);

  const [aiContext, setAiContext] = useState("");
  const [aiImageBase64, setAiImageBase64] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Stratejist Asistanı State
  const [strategyInfo, setStrategyInfo] = useState<StrategyInfo | null>(null);
  const [showStrategistPanel, setShowStrategistPanel] = useState(true);

  const toggleJob = (id: string) => {
    setSelectedJobIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Stratejist Asistanı Callback
  const handleStrategyGenerated = (formData: Record<string, unknown>, strategy: StrategyInfo) => {
    setStrategyInfo(strategy);
    
    // Form verilerini güncelle
    setForm((prev) => {
      const next = { ...prev };
      const keys = [
        "campaignName", "campaignObjective", "budgetStrategy", "budgetSharing", "bidStrategy",
        "abTestEnabled", "specialAdCategory", "adsetName", "dailyBudget", "performanceGoal",
        "conversionGoal", "platforms", "placementsAuto", "placements", "location", "ageMin",
        "ageMax", "gender", "selectedDemographics", "selectedInterests", "selectedBehaviors",
        "targetingLogicWithin", "targetingLogicBetween", "creativeName", "primaryText",
        "headline", "link", "cta", "adName", "welcomeMessage", "faqQuestions",
      ] as const;
      for (const k of keys) {
        if (formData[k] !== undefined && formData[k] !== null) {
          let v = formData[k];
          if (k === "dailyBudget" && typeof v === "string") v = parseInt(String(v), 10) || prev.dailyBudget;
          if (k === "dailyBudget" && typeof v === "number") {
            // Strateji bütçe çarpanını uygula
            v = Math.round(v * strategy.budget_multiplier);
          }
          if (k === "ageMin" && typeof v === "string") v = parseInt(String(v), 10) || prev.ageMin;
          if (k === "ageMax" && typeof v === "string") v = parseInt(String(v), 10) || prev.ageMax;
          if (k === "platforms" && !Array.isArray(v)) v = prev.platforms;
          if (k === "placements" && (typeof v !== "object" || v === null)) v = prev.placements;
          // Strateji moduna göre platformları sınırla
          if (k === "platforms" && Array.isArray(v) && strategy.performance_insights.best_platforms.length > 0) {
            const bestPlatforms = strategy.performance_insights.best_platforms.map(p => p.toLowerCase());
            v = (v as string[]).filter(p => bestPlatforms.includes(p.toLowerCase()));
            if ((v as string[]).length === 0) v = prev.platforms;
          }
          (next as Record<string, unknown>)[k] = v;
        }
      }
      return next;
    });
    
    setShowStrategistPanel(false);
    setStep(1);
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

  const handleAiGenerate = async () => {
    if (!aiContext.trim()) {
      setAiError("Reklam çıkacağınız ürün/hizmet hakkında metin yazın.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.generateAdSummaryFromReports({
        user_context: aiContext.trim(),
        user_context_image_base64: aiImageBase64 || undefined,
        job_ids: selectedJobIds,
      });
      const data = res.form as Record<string, unknown>;
      if (data && typeof data === "object") {
        setForm((prev) => {
          const next = { ...prev };
          const keys = [
            "campaignName", "campaignObjective", "budgetStrategy", "budgetSharing", "bidStrategy",
            "abTestEnabled", "specialAdCategory", "adsetName", "dailyBudget", "performanceGoal",
            "conversionGoal", "platforms", "placementsAuto", "placements", "location", "ageMin",
            "ageMax", "gender", "selectedDemographics", "selectedInterests", "selectedBehaviors",
            "targetingLogicWithin", "targetingLogicBetween", "creativeName", "primaryText",
            "headline", "link", "cta", "adName", "welcomeMessage", "faqQuestions",
          ] as const;
          for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null) {
              let v = data[k];
              if (k === "dailyBudget" && typeof v === "string") v = parseInt(String(v), 10) || prev.dailyBudget;
              if (k === "ageMin" && typeof v === "string") v = parseInt(String(v), 10) || prev.ageMin;
              if (k === "ageMax" && typeof v === "string") v = parseInt(String(v), 10) || prev.ageMax;
              if (k === "platforms" && !Array.isArray(v)) v = prev.platforms;
              if (k === "placements" && (typeof v !== "object" || v === null)) v = prev.placements;
              (next as Record<string, unknown>)[k] = v;
            }
          }
          return next;
        });
        setShowAiPanel(false);
        setStep(1);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI özeti oluşturulamadı.");
    } finally {
      setAiLoading(false);
    }
  };

  const analysisHistoryItems = analysisHistory?.data ?? [];

  const update = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const toggleTargeting = (
    category: "selectedDemographics" | "selectedInterests" | "selectedBehaviors",
    label: string
  ) => {
    setForm((f) => {
      const arr = f[category];
      const next = arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label];
      return { ...f, [category]: next };
    });
  };

  const togglePlatform = (p: string) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }));
  };
  const toggleMessageTarget = (t: string) => {
    setForm((f) => ({
      ...f,
      messageTargets: f.messageTargets.includes(t)
        ? f.messageTargets.filter((x) => x !== t)
        : [...f.messageTargets, t],
    }));
  };

  const handleStep1 = () => {
    setError(null);
    if (!form.campaignName.trim()) {
      setError("Kampanya adı girin.");
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    setError(null);
    if (!form.adsetName.trim()) {
      setError("Reklam seti adı girin.");
      return;
    }
    setStep(3);
  };

  const handleStep3 = () => {
    setError(null);
    if (!form.creativeName.trim()) {
      setError("Kreatif adı girin.");
      return;
    }
    setStep(4);
  };

  const handleStep4 = () => {
    setError(null);
    if (!form.adName.trim()) {
      setError("Reklam adı girin.");
      return;
    }
    setStep(5);
  };

  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push("=== REKLAM OLUŞTURMA ÖZETİ ===");
    lines.push("");
    lines.push("--- KAMPANYA ---");
    lines.push(`Kampanya adı: ${form.campaignName}`);
    lines.push(`Kampanya amacı: ${OBJECTIVE_LABELS[form.campaignObjective] || form.campaignObjective}`);
    lines.push(`Bütçe stratejisi: ${form.budgetStrategy === "campaign" ? "Kampanya bütçesi (Advantage+)" : "Reklam seti bütçesi"}`);
    if (form.budgetSharing) lines.push("Bütçe paylaşımı: Açık (%20'ye kadar diğer reklam setleriyle)");
    lines.push(`Teklif stratejisi: ${form.bidStrategy === "highest_volume" ? "En yüksek hacim" : form.bidStrategy}`);
    if (form.abTestEnabled) lines.push("A/B Testi: Açık");
    if (form.specialAdCategory) lines.push(`Özel reklam kategorisi: ${form.specialAdCategory}`);
    lines.push("");
    lines.push("--- REKLAM SETLERİ ---");
    lines.push(`Reklam seti 1: ${form.adsetName}`);
    lines.push(`Dönüşüm hedefi: ${CONVERSION_LABELS[form.conversionGoal] || form.conversionGoal}`);
    lines.push(
      `Performans hedefi: ${form.performanceGoal || PERFORMANCE_GOAL_LABELS[form.conversionGoal] || "—"}`
    );
    lines.push(`Başlangıç: ${form.startDate}`);
    if (form.endDateEnabled && form.endDate) lines.push(`Bitiş: ${form.endDate}`);
    if (form.budgetPlanning) lines.push("Bütçe planlama: Açık");
    if (form.savedAudience) lines.push(`Kaydedilen hedef kitle: ${form.savedAudience}`);
    if (form.excludeAudience) lines.push(`Hariç tutulacaklar: ${form.excludeAudience}`);
    if (form.languages) lines.push(`Diller: ${form.languages}`);
    if (form.valueRules) lines.push("Değer kuralları: Uygulanacak");
    lines.push(`Yayın türü: ${form.deliveryType || "Standart"}`);
    lines.push(`Platformlar: ${form.platforms.join(", ")}`);
    lines.push(`Reklam alanları: ${form.placementsAuto ? "Advantage+ (otomatik)" : "Manuel"}`);
    if (!form.placementsAuto) {
      const p = form.placements;
      const sel = [
        p.feeds && "Akışlar",
        p.stories && "Hikayeler",
        p.reels && "Reels",
        p.search && "Arama",
        p.audienceNetwork && "Audience Network",
      ].filter(Boolean);
      lines.push(`  Seçili: ${sel.join(", ")}`);
    }
    if (form.conversionGoal === "MESSAGES") {
      lines.push(`Mesaj hedefleri: ${form.messageTargets.join(", ")}`);
      if (form.messageTargets.includes("whatsapp") && form.whatsappNumber) {
        lines.push(`  WhatsApp: ${form.whatsappNumber}`);
      }
    }
    lines.push(`Günlük bütçe: ${(form.dailyBudget / 100).toFixed(2)} TL (${form.dailyBudget} kuruş)`);
    lines.push(`Konum: ${form.location}`);
    lines.push(`Yaş: ${form.ageMin}-${form.ageMax}+`);
    lines.push(`Cinsiyet: ${form.gender === "all" ? "Tüm cinsiyetler" : form.gender === "male" ? "Erkek" : "Kadın"}`);
    if (
      form.selectedDemographics.length ||
      form.selectedInterests.length ||
      form.selectedBehaviors.length
    ) {
      lines.push("Detaylı hedefleme:");
      lines.push(
        `  Mantık: Kategoriler arası ${form.targetingLogicBetween === "and" ? "VE" : "VEYA"}, aynı kategori içi ${form.targetingLogicWithin === "and" ? "VE" : "VEYA"}`
      );
      form.selectedDemographics.forEach((l) => lines.push(`  • Demografik: ${l}`));
      form.selectedInterests.forEach((l) => lines.push(`  • İlgi alanı: ${l}`));
      form.selectedBehaviors.forEach((l) => lines.push(`  • Davranış: ${l}`));
    }
    form.adSetExtras.forEach((extra, i) => {
      lines.push("");
      lines.push(`Reklam seti ${i + 2}: ${extra.adsetName}`);
      lines.push(`  Günlük bütçe: ${(extra.dailyBudget / 100).toFixed(2)} TL`);
      lines.push("  (Hedef kitle: Ana reklam setiyle aynı)");
    });
    lines.push("");
    lines.push("--- KREATİFLER ---");
    lines.push(`Kreatif adı: ${form.creativeName}`);
    if (form.fbPageName) lines.push(`Facebook Sayfası: ${form.fbPageName}`);
    if (form.instagramHandle) lines.push(`Instagram: @${form.instagramHandle}`);
    lines.push(`Kaynak: ${form.creativeSource === "catalog" ? "Advantage+ Katalog" : "Manuel yükleme"}`);
    lines.push(`Format: ${form.format === "carousel" ? "Carousel" : "Tek görsel/video"}`);
    lines.push(`Birincil metin: ${form.primaryText || "(boş)"}`);
    lines.push(`Başlık: ${form.headline || "(boş)"}`);
    if (form.conversionGoal === "WEBSITE" || form.link) lines.push(`Hedef URL: ${form.link}`);
    lines.push(`CTA: ${CTA_LABELS[form.cta] || form.cta}`);
    if (form.multiAdvertiser) lines.push("Çok reklamverenli reklamlar: Açık");
    if (form.conversionGoal === "MESSAGES") {
      lines.push(`Karşılama mesajı: ${form.welcomeMessage}`);
      form.faqQuestions.forEach((faq, i) =>
        lines.push(`  SSS ${i + 1}: ${faq.q} → ${faq.a || "(yanıt yok)"}`)
      );
    }
    if (form.conversionGoal === "CALLS" && form.phoneNumber) {
      lines.push(`Telefon: ${form.phoneNumber}`);
      if (form.callbackEnabled) lines.push("Geri arama: Açık");
    }
    form.creativeExtras.forEach((extra, i) => {
      lines.push("");
      lines.push(`Kreatif ${i + 2}: ${extra.creativeName || "(adsız)"}`);
      lines.push(`  Metin: ${extra.primaryText || "(boş)"}`);
      lines.push(`  Başlık: ${extra.headline || "(boş)"}`);
      lines.push(`  Reklam adı: ${extra.adName || "(boş)"}`);
    });
    lines.push("");
    lines.push("--- REKLAM ---");
    lines.push(`Reklam adı: ${form.adName}`);
    if (form.partnershipAd) lines.push("Ortaklık reklamı: Açık");
    if (form.trackWebsiteEvents) lines.push("Takip: İnternet sitesi olayları");
    if (form.trackAppEvents) lines.push("Takip: Uygulama olayları");
    if (form.creativeTestEnabled) lines.push("Kreatif testi: Açık");
    lines.push("");
    lines.push("Bu özeti kullanarak Meta Ads Manager'da reklamı manuel oluşturun.");
    return lines.join("\n");
  }, [form]);

  const copySummary = () => {
    navigator.clipboard.writeText(summaryText);
  };

  const handleSaveSummary = async () => {
    const name = saveName.trim() || form.campaignName || form.adsetName || "Reklam Özeti";
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      await api.saveAdSummary({ name, summary_text: summaryText });
      setSaveSuccess(true);
      setSaveName("");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Reklam Özeti Oluştur</h1>
        <p className="text-slate-500 text-sm">
          Analiz ve raporlara göre reklam ayarlarını girin. Oluşturulan özeti Meta Ads Manager&apos;da
          manuel reklam oluştururken kullanın.
        </p>
      </div>

      {/* AI ile oluştur paneli */}
      <div className="card p-6 mb-6 border-2 border-primary-200 bg-primary-50/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-sm">AI</span>
            AI ile Otomatik Oluştur
          </h2>
          <button
            type="button"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAiPanel ? "Gizle" : "Göster"}
          </button>
        </div>
        {showAiPanel && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Önce reklam çıkacağınız ürün/hizmeti tanımlayın, ardından geçmiş rapor analizlerinden seçim yapın. AI tüm reklam alanlarını otomatik dolduracak.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reklam çıkacağınız ürün/hizmet hakkında *</label>
              <textarea
                placeholder="Örn: WordPress web tasarım hizmeti, profesyonel görünümlü site, 10.000 TL dahil paket. Hedef: KOBİ sahipleri, girişimciler."
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                rows={3}
                className="input w-full resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Görsel (isteğe bağlı)</label>
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
                  Görsel yükle
                </button>
                {aiImageBase64 && (
                  <span className="text-xs text-green-600">Görsel eklendi</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rapor seçin (Geçmiş AI Analizler)</label>
              {analysisHistoryItems.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  Henüz tamamlanmış analiz yok.{" "}
                  <Link href="/reports" className="text-primary-600 hover:underline font-medium">
                    Raporlar
                  </Link>{" "}
                  sayfasından kayıtlı rapor seçip &quot;AI&apos;da Analiz Et&quot; ile analiz başlatın.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {analysisHistoryItems.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        selectedJobIds.includes(item.id)
                          ? "border-primary-500 bg-primary-100"
                          : "border-slate-200 hover:border-slate-300"
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
            </div>
            {aiError && (
              <div className="alert alert-error py-2">
                <span className="text-sm">{aiError}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiContext.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {aiLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI analiz ediyor…
                </>
              ) : (
                <>AI ile Reklam Özetini Oluştur</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Stratejist Asistanı Paneli */}
      {showStrategistPanel && (
        <StrategistAssistant
          onStrategyGenerated={handleStrategyGenerated}
          analysisHistoryItems={analysisHistoryItems}
          savedReportsMap={savedReportsMap}
        />
      )}

      {/* Strateji Bilgisi Banner */}
      {strategyInfo && (
        <div className="mb-6 p-4 rounded-xl border-2 bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {strategyInfo.behavior_mode === "RISK_MINIMIZER" && "🛡️"}
                {strategyInfo.behavior_mode === "CREATIVE_LAB" && "🧪"}
                {strategyInfo.behavior_mode === "BUDGET_GUARD" && "💰"}
                {strategyInfo.behavior_mode === "FAST_CONVERSION" && "⚡"}
                {strategyInfo.behavior_mode === "SCALE_READY" && "🚀"}
              </span>
              <div>
                <h3 className="font-semibold text-slate-800">
                  Strateji: {strategyInfo.mode_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Risk: {strategyInfo.risk_level === "low" ? "Düşük" : strategyInfo.risk_level === "medium" ? "Orta" : "Yüksek"} • 
                  Bütçe: {strategyInfo.budget_multiplier}x • 
                  {strategyInfo.lessons_applied} ders uygulandı
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStrategyInfo(null);
                setShowStrategistPanel(true);
              }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Yeni Strateji Oluştur
            </button>
          </div>
          
          {/* Uygulanan Kurallar */}
          <div className="flex flex-wrap gap-2 mt-3">
            {strategyInfo.applied_rules.map((rule, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-600"
              >
                ✓ {rule}
              </span>
            ))}
          </div>
          
          {/* Performans İçgörüleri */}
          {(strategyInfo.performance_insights.best_platforms.length > 0 || 
            strategyInfo.performance_insights.excluded_platforms.length > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Ham Veri Analizi:</p>
              <div className="flex flex-wrap gap-4 text-xs">
                {strategyInfo.performance_insights.best_platforms.length > 0 && (
                  <span className="text-emerald-600">
                    ✅ En İyi Platformlar: {strategyInfo.performance_insights.best_platforms.join(", ")}
                  </span>
                )}
                {strategyInfo.performance_insights.best_ages.length > 0 && (
                  <span className="text-emerald-600">
                    ✅ En İyi Yaş: {strategyInfo.performance_insights.best_ages.join(", ")}
                  </span>
                )}
                {strategyInfo.performance_insights.excluded_platforms.length > 0 && (
                  <span className="text-rose-600">
                    🚫 Hariç Tutulan: {strategyInfo.performance_insights.excluded_platforms.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          return (
            <div
              key={label}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isCompleted
                  ? "bg-success-100 text-success-700 border border-success-200"
                  : isActive
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              <span className="mr-1">{stepNum}.</span>
              {label}
              {isCompleted && <span className="ml-1">✓</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="alert alert-error mb-5">
          <AlertIcon className="w-4 h-4" />
          {error}
        </div>
      )}

      {step === 5 ? (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-slate-900">Reklam Oluşturma Özeti</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Özet adı (kaydetmek için)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="input w-48 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveSummary}
                disabled={saveLoading}
                className="btn-outline text-sm py-2 px-4 flex items-center gap-2"
              >
                {saveLoading ? "Kaydediliyor…" : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={copySummary}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
              >
                <CopyIcon className="w-4 h-4" />
                Panoya kopyala
              </button>
            </div>
          </div>
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Özet kaydedildi.{" "}
              <Link href="/ad-summaries" className="font-medium underline">
                Kayıtlı özetleri görüntüle
              </Link>
            </div>
          )}
          <p className="text-slate-600 text-sm mb-4">
            Bu özeti reklamcıya verin. Reklamcı Meta Ads Manager&apos;da bu bilgilerle reklamı
            manuel oluşturacaktır.
          </p>
          <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap font-sans overflow-x-auto max-h-[400px] overflow-y-auto">
            {summaryText}
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              Baştan oluştur
            </button>
            <Link href="/ad-summaries" className="btn-outline text-sm">
              Kayıtlı özetleri görüntüle
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          {step === 1 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Kampanya
              </h3>
              <input
                placeholder="Kampanya adı"
                value={form.campaignName}
                onChange={(e) => update("campaignName", e.target.value)}
                className="input w-full mb-3"
              />
              <select
                value={form.campaignObjective}
                onChange={(e) => update("campaignObjective", e.target.value)}
                className="select w-full mb-3"
              >
                <option value="OUTCOME_AWARENESS">Bilinirlik</option>
                <option value="OUTCOME_TRAFFIC">Trafik</option>
                <option value="OUTCOME_ENGAGEMENT">Etkileşim</option>
                <option value="OUTCOME_LEADS">Potansiyel müşteriler</option>
                <option value="OUTCOME_SALES">Satışlar</option>
                <option value="OUTCOME_APP_PROMOTION">Uygulama tanıtımı</option>
                <option value="LINK_CLICKS">Link tıklamaları</option>
                <option value="CONVERSIONS">Dönüşümler</option>
              </select>
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">Bütçe stratejisi</p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="budgetStrategy"
                      checked={form.budgetStrategy === "campaign"}
                      onChange={() => update("budgetStrategy", "campaign")}
                      className="mt-1"
                    />
                    <span className="text-sm">Kampanya bütçesi (Advantage+) – Otomatik dağıtım</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="budgetStrategy"
                      checked={form.budgetStrategy === "adset"}
                      onChange={() => update("budgetStrategy", "adset")}
                      className="mt-1"
                    />
                    <span className="text-sm">Reklam seti bütçesi – Her set için ayrı</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.budgetSharing}
                    onChange={(e) => update("budgetSharing", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600"
                  />
                  <span className="text-sm">Bütçenizin %20 kadarını diğer reklam setleriyle paylaş</span>
                </label>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Teklif stratejisi</label>
                <select
                  value={form.bidStrategy}
                  onChange={(e) => update("bidStrategy", e.target.value)}
                  className="select w-full"
                >
                  <option value="highest_volume">En yüksek hacim</option>
                  <option value="lowest_cost">En düşük maliyet</option>
                  <option value="cost_cap">Maliyet limiti</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.abTestEnabled}
                  onChange={(e) => update("abTestEnabled", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">A/B testi</span>
              </label>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Özel reklam kategorisi (varsa)
                </label>
                <select
                  value={form.specialAdCategory}
                  onChange={(e) => update("specialAdCategory", e.target.value)}
                  className="select w-full"
                >
                  <option value="">Yok</option>
                  <option value="credit">Finansal ürünler ve hizmetler</option>
                  <option value="employment">İstihdam</option>
                  <option value="housing">Konut</option>
                  <option value="social">Sosyal meseleler</option>
                  <option value="politics">Seçimler veya siyaset</option>
                </select>
              </div>
              <button type="button" className="btn-primary flex items-center gap-2" onClick={handleStep1}>
                İleri →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Reklam Seti & Hedef Kitle
              </h3>
              <input
                placeholder="Reklam seti adı"
                value={form.adsetName}
                onChange={(e) => update("adsetName", e.target.value)}
                className="input w-full mb-3"
              />
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Dönüşüm hedefi</label>
                <select
                  value={form.conversionGoal}
                  onChange={(e) =>
                    update(
                      "conversionGoal",
                      e.target.value as "MESSAGES" | "WEBSITE" | "CALLS" | "APP" | "PROFILE"
                    )
                  }
                  className="select w-full"
                >
                  <option value="MESSAGES">Mesaj yönlendirme (Messenger, Instagram, WhatsApp)</option>
                  <option value="WEBSITE">İnternet sitesi</option>
                  <option value="CALLS">Aramalar</option>
                  <option value="APP">Uygulama</option>
                  <option value="PROFILE">Instagram veya Facebook profili</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Performans hedefi</label>
                <select
                  value={form.performanceGoal || PERFORMANCE_GOAL_LABELS[form.conversionGoal]}
                  onChange={(e) => update("performanceGoal", e.target.value)}
                  className="select w-full"
                >
                  <option value="">Varsayılan (dönüşüme göre)</option>
                  <option value="Mesaj sayısını en üst düzeye çıkar">Mesaj sayısını en üst düzeye çıkar</option>
                  <option value="Arama sayısını en üst düzeye çıkar">Arama sayısını en üst düzeye çıkar</option>
                  <option value="Link tıklamalarını en üst düzeye çıkar">Link tıklamalarını en üst düzeye çıkar</option>
                  <option value="Etkileşim sayısını en üst düzeye çıkar">Etkileşim sayısını en üst düzeye çıkar</option>
                </select>
              </div>
              {form.conversionGoal === "MESSAGES" && (
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-600 mb-2">Mesaj hedefleri</p>
                  {["messenger", "instagram", "whatsapp"].map((t) => (
                    <label key={t} className="flex items-center gap-2 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.messageTargets.includes(t)}
                        onChange={() => toggleMessageTarget(t)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600"
                      />
                      <span className="text-sm capitalize">{t}</span>
                    </label>
                  ))}
                  {form.messageTargets.includes("whatsapp") && (
                    <input
                      placeholder="WhatsApp numarası (örn. +90 5XX XXX XX XX)"
                      value={form.whatsappNumber}
                      onChange={(e) => update("whatsappNumber", e.target.value)}
                      className="input w-full mt-2 text-sm"
                    />
                  )}
                </div>
              )}
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">Platformlar</p>
                <div className="flex flex-wrap gap-2">
                  {["facebook", "instagram", "messenger", "whatsapp", "audience_network", "threads"].map(
                    (p) => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.platforms.includes(p)}
                          onChange={() => togglePlatform(p)}
                          className="w-4 h-4 rounded border-slate-300 text-primary-600"
                        />
                        <span className="text-sm capitalize">{p.replace("_", " ")}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.placementsAuto}
                    onChange={(e) => update("placementsAuto", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600"
                  />
                  <span className="text-sm">Advantage+ reklam alanları (otomatik)</span>
                </label>
                {!form.placementsAuto && (
                  <div className="mt-2 flex flex-wrap gap-3 pl-6">
                    {[
                      { k: "feeds", l: "Akışlar" },
                      { k: "stories", l: "Hikayeler, Reels" },
                      { k: "reels", l: "Reels" },
                      { k: "search", l: "Arama" },
                      { k: "audienceNetwork", l: "Audience Network" },
                    ].map(({ k, l }) => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.placements[k as keyof typeof form.placements]}
                          onChange={(e) =>
                            update("placements", {
                              ...form.placements,
                              [k]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-slate-300 text-primary-600"
                        />
                        <span className="text-xs">{l}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Başlangıç tarihi</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => update("startDate", e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500 mb-1">
                    <input
                      type="checkbox"
                      checked={form.endDateEnabled}
                      onChange={(e) => update("endDateEnabled", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600"
                    />
                    Bitiş tarihi belirle
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                    disabled={!form.endDateEnabled}
                    className="input w-full"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.budgetPlanning}
                  onChange={(e) => update("budgetPlanning", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">Bütçe artışlarını planla</span>
              </label>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Kaydedilen hedef kitle (isteğe bağlı)</label>
                <input
                  placeholder="Kaydedilmiş hedef kitle adı"
                  value={form.savedAudience}
                  onChange={(e) => update("savedAudience", e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Hariç tutulacaklar (isteğe bağlı)</label>
                <input
                  placeholder="Hariç tutulacak hedef kitle"
                  value={form.excludeAudience}
                  onChange={(e) => update("excludeAudience", e.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Diller (isteğe bağlı)</label>
                <input
                  placeholder="Örn. Türkçe"
                  value={form.languages}
                  onChange={(e) => update("languages", e.target.value)}
                  className="input w-full"
                />
              </div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.valueRules}
                  onChange={(e) => update("valueRules", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">Değer kuralları uygula</span>
              </label>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Günlük Bütçe (kuruş, örn. 10000 = 100 TL)</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={form.dailyBudget}
                  onChange={(e) => update("dailyBudget", parseInt(e.target.value, 10) || 0)}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Konum</label>
                  <input
                    placeholder="Türkiye"
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Yaş (min-max)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={18}
                      max={65}
                      value={form.ageMin}
                      onChange={(e) => update("ageMin", parseInt(e.target.value, 10) || 18)}
                      className="input w-full"
                    />
                    <span className="self-center">-</span>
                    <input
                      type="number"
                      min={18}
                      max={65}
                      value={form.ageMax}
                      onChange={(e) => update("ageMax", parseInt(e.target.value, 10) || 65)}
                      className="input w-full"
                    />
                    <span className="self-center text-sm">+</span>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Cinsiyet</label>
                <select
                  value={form.gender}
                  onChange={(e) =>
                    update("gender", e.target.value as "all" | "male" | "female")
                  }
                  className="select w-full"
                >
                  <option value="all">Tüm cinsiyetler</option>
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Ek reklam setleri</label>
                  <button
                    type="button"
                    onClick={() =>
                      update("adSetExtras", [
                        ...form.adSetExtras,
                        { adsetName: `Reklam Seti ${form.adSetExtras.length + 2}`, dailyBudget: 10000 },
                      ])
                    }
                    className="btn-outline text-xs py-1.5 px-3"
                  >
                    + Reklam seti ekle
                  </button>
                </div>
                {form.adSetExtras.length > 0 && (
                  <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    {form.adSetExtras.map((extra, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          placeholder="Reklam seti adı"
                          value={extra.adsetName}
                          onChange={(e) => {
                            const next = [...form.adSetExtras];
                            next[i] = { ...next[i], adsetName: e.target.value };
                            update("adSetExtras", next);
                          }}
                          className="input flex-1 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Bütçe (kuruş)"
                          value={extra.dailyBudget || ""}
                          onChange={(e) => {
                            const next = [...form.adSetExtras];
                            next[i] = { ...next[i], dailyBudget: parseInt(String(e.target.value), 10) || 0 };
                            update("adSetExtras", next);
                          }}
                          className="input w-24 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "adSetExtras",
                              form.adSetExtras.filter((_, j) => j !== i)
                            )
                          }
                          className="text-slate-400 hover:text-red-600"
                          title="Kaldır"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {targetingLoading ? (
                <p className="text-sm text-slate-500 mb-4">Hedef kitle yükleniyor...</p>
              ) : targetingData ? (
                <TargetingSelector
                  demographics={targetingData.demographics}
                  interests={targetingData.interests}
                  behaviors={targetingData.behaviors}
                  selectedDemographics={form.selectedDemographics}
                  selectedInterests={form.selectedInterests}
                  selectedBehaviors={form.selectedBehaviors}
                  targetingLogicWithin={form.targetingLogicWithin}
                  targetingLogicBetween={form.targetingLogicBetween}
                  onToggle={toggleTargeting}
                  onLogicChange={(within, between) => {
                    if (within) update("targetingLogicWithin", within);
                    if (between) update("targetingLogicBetween", between);
                  }}
                />
              ) : (
                <p className="text-sm text-amber-600 mb-4">
                  Hedef kitle verisi yüklenemedi. Backend&apos;in çalıştığından ve Meta hedef kitle
                  dosyalarının proje kökünde olduğundan emin olun.
                </p>
              )}

              <div className="flex items-center gap-3 mt-6">
                <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                  ← Geri
                </button>
                <button type="button" className="btn-primary" onClick={handleStep2}>
                  İleri →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">
                  3
                </span>
                Kreatif
              </h3>
              <p className="text-slate-500 text-sm mb-3">
                Bu bilgiler özete dahil edilecektir. Görsel/video Meta Ads Manager&apos;da manuel eklenir.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Facebook Sayfası</label>
                  {pages.length > 0 ? (
                    <select
                      value={form.fbPageName || ""}
                      onChange={(e) => {
                        const p = pages.find((x: { page_name: string }) => x.page_name === e.target.value);
                        update("fbPageName", e.target.value);
                        if (p?.instagram_username) update("instagramHandle", p.instagram_username);
                      }}
                      className="select w-full"
                    >
                      <option value="">Sayfa seçin</option>
                      {pages.map((p: { page_id: string; page_name: string; instagram_username: string }) => (
                        <option key={p.page_id} value={p.page_name}>
                          {p.page_name}
                          {p.instagram_username ? ` (@${p.instagram_username})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      placeholder="Sayfa adı (veya Meta'dan çekilemedi)"
                      value={form.fbPageName}
                      onChange={(e) => update("fbPageName", e.target.value)}
                      className="input w-full"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Instagram hesabı</label>
                  {pages.length > 0 ? (
                    <select
                      value={form.instagramHandle ? `@${form.instagramHandle.replace(/^@/, "")}` : ""}
                      onChange={(e) => update("instagramHandle", e.target.value.replace(/^@/, "") || "")}
                      className="select w-full"
                    >
                      <option value="">Instagram seçin</option>
                      {pages.filter((p: { instagram_username: string }) => p.instagram_username).map((p: { page_id: string; instagram_username: string }) => (
                        <option key={p.page_id} value={`@${p.instagram_username}`}>
                          @{p.instagram_username}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      placeholder="@kullaniciadi"
                      value={form.instagramHandle}
                      onChange={(e) => update("instagramHandle", e.target.value.replace(/^@/, ""))}
                      className="input w-full"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Kreatif kaynağı</label>
                  <select
                    value={form.creativeSource}
                    onChange={(e) => update("creativeSource", e.target.value as "manual" | "catalog")}
                    className="select w-full"
                  >
                    <option value="manual">Manuel yükleme</option>
                    <option value="catalog">Advantage+ katalog</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Format</label>
                  <select
                    value={form.format}
                    onChange={(e) => update("format", e.target.value as "single" | "carousel")}
                    className="select w-full"
                  >
                    <option value="single">Tek görsel/video</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>
              </div>
              <input
                placeholder="Kreatif adı"
                value={form.creativeName}
                onChange={(e) => update("creativeName", e.target.value)}
                className="input w-full mb-3"
              />
              <textarea
                placeholder="Birincil metin"
                value={form.primaryText}
                onChange={(e) => update("primaryText", e.target.value)}
                className="input w-full mb-3 min-h-[80px]"
                rows={3}
              />
              <input
                placeholder="Başlık"
                value={form.headline}
                onChange={(e) => update("headline", e.target.value)}
                className="input w-full mb-3"
              />
              {(form.conversionGoal === "WEBSITE" ||
                form.conversionGoal === "APP" ||
                ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US"].includes(form.cta)) && (
                <input
                  placeholder="Hedef URL"
                  value={form.link}
                  onChange={(e) => update("link", e.target.value)}
                  className="input w-full mb-3"
                />
              )}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Eylem çağrısı (CTA)</label>
                <select
                  value={form.cta}
                  onChange={(e) => update("cta", e.target.value)}
                  className="select w-full"
                >
                  <option value="MESSAGE">Mesaj Gönder</option>
                  <option value="LEARN_MORE">Daha fazla bilgi</option>
                  <option value="SHOP_NOW">Şimdi alışveriş yap</option>
                  <option value="SIGN_UP">Kayıt ol</option>
                  <option value="CONTACT_US">Bize ulaşın</option>
                  <option value="CALL_NOW">Şimdi ara</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.multiAdvertiser}
                  onChange={(e) => update("multiAdvertiser", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">Çok reklamverenli reklamlar</span>
              </label>
              {form.conversionGoal === "MESSAGES" && (
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-600 mb-2">Sohbet ayarları</p>
                  <label className="block text-xs text-slate-500 mb-1">Karşılama mesajı</label>
                  <textarea
                    placeholder="Merhaba! Size nasıl yardımcı olabilirim?"
                    value={form.welcomeMessage}
                    onChange={(e) => update("welcomeMessage", e.target.value)}
                    className="input w-full text-sm mb-2"
                    rows={2}
                  />
                  <p className="text-xs text-slate-500 mb-2">Sıkça sorulan sorular (özet için)</p>
                  {form.faqQuestions.map((faq, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        placeholder="Soru"
                        value={faq.q}
                        onChange={(e) => {
                          const next = [...form.faqQuestions];
                          next[i] = { ...next[i], q: e.target.value };
                          update("faqQuestions", next);
                        }}
                        className="input flex-1 text-sm"
                      />
                      <input
                        placeholder="Otomatik yanıt"
                        value={faq.a}
                        onChange={(e) => {
                          const next = [...form.faqQuestions];
                          next[i] = { ...next[i], a: e.target.value };
                          update("faqQuestions", next);
                        }}
                        className="input flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "faqQuestions",
                            form.faqQuestions.filter((_, j) => j !== i)
                          )
                        }
                        className="text-slate-500 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => update("faqQuestions", [...form.faqQuestions, { q: "", a: "" }])}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    + SSS ekle
                  </button>
                </div>
              )}
              {form.conversionGoal === "CALLS" && (
                <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-600 mb-2">Arama ayarları</p>
                  <input
                    placeholder="Telefon numarası (+90 5XX XXX XX XX)"
                    value={form.phoneNumber}
                    onChange={(e) => update("phoneNumber", e.target.value)}
                    className="input w-full mb-2"
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.callbackEnabled}
                      onChange={(e) => update("callbackEnabled", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600"
                    />
                    <span className="text-sm">Geri arama isteklerini etkinleştir</span>
                  </label>
                </div>
              )}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Ek kreatifler / reklamlar</label>
                  <button
                    type="button"
                    onClick={() =>
                      update("creativeExtras", [
                        ...form.creativeExtras,
                        { creativeName: "", primaryText: "", headline: "", adName: "" },
                      ])
                    }
                    className="btn-outline text-xs py-1.5 px-3"
                  >
                    + Kreatif ekle
                  </button>
                </div>
                {form.creativeExtras.length > 0 && (
                  <div className="space-y-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    {form.creativeExtras.map((extra, i) => (
                      <div key={i} className="p-3 bg-white rounded border border-slate-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-600">Kreatif {i + 2}</span>
                          <button
                            type="button"
                            onClick={() =>
                              update(
                                "creativeExtras",
                                form.creativeExtras.filter((_, j) => j !== i)
                              )
                            }
                            className="text-slate-400 hover:text-red-600"
                            title="Kaldır"
                          >
                            ×
                          </button>
                        </div>
                        <input
                          placeholder="Kreatif adı"
                          value={extra.creativeName}
                          onChange={(e) => {
                            const next = [...form.creativeExtras];
                            next[i] = { ...next[i], creativeName: e.target.value };
                            update("creativeExtras", next);
                          }}
                          className="input w-full text-sm"
                        />
                        <textarea
                          placeholder="Birincil metin"
                          value={extra.primaryText}
                          onChange={(e) => {
                            const next = [...form.creativeExtras];
                            next[i] = { ...next[i], primaryText: e.target.value };
                            update("creativeExtras", next);
                          }}
                          className="input w-full text-sm min-h-[60px]"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="Başlık"
                            value={extra.headline}
                            onChange={(e) => {
                              const next = [...form.creativeExtras];
                              next[i] = { ...next[i], headline: e.target.value };
                              update("creativeExtras", next);
                            }}
                            className="input text-sm"
                          />
                          <input
                            placeholder="Reklam adı"
                            value={extra.adName}
                            onChange={(e) => {
                              const next = [...form.creativeExtras];
                              next[i] = { ...next[i], adName: e.target.value };
                              update("creativeExtras", next);
                            }}
                            className="input text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
                  ← Geri
                </button>
                <button type="button" className="btn-primary" onClick={handleStep3}>
                  İleri →
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">
                  4
                </span>
                Reklam
              </h3>
              <input
                placeholder="Reklam adı"
                value={form.adName}
                onChange={(e) => update("adName", e.target.value)}
                className="input w-full mb-3"
              />
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.partnershipAd}
                  onChange={(e) => update("partnershipAd", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">Ortaklık reklamı (içerik üreticiler, markalarla birlikte)</span>
              </label>
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">Takip (dönüşüm olayları)</p>
                <label className="flex items-center gap-2 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.trackWebsiteEvents}
                    onChange={(e) => update("trackWebsiteEvents", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600"
                  />
                  <span className="text-sm">İnternet sitesi olayları</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.trackAppEvents}
                    onChange={(e) => update("trackAppEvents", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600"
                  />
                  <span className="text-sm">Uygulama olayları</span>
                </label>
              </div>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.creativeTestEnabled}
                  onChange={(e) => update("creativeTestEnabled", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600"
                />
                <span className="text-sm">Kreatif testi (en fazla 5 sürüm karşılaştır)</span>
              </label>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-ghost" onClick={() => setStep(3)}>
                  ← Geri
                </button>
                <button type="button" className="btn-primary" onClick={handleStep4}>
                  Özet Oluştur
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TargetingSelector({
  demographics,
  interests,
  behaviors,
  selectedDemographics,
  selectedInterests,
  selectedBehaviors,
  targetingLogicWithin,
  targetingLogicBetween,
  onToggle,
  onLogicChange,
}: {
  demographics: { label: string; size?: string }[];
  interests: { label: string; size?: string }[];
  behaviors: { label: string; size?: string }[];
  selectedDemographics: string[];
  selectedInterests: string[];
  selectedBehaviors: string[];
  targetingLogicWithin: "or" | "and";
  targetingLogicBetween: "and" | "or";
  onToggle: (
    cat: "selectedDemographics" | "selectedInterests" | "selectedBehaviors",
    label: string
  ) => void;
  onLogicChange: (within?: "or" | "and", between?: "and" | "or") => void;
}) {
  const [searchD, setSearchD] = useState("");
  const [searchI, setSearchI] = useState("");
  const [searchB, setSearchB] = useState("");

  const filteredD = useMemo(
    () =>
      demographics.filter((x) =>
        x.label.toLowerCase().includes(searchD.toLowerCase().trim())
      ),
    [demographics, searchD]
  );
  const filteredI = useMemo(
    () =>
      interests.filter((x) =>
        x.label.toLowerCase().includes(searchI.toLowerCase().trim())
      ),
    [interests, searchI]
  );
  const filteredB = useMemo(
    () =>
      behaviors.filter((x) =>
        x.label.toLowerCase().includes(searchB.toLowerCase().trim())
      ),
    [behaviors, searchB]
  );

  const renderSection = (
    title: string,
    items: { label: string; size?: string }[],
    selected: string[],
    category: "selectedDemographics" | "selectedInterests" | "selectedBehaviors",
    search: string,
    setSearch: (s: string) => void
  ) => (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-700 mb-2">{title}</p>
      <input
        type="text"
        placeholder="Ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input w-full text-sm mb-2"
      />
      <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">Sonuç yok</p>
        ) : (
          items.map((item) => (
            <label
              key={item.label}
              className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.label)}
                onChange={() => onToggle(category, item.label)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600"
              />
              <span className="text-xs text-slate-700 truncate flex-1" title={item.label}>
                {item.label}
                {item.size && (
                  <span className="text-slate-400 ml-1">({item.size})</span>
                )}
              </span>
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        {items.length} sonuç{search ? "" : ` (toplam)`} · Seçili: {selected.length} adet
      </p>
    </div>
  );

  const selectedAll = [
    ...selectedDemographics.map((l) => ({ label: l, cat: "Demografik" as const })),
    ...selectedInterests.map((l) => ({ label: l, cat: "İlgi" as const })),
    ...selectedBehaviors.map((l) => ({ label: l, cat: "Davranış" as const })),
  ];

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
      <p className="text-sm font-medium text-slate-700 mb-3">
        Detaylı hedefleme (analiz ve raporlara göre seçin)
      </p>
      {selectedAll.length > 0 && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <p className="text-xs font-medium text-primary-800 mb-2">Seçili hedeflemeler ({selectedAll.length})</p>
          <div className="flex flex-wrap gap-2">
            {selectedAll.map(({ label, cat }) => (
              <span
                key={`${cat}-${label}`}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-primary-200 rounded text-xs text-slate-700"
              >
                <span className="text-primary-600 font-medium">{cat}:</span>
                <span className="truncate max-w-[180px]" title={label}>{label}</span>
                <button
                  type="button"
                  onClick={() => {
                    const key =
                      cat === "Demografik"
                        ? "selectedDemographics"
                        : cat === "İlgi"
                          ? "selectedInterests"
                          : "selectedBehaviors";
                    onToggle(key, label);
                  }}
                  className="text-slate-400 hover:text-red-600 ml-0.5"
                  title="Kaldır"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-white rounded-lg border border-slate-200">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Aynı kategori içi (örn. iki ilgi alanı)
          </label>
          <select
            value={targetingLogicWithin}
            onChange={(e) => onLogicChange(e.target.value as "or" | "and", undefined)}
            className="select text-sm py-1.5"
          >
            <option value="or">VEYA – biri eşleşirse yeter</option>
            <option value="and">VE – hepsi eşleşmeli</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Kategoriler arası (Demografik, İlgi, Davranış)
          </label>
          <select
            value={targetingLogicBetween}
            onChange={(e) => onLogicChange(undefined, e.target.value as "and" | "or")}
            className="select text-sm py-1.5"
          >
            <option value="and">VE – hepsi eşleşmeli</option>
            <option value="or">VEYA – biri eşleşirse yeter</option>
          </select>
        </div>
      </div>
      {renderSection(
        "Demografik Bilgiler",
        filteredD,
        selectedDemographics,
        "selectedDemographics",
        searchD,
        setSearchD
      )}
      {renderSection(
        "İlgi Alanları",
        filteredI,
        selectedInterests,
        "selectedInterests",
        searchI,
        setSearchI
      )}
      {renderSection(
        "Davranışlar",
        filteredB,
        selectedBehaviors,
        "selectedBehaviors",
        searchB,
        setSearchB
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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}
