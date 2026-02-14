"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdSummariesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ad-summaries"],
    queryFn: () => api.getSavedAdSummaries(),
  });

  const { data: detail } = useQuery({
    queryKey: ["ad-summary", selectedId],
    queryFn: () => api.getSavedAdSummary(selectedId!),
    enabled: !!selectedId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdSummary(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["ad-summaries"] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const summaries = data?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kayıtlı Reklam Özetleri</h1>
            <p className="text-slate-600 mt-1">
              Reklam Oluşturma sayfasından kaydettiğiniz özetleri buradan görüntüleyebilirsiniz.
            </p>
          </div>
          <Link href="/create-ad" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
            <BookmarkIcon className="w-4 h-4" />
            Yeni reklam özeti oluştur
          </Link>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4 bg-red-50 border-red-200 text-red-800">
          {error instanceof Error ? error.message : "Kayıtlı özetler yüklenemedi."}
        </div>
      )}

      {isLoading ? (
        <div className="card p-8 text-center text-slate-500">Yükleniyor…</div>
      ) : summaries.length === 0 ? (
        <div className="card p-8 text-center text-slate-600">
          <BookmarkIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium mb-1">Henüz kayıtlı özet yok</p>
          <p className="text-sm mb-4">
            Reklam özeti oluştururken Adım 5&apos;te &quot;Kaydet&quot; butonunu kullanarak özetleri
            buraya kaydedebilirsiniz.
          </p>
          <Link href="/create-ad" className="btn-primary text-sm">
            Reklam özeti oluşturmaya git
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <div
              key={s.id}
              className="card p-4 flex items-center justify-between gap-4 hover:border-primary-200 transition-colors"
            >
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="flex-1 text-left min-w-0"
              >
                <div className="font-medium text-slate-900 truncate">{s.name}</div>
                <div className="text-sm text-slate-500 mt-0.5">{formatDate(s.created_at)}</div>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className="btn-outline text-sm py-1.5 px-3"
                >
                  Görüntüle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`"${s.name}" özetini silmek istediğinize emin misiniz?`)) {
                      deleteMutation.mutate(s.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sil"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {detail?.name ?? "Yükleniyor…"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {detail && (
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">
                  {detail.summary_text}
                </pre>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-between">
              <span className="text-sm text-slate-500">
                {detail && formatDate(detail.created_at)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (detail) {
                    navigator.clipboard.writeText(detail.summary_text);
                  }
                }}
                className="btn-outline text-sm"
              >
                Panoya kopyala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
