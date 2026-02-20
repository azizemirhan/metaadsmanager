"use client";

import { useState } from "react";
import { Search, ExternalLink, Globe, Filter, RefreshCw, BarChart2, TrendingUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Ad {
  id: string;
  page_id: string;
  page_name: string;
  body: string;
  title: string;
  caption: string;
  description: string;
  snapshot_url: string;
  start_date: string;
  stop_date: string;
  countries: string[];
  is_active: boolean;
}

interface Keyword {
  word: string;
  count: number;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("meta_ads_token");
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const COUNTRY_OPTIONS = [
  { code: "TR", name: "Türkiye" },
  { code: "US", name: "ABD" },
  { code: "DE", name: "Almanya" },
  { code: "GB", name: "İngiltere" },
  { code: "FR", name: "Fransa" },
  { code: "NL", name: "Hollanda" },
  { code: "AE", name: "BAE" },
  { code: "SA", name: "Suudi Arabistan" },
];

// ─── Ad Kartı ─────────────────────────────────────────────────────────────────

function AdCard({ ad }: { ad: Ad }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900 text-sm">{ad.page_name || "Bilinmeyen Sayfa"}</div>
          <div className="text-xs text-slate-400">{ad.page_id}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              ad.is_active
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {ad.is_active ? "Aktif" : "Pasif"}
          </span>
          {ad.snapshot_url && (
            <a
              href={ad.snapshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700"
              title="Meta Reklam Kitaplığı'nda Görüntüle"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* İçerik */}
      <div className="p-4">
        {ad.title && (
          <div className="font-semibold text-slate-900 text-sm mb-1">{ad.title}</div>
        )}
        {ad.body && (
          <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{ad.body}</p>
        )}
        {ad.description && (
          <p className="text-xs text-slate-400 mt-1 italic">{ad.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          {ad.start_date ? new Date(ad.start_date).toLocaleDateString("tr-TR") : "—"}
          {ad.stop_date ? ` → ${new Date(ad.stop_date).toLocaleDateString("tr-TR")}` : " → Devam ediyor"}
        </span>
        {ad.countries.length > 0 && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {ad.countries.slice(0, 3).join(", ")}
            {ad.countries.length > 3 && ` +${ad.countries.length - 3}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function CompetitorPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageId, setPageId] = useState("");
  const [country, setCountry] = useState("TR");
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [limit, setLimit] = useState(25);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsCount, setAdsCount] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    total_ads: number;
    active_ads: number;
    inactive_ads: number;
    avg_body_length: number;
    common_keywords: Keyword[];
  } | null>(null);

  const search = async () => {
    if (!searchTerm && !pageId) {
      setError("Arama terimi veya sayfa ID'si girin.");
      return;
    }
    setLoading(true);
    setError("");
    setAds([]);
    setAnalysis(null);
    try {
      const params = new URLSearchParams({
        countries: country,
        active_status: activeStatus,
        limit: String(limit),
      });
      if (searchTerm) params.set("q", searchTerm);
      if (pageId) params.set("page_ids", pageId);

      const result = await apiFetch<{ ads: Ad[]; count: number }>(
        `/api/competitor/search?${params}`
      );
      setAds(result.ads);
      setAdsCount(result.count);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const analyze = async () => {
    if (!pageId) {
      setError("Analiz için Sayfa ID'si gerekli.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const result = await apiFetch<{
        total_ads: number;
        active_ads: number;
        inactive_ads: number;
        avg_body_length: number;
        common_keywords: Keyword[];
        ads: Ad[];
      }>(`/api/competitor/analyze?page_id=${encodeURIComponent(pageId)}&countries=${country}&limit=50`);
      setAnalysis(result);
      setAds(result.ads);
      setAdsCount(result.total_ads);
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const activeAds = ads.filter((a) => a.is_active);
  const inactiveAds = ads.filter((a) => !a.is_active);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Başlık */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rakip Analizi</h1>
        <p className="text-sm text-slate-500 mt-1">
          Meta Ads Library üzerinden rakiplerin aktif ve geçmiş reklamlarını incele.
        </p>
      </div>

      {/* Arama Formu */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              Arama Terimi
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="örn. ayakkabı, sigorta, e-ticaret..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              Sayfa ID (rakip sayfa)
            </label>
            <input
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder="örn. 123456789"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              Ülke
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Durum
              </label>
              <select
                value={activeStatus}
                onChange={(e) => setActiveStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">Tümü</option>
                <option value="ACTIVE">Sadece Aktif</option>
                <option value="INACTIVE">Sadece Pasif</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={search}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Aranıyor..." : "Ara"}
          </button>
          {pageId && (
            <button
              onClick={analyze}
              disabled={analyzing}
              className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
              {analyzing ? "Analiz Ediliyor..." : "Sayfa Analizi"}
            </button>
          )}
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Analiz Özeti */}
      {analysis && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Toplam Reklam", value: analysis.total_ads, color: "text-slate-900" },
            { label: "Aktif", value: analysis.active_ads, color: "text-green-700" },
            { label: "Pasif", value: analysis.inactive_ads, color: "text-slate-500" },
            { label: "Ort. Metin Uzunluğu", value: `${analysis.avg_body_length} kr`, color: "text-blue-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}

          {analysis.common_keywords.length > 0 && (
            <div className="col-span-2 md:col-span-4 bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> En Sık Kelimeler
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.common_keywords.map(({ word, count }) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    {word}
                    <span className="text-blue-500">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sonuçlar */}
      {ads.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              {adsCount} reklam bulundu
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {activeAds.length} aktif
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                {inactiveAds.length} pasif
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        </div>
      )}

      {!loading && ads.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Arama yaparak rakip reklamlarını görüntüleyin.</p>
          <p className="text-xs mt-1">Meta Ads Library'den gerçek zamanlı reklam verisi çekilir.</p>
        </div>
      )}
    </div>
  );
}
