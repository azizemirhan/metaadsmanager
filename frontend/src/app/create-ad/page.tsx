"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAccount } from "../components/Providers";

const STEPS = ["Kampanya", "Reklam seti", "Kreatif", "Reklam"];

export default function CreateAdPage() {
  const { accountId } = useAccount();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<{
    campaignId?: string;
    adsetId?: string;
    creativeId?: string;
    adId?: string;
  }>({});
  const [form, setForm] = useState({
    campaignName: "",
    campaignObjective: "OUTCOME_TRAFFIC",
    useExistingCampaign: false,
    existingCampaignId: "",
    adsetName: "",
    dailyBudget: 10000,
    creativeName: "",
    imageUrl: "",
    videoUrl: "",
    useVideo: false,
    primaryText: "",
    headline: "",
    link: "https://www.facebook.com",
    cta: "LEARN_MORE",
    adName: "",
    publishNow: false,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", 30, accountId],
    queryFn: () => api.getCampaigns(30, accountId),
  });
  const campaigns = campaignsData?.data || [];

  const update = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const handleStep1 = async () => {
    setError(null);
    if (form.useExistingCampaign) {
      if (!form.existingCampaignId) {
        setError("Mevcut kampanya seçin.");
        return;
      }
      setCreatedIds((c) => ({ ...c, campaignId: form.existingCampaignId }));
      setStep(2);
      return;
    }
    if (!form.campaignName.trim()) {
      setError("Kampanya adı girin.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.createCampaign({
        name: form.campaignName,
        objective: form.campaignObjective,
        status: "PAUSED",
        ad_account_id: accountId,
      });
      const campaignId = res.campaign?.id;
      if (!campaignId) throw new Error("Kampanya ID dönmedi.");
      setCreatedIds((c) => ({ ...c, campaignId }));
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kampanya oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    setError(null);
    const campaignId = createdIds.campaignId || form.existingCampaignId;
    if (!campaignId) {
      setError("Kampanya seçili değil.");
      return;
    }
    if (!form.adsetName.trim()) {
      setError("Reklam seti adı girin.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.createAdset({
        campaign_id: campaignId,
        name: form.adsetName,
        daily_budget: form.dailyBudget,
        status: "PAUSED",
        ad_account_id: accountId,
      });
      const adsetId = res.adset?.id;
      if (!adsetId) throw new Error("Reklam seti ID dönmedi.");
      setCreatedIds((c) => ({ ...c, adsetId }));
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reklam seti oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setError(null);
    if (!form.creativeName.trim()) {
      setError("Kreatif adı girin.");
      return;
    }
    const hasImage = !!form.imageUrl.trim() && !form.useVideo;
    const hasVideo = !!form.videoUrl.trim() && form.useVideo;
    if (!hasImage && !hasVideo) {
      setError("Görsel URL veya video URL girin.");
      return;
    }
    setLoading(true);
    try {
      let imageHash: string | undefined;
      let videoId: string | undefined;
      if (form.useVideo && form.videoUrl) {
        const up = await api.uploadCreativeVideo(form.videoUrl, form.creativeName, accountId);
        videoId = up.video_id;
      } else if (form.imageUrl) {
        const up = await api.uploadCreativeImage(form.imageUrl, accountId);
        imageHash = up.hash;
      }
      const res = await api.createCreative({
        name: form.creativeName,
        image_hash: imageHash,
        video_id: videoId,
        link: form.link,
        message: form.primaryText,
        headline: form.headline,
        call_to_action: form.cta,
        ad_account_id: accountId,
      });
      const creativeId = res.creative?.id;
      if (!creativeId) throw new Error("Kreatif ID dönmedi.");
      setCreatedIds((c) => ({ ...c, creativeId }));
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kreatif oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    setError(null);
    if (!form.adName.trim()) {
      setError("Reklam adı girin.");
      return;
    }
    if (!createdIds.adsetId || !createdIds.creativeId) {
      setError("Reklam seti veya kreatif eksik.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.createAd({
        adset_id: createdIds.adsetId,
        creative_id: createdIds.creativeId,
        name: form.adName,
        status: form.publishNow ? "ACTIVE" : "PAUSED",
        ad_account_id: accountId,
      });
      setCreatedIds((c) => ({ ...c, adId: res.ad?.id }));
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reklam oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Reklam Oluştur</h1>
        <p className="text-slate-500 text-sm">
          Kampanya → Reklam seti → Kreatif → Reklam adımlarıyla yeni reklam oluşturun
        </p>
      </div>

      {/* Step indicator */}
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
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-success-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Reklam oluşturuldu!
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {form.publishNow 
              ? "Reklam yayında." 
              : "Reklam taslak olarak kaydedildi. Kampanyalar sayfasından yayına alabilirsiniz."}
          </p>
          <a 
            href="/campaigns" 
            className="btn-primary inline-flex items-center gap-2"
          >
            Kampanyalara git →
          </a>
        </div>
      ) : (
        <div className="card p-6">
          {step === 1 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">1</span>
                Kampanya
              </h3>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.useExistingCampaign} 
                  onChange={(e) => update("useExistingCampaign", e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Mevcut kampanya kullan</span>
              </label>
              {form.useExistingCampaign ? (
                <select
                  value={form.existingCampaignId}
                  onChange={(e) => update("existingCampaignId", e.target.value)}
                  className="select w-full mb-4"
                >
                  <option value="">Kampanya seçin</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    placeholder="Kampanya adı"
                    value={form.campaignName}
                    onChange={(e) => update("campaignName", e.target.value)}
                    className="input w-full mb-3"
                  />
                  <select
                    value={form.campaignObjective}
                    onChange={(e) => update("campaignObjective", e.target.value)}
                    className="select w-full mb-4"
                  >
                    <option value="OUTCOME_TRAFFIC">Trafik</option>
                    <option value="LINK_CLICKS">Link tıklamaları</option>
                    <option value="CONVERSIONS">Dönüşümler</option>
                    <option value="OUTCOME_ENGAGEMENT">Etkileşim</option>
                  </select>
                </>
              )}
              <button 
                className="btn-primary flex items-center gap-2"
                onClick={handleStep1} 
                disabled={loading}
              >
                {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : null}
                İleri →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">2</span>
                Reklam Seti
              </h3>
              <input
                placeholder="Reklam seti adı"
                value={form.adsetName}
                onChange={(e) => update("adsetName", e.target.value)}
                className="input w-full mb-3"
              />
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Günlük Bütçe (kuruş, örn. 10000 = 100 TL)
                </label>
                <input
                  type="number"
                  placeholder="10000"
                  value={form.dailyBudget}
                  onChange={(e) => update("dailyBudget", parseInt(e.target.value, 10) || 0)}
                  className="input w-full"
                />
              </div>
              <div className="flex items-center gap-3">
                <button 
                  className="btn-ghost"
                  onClick={() => setStep(s => s - 1)}
                  disabled={loading}
                >
                  ← Geri
                </button>
                <button 
                  className="btn-primary flex items-center gap-2"
                  onClick={handleStep2} 
                  disabled={loading}
                >
                  {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : null}
                  İleri →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">3</span>
                Kreatif
              </h3>
              <input
                placeholder="Kreatif adı"
                value={form.creativeName}
                onChange={(e) => update("creativeName", e.target.value)}
                className="input w-full mb-3"
              />
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.useVideo} 
                  onChange={(e) => update("useVideo", e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Video kullan</span>
              </label>
              {form.useVideo ? (
                <input
                  placeholder="Video URL"
                  value={form.videoUrl}
                  onChange={(e) => update("videoUrl", e.target.value)}
                  className="input w-full mb-3"
                />
              ) : (
                <input
                  placeholder="Görsel URL"
                  value={form.imageUrl}
                  onChange={(e) => update("imageUrl", e.target.value)}
                  className="input w-full mb-3"
                />
              )}
              <input
                placeholder="Birincil metin"
                value={form.primaryText}
                onChange={(e) => update("primaryText", e.target.value)}
                className="input w-full mb-3"
              />
              <input
                placeholder="Başlık"
                value={form.headline}
                onChange={(e) => update("headline", e.target.value)}
                className="input w-full mb-3"
              />
              <input
                placeholder="Hedef URL"
                value={form.link}
                onChange={(e) => update("link", e.target.value)}
                className="input w-full mb-3"
              />
              <select
                value={form.cta}
                onChange={(e) => update("cta", e.target.value)}
                className="select w-full mb-4"
              >
                <option value="LEARN_MORE">Daha fazla bilgi</option>
                <option value="SHOP_NOW">Şimdi alışveriş yap</option>
                <option value="SIGN_UP">Kayıt ol</option>
                <option value="CONTACT_US">Bize ulaşın</option>
              </select>
              <div className="flex items-center gap-3">
                <button 
                  className="btn-ghost"
                  onClick={() => setStep(s => s - 1)}
                  disabled={loading}
                >
                  ← Geri
                </button>
                <button 
                  className="btn-primary flex items-center gap-2"
                  onClick={handleStep3} 
                  disabled={loading}
                >
                  {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : null}
                  İleri →
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-md flex items-center justify-center text-xs font-bold">4</span>
                Reklam
              </h3>
              <input
                placeholder="Reklam adı"
                value={form.adName}
                onChange={(e) => update("adName", e.target.value)}
                className="input w-full mb-4"
              />
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.publishNow} 
                  onChange={(e) => update("publishNow", e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Hemen yayınla (ACTIVE)</span>
              </label>
              <div className="flex items-center gap-3">
                <button 
                  className="btn-ghost"
                  onClick={() => setStep(s => s - 1)}
                  disabled={loading}
                >
                  ← Geri
                </button>
                <button 
                  className="btn-primary flex items-center gap-2"
                  onClick={handleStep4} 
                  disabled={loading}
                >
                  {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : null}
                  {form.publishNow ? "Yayınla" : "Taslak olarak kaydet"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
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

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
