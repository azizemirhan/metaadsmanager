"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Users,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Copy,
  ChevronRight,
} from "lucide-react";

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface Audience {
  id: string;
  name: string;
  subtype: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  description?: string;
  delivery_status?: { code: number; description: string };
  data_source?: { type: string };
  retention_days?: number;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function formatCount(low?: number, high?: number): string {
  if (!low && !high) return "Bilinmiyor";
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);
  if (low && high) return `${fmt(low)} – ${fmt(high)}`;
  return fmt(low || high || 0);
}

const SUBTYPE_LABELS: Record<string, { label: string; color: string }> = {
  CUSTOM: { label: "Özel", color: "bg-blue-100 text-blue-800" },
  WEBSITE: { label: "Web", color: "bg-purple-100 text-purple-800" },
  APP: { label: "Uygulama", color: "bg-indigo-100 text-indigo-800" },
  LOOKALIKE: { label: "Benzer", color: "bg-green-100 text-green-800" },
  OFFLINE_CONVERSION: { label: "Offline", color: "bg-orange-100 text-orange-800" },
  LIST: { label: "Liste", color: "bg-yellow-100 text-yellow-800" },
};

// ─── Kitle Kartı ──────────────────────────────────────────────────────────────

function AudienceCard({
  audience,
  onDelete,
  onCopyId,
  selected,
  onSelect,
}: {
  audience: Audience;
  onDelete: () => void;
  onCopyId: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const tag = SUBTYPE_LABELS[audience.subtype] ?? { label: audience.subtype, color: "bg-slate-100 text-slate-700" };
  const count = formatCount(
    audience.approximate_count_lower_bound,
    audience.approximate_count_upper_bound
  );

  return (
    <div
      className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
        selected ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm truncate">{audience.name}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.color}`}>
              {tag.label}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="font-mono">{audience.id}</span>
          </div>
          {audience.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{audience.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-slate-900">{count}</div>
          <div className="text-xs text-slate-400">kişi</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-slate-400">
          {audience.retention_days ? `${audience.retention_days} gün` : ""}
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onCopyId(); }}
            title="ID'yi kopyala"
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Sil"
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

type Tab = "list" | "create" | "lookalike" | "overlap";

export default function AudiencesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const [overlapResult, setOverlapResult] = useState<{
    individual_estimates: { audience_id: string; users_lower_bound: number; users_upper_bound: number }[];
    combined_estimate: { users_lower_bound?: number; users_upper_bound?: number };
  } | null>(null);

  // Form state
  const [customForm, setCustomForm] = useState({ name: "", description: "", subtype: "CUSTOM", customer_file_source: "" });
  const [lookalikeForm, setLookalikeForm] = useState({ name: "", origin_audience_id: "", country: "TR", ratio: "0.01" });

  const { data: audiencesData, isLoading } = useQuery({
    queryKey: ["audiences"],
    queryFn: () => api.getAudiences(),
  });

  const audiences: Audience[] = audiencesData?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAudience(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences"] }),
  });

  const createCustomMutation = useMutation({
    mutationFn: (body: typeof customForm) => api.createCustomAudience(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audiences"] });
      setTab("list");
      setCustomForm({ name: "", description: "", subtype: "CUSTOM", customer_file_source: "" });
    },
  });

  const createLookalikeMutation = useMutation({
    mutationFn: (body: typeof lookalikeForm) =>
      api.createLookalikeAudience({
        ...body,
        ratio: parseFloat(body.ratio),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audiences"] });
      setTab("list");
    },
  });

  const [overlapLoading, setOverlapLoading] = useState(false);

  const runOverlap = async () => {
    if (selectedIds.length < 2) return;
    setOverlapLoading(true);
    try {
      const result = await api.audienceOverlap(selectedIds.join(","));
      setOverlapResult(result);
      setTab("overlap");
    } catch (err) {
      alert(`Hata: ${err}`);
    } finally {
      setOverlapLoading(false);
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "list", label: "Kitler" },
    { id: "create", label: "Özel Kitle Oluştur" },
    { id: "lookalike", label: "Lookalike Oluştur" },
    { id: "overlap", label: "Örtüşme Analizi" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audience Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Custom ve Lookalike kitleleri yönet, örtüşme analizi yap, CSV dışa aktar.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length >= 2 && (
            <button
              onClick={runOverlap}
              disabled={overlapLoading}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {overlapLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Örtüşme Analizi ({selectedIds.length})
            </button>
          )}
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/audiences/export/csv`}
            className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            CSV İndir
          </a>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Kitle Listesi ─────────────────────────────────────── */}
      {tab === "list" && (
        <div>
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Yükleniyor...</div>
          ) : audiences.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Henüz kitle yok.</p>
              <button onClick={() => setTab("create")} className="mt-3 text-blue-600 text-sm hover:underline">
                İlk kitleyi oluştur →
              </button>
            </div>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div className="mb-3 text-xs text-blue-600 font-medium">
                  {selectedIds.length} kitle seçildi
                  <button onClick={() => setSelectedIds([])} className="ml-2 text-slate-400 hover:text-slate-700">
                    Temizle
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {audiences.map((a) => (
                  <AudienceCard
                    key={a.id}
                    audience={a}
                    selected={selectedIds.includes(a.id)}
                    onSelect={() => toggleSelect(a.id)}
                    onDelete={() => {
                      if (confirm(`"${a.name}" silinsin mi?`)) deleteMutation.mutate(a.id);
                    }}
                    onCopyId={() => copyId(a.id)}
                  />
                ))}
              </div>
              {copied && (
                <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow">
                  ID kopyalandı!
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Özel Kitle Oluştur ──────────────────────────────── */}
      {tab === "create" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl">
          <h3 className="font-semibold text-slate-900 mb-4">Özel Kitle Oluştur</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ad <span className="text-red-500">*</span></label>
              <input
                value={customForm.name}
                onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Kitle adı"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
              <select
                value={customForm.subtype}
                onChange={(e) => setCustomForm((f) => ({ ...f, subtype: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="CUSTOM">Özel</option>
                <option value="WEBSITE">Web Sitesi</option>
                <option value="APP">Uygulama</option>
                <option value="OFFLINE_CONVERSION">Offline Dönüşüm</option>
                <option value="LIST">Liste</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
              <textarea
                value={customForm.description}
                onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Opsiyonel açıklama"
              />
            </div>
            <button
              onClick={() => createCustomMutation.mutate(customForm)}
              disabled={!customForm.name || createCustomMutation.isPending}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createCustomMutation.isPending ? "Oluşturuluyor..." : "Kitle Oluştur"}
            </button>
            {createCustomMutation.isError && (
              <p className="text-sm text-red-600">{String(createCustomMutation.error)}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Lookalike Oluştur ────────────────────────────────── */}
      {tab === "lookalike" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl">
          <h3 className="font-semibold text-slate-900 mb-4">Lookalike Audience Oluştur</h3>
          <p className="text-sm text-slate-500 mb-4">
            Mevcut bir kitlenize benzer yeni kullanıcılar bulun. Kaynak kitle ID'sini girin.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ad <span className="text-red-500">*</span></label>
              <input
                value={lookalikeForm.name}
                onChange={(e) => setLookalikeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Lookalike kitle adı"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kaynak Kitle ID <span className="text-red-500">*</span>
              </label>
              <input
                value={lookalikeForm.origin_audience_id}
                onChange={(e) => setLookalikeForm((f) => ({ ...f, origin_audience_id: e.target.value }))}
                placeholder="örn. 6123456789"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Kitle listesinden bir ID seçmek için kart üzerindeki kopyala butonunu kullanın.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ülke</label>
                <input
                  value={lookalikeForm.country}
                  onChange={(e) => setLookalikeForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="TR"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Oran (1-20%)
                </label>
                <select
                  value={lookalikeForm.ratio}
                  onChange={(e) => setLookalikeForm((f) => ({ ...f, ratio: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5, 7, 10, 15, 20].map((n) => (
                    <option key={n} value={(n / 100).toFixed(2)}>
                      %{n} ({n === 1 ? "Benzerlik odaklı" : n >= 10 ? "Erişim odaklı" : ""})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => createLookalikeMutation.mutate(lookalikeForm)}
              disabled={!lookalikeForm.name || !lookalikeForm.origin_audience_id || createLookalikeMutation.isPending}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {createLookalikeMutation.isPending ? "Oluşturuluyor..." : "Lookalike Oluştur"}
            </button>
            {createLookalikeMutation.isError && (
              <p className="text-sm text-red-600">{String(createLookalikeMutation.error)}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Örtüşme Analizi ──────────────────────────────────── */}
      {tab === "overlap" && (
        <div>
          {!overlapResult ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Kitle listesinden 2+ kitle seçin, sonra "Örtüşme Analizi" butonuna tıklayın.
              </p>
              <button onClick={() => setTab("list")} className="mt-3 flex items-center gap-1 mx-auto text-blue-600 text-sm hover:underline">
                Kitleler <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overlapResult.individual_estimates.map((est) => {
                  const aud = audiences.find((a) => a.id === est.audience_id);
                  return (
                    <div key={est.audience_id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="font-semibold text-sm text-slate-900 mb-1">
                        {aud?.name ?? est.audience_id}
                      </div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCount(est.users_lower_bound, est.users_upper_bound)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">tahmini erişim</div>
                    </div>
                  );
                })}
              </div>

              {overlapResult.combined_estimate.users_lower_bound !== undefined && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
                  <div className="text-xs font-semibold text-purple-600 uppercase mb-1">
                    Birleşik Erişim Tahmini
                  </div>
                  <div className="text-3xl font-bold text-purple-800">
                    {formatCount(
                      overlapResult.combined_estimate.users_lower_bound,
                      overlapResult.combined_estimate.users_upper_bound
                    )}
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    Tüm seçili kitleler birlikte hedeflendiğinde ulaşılabilecek tahmini tekil kullanıcı sayısı
                  </p>
                </div>
              )}

              <button
                onClick={() => { setOverlapResult(null); setTab("list"); setSelectedIds([]); }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ← Kitleler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
