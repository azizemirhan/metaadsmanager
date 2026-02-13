"use client";

import { useState } from "react";
import { api } from "../lib/api";
import { useAccount } from "./Providers";

interface WhatsAppSendButtonProps {
  periodDays?: number;
  variant?: "report" | "daily";
  buttonText?: string;
  className?: string;
}

export function WhatsAppSendButton({
  periodDays = 7,
  variant = "report",
  buttonText = "WhatsApp'a gönder",
  className = "",
}: WhatsAppSendButtonProps) {
  const { accountId } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      let response;
      if (variant === "daily") {
        response = await api.sendWhatsAppDailySummary(phone, accountId);
      } else {
        response = await api.sendWhatsAppReport(phone, periodDays, accountId);
      }

      setResult({
        success: true,
        message: `✅ ${response.message}`,
      });
      setTimeout(() => {
        setIsOpen(false);
        setResult(null);
        setPhone("");
      }, 3000);
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || "Mesaj gönderilirken hata oluştu.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`btn-outline flex items-center gap-2 ${className}`}
        title="WhatsApp ile rapor gönder"
      >
        <WhatsAppIcon className="w-4 h-4 text-green-600" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">WhatsApp'a Gönder</h3>
                  <p className="text-xs text-slate-500">
                    {variant === "daily" ? "Günlük özet" : `Son ${periodDays} gün raporu`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="905551234567 (ülke kodu + numara)"
                  className="input w-full"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Uluslararası format (+ işaretsiz), örn: 905551234567
                </p>
              </div>

              {result && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    result.success
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {result.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-ghost flex-1"
                  disabled={loading}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={loading || !phone.trim()}
                >
                  {loading ? (
                    <LoadingIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <WhatsAppIcon className="w-4 h-4" />
                  )}
                  {loading ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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
