"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { api, Campaign } from "./lib/api";
import { MetricCard } from "./components/MetricCard";
import { useAccount } from "./components/Providers";

const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#10b981", "#8b5cf6"];

function formatCurrency(v: unknown) {
  const n = Number(v ?? 0);
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNum(v: unknown) {
  const n = Number(v ?? 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("tr-TR");
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  PAUSED: "Duraklatıldı",
  DELETED: "Silindi",
  ARCHIVED: "Arşivlendi"
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: "bg-success-50", text: "text-success-600", border: "border-success-200" },
  PAUSED: { bg: "bg-warning-50", text: "text-warning-600", border: "border-warning-200" },
  DELETED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  ARCHIVED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

export default function DashboardPage() {
  const { accountId } = useAccount();
  const [days, setDays] = useState(30);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError, error: summaryErr } = useQuery({
    queryKey: ["summary", days, accountId],
    queryFn: () => api.getSummary(days, accountId),
  });

  const { data: campaignsData, isLoading: campaignsLoading, isError: campaignsError, error: campaignsErr } = useQuery({
    queryKey: ["campaigns", days, accountId],
    queryFn: () => api.getCampaigns(days, accountId),
  });

  const { data: dailyData, isLoading: dailyLoading, isError: dailyError } = useQuery({
    queryKey: ["daily", days, accountId],
    queryFn: () => api.getDaily(days, accountId),
  });

  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["forecast", days, accountId],
    queryFn: () => api.getForecast(days, accountId),
  });

  const campaigns = campaignsData?.data || [];
  const summary = summaryData;
  const daily = dailyData?.data || [];
  const forecast = forecastData;
  const apiError = summaryErr || campaignsErr;
  const hasApiError = summaryError || campaignsError || dailyError;

  // Objective breakdown for pie
  const objectiveBreakdown = campaigns.reduce((acc: Record<string, number>, c: Campaign) => {
    acc[c.objective || "Other"] = (acc[c.objective || "Other"] || 0) + Number(c.spend ?? 0);
    return acc;
  }, {});
  const pieData = Object.entries(objectiveBreakdown).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  // Top 5 campaigns by spend
  const topCampaigns = [...campaigns].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0)).slice(0, 5);

  // Tıklama grafiği için sağ eksen domain (görünürlük)
  const maxClicks = daily.length ? Math.max(...daily.map((d: { clicks?: number }) => Number(d.clicks ?? 0)), 1) : 10;

  const handleExport = async () => {
    setExportLoading(true);
    try { await api.exportCsv("campaigns", days); }
    finally { setExportLoading(false); }
  };

  const Skeleton = ({ h = 20, w = "100%", className = "" }: { h?: number; w?: string; className?: string }) => (
    <div className={`skeleton ${className}`} style={{ height: h, width: w }} />
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* API Error Alert */}
      {hasApiError && (() => {
        const msg = apiError?.message || "Veriler alınamadı.";
        const isNetworkError = /failed to fetch|network error|load failed/i.test(String(msg));
        return (
          <div className="alert alert-error mb-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              <div>
                <div className="font-semibold mb-1">
                  {isNetworkError ? "Backend'e ulaşılamıyor" : "Meta API bağlantı hatası"}
                </div>
                <div className="text-red-700/80 text-sm mb-2">{msg}</div>
                <div className="text-red-600/70 text-xs space-y-1">
                  {isNetworkError ? (
                    <>
                      <p>Tarayıcıda <a href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"} target="_blank" rel="noopener noreferrer" className="underline">http://localhost:8000</a> adresini açın — API yanıt veriyorsa backend çalışıyordur; vermiyorsa <code className="bg-red-100 px-1 rounded">docker compose logs backend</code> ile kontrol edin.</p>
                      <p>Frontend Docker dışında çalışıyorsa <code className="bg-red-100 px-1 rounded">NEXT_PUBLIC_API_URL</code> değerinin doğru olduğundan emin olun.</p>
                    </>
                  ) : (
                    <p>Token, önce <strong>Ayarlar</strong> sayfasındaki / <strong>backend/settings.json</strong> içindeki değerden okunur; sadece .env güncellemek yetmez. Yeni tokenı Ayarlar sayfasından kaydedin veya settings.json içindeki META_ACCESS_TOKEN değerini güncelleyin.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* No Data Warning */}
      {!hasApiError && !summaryLoading && !campaignsLoading && campaigns.length === 0 && Number(summary?.spend ?? 0) === 0 && (
        <div className="alert alert-warning mb-6">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-amber-600 text-xs">⚠</span>
            </div>
            <div>
              <div className="font-semibold mb-1">Bu dönemde veri yok</div>
              <div className="text-amber-800/80 text-sm">
                Son {days} günde bu reklam hesabında kampanya veya harcama görünmüyor. Farklı bir periyot seçin.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Genel Bakış</h1>
          <p className="text-slate-500 text-sm">Meta Ads hesabınızın performans özeti</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            {[7, 14, 30, 90, 180].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${days === d
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                {d}G
              </button>
            ))}
          </div>
          <button
            className="btn-outline flex items-center gap-2"
            onClick={handleExport}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <>
                <LoadingIcon className="w-4 h-4 animate-spin" />
                İndiriliyor...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                CSV İndir
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {summaryLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="card p-6">
              <Skeleton h={12} w="60%" /><br />
              <Skeleton h={28} w="80%" className="mt-4" /><br />
              <Skeleton h={12} w="40%" className="mt-2" />
            </div>
          ))
        ) : (
          <>
            <MetricCard
              label="Toplam Harcama"
              value={formatCurrency(Number(summary?.spend ?? 0))}
              icon="💸"
              color="#2563eb"
              trend={Number(summary?.spend ?? 0) > 0 ? "up" : "neutral"}
              trendLabel="Bu dönem"
            />
            <MetricCard
              label="Gösterim"
              value={formatNum(Number(summary?.impressions ?? 0))}
              icon="👁️"
              color="#8b5cf6"
            />
            <MetricCard
              label="Tıklama"
              value={formatNum(Number(summary?.clicks ?? 0))}
              icon="🖱️"
              color="#10b981"
            />
            <MetricCard
              label="Ortalama CTR"
              value={`%${Number(summary?.ctr ?? 0).toFixed(2)}`}
              icon="📊"
              color={Number(summary?.ctr ?? 0) >= 1 ? "#10b981" : "#ef4444"}
              trend={Number(summary?.ctr ?? 0) >= 1 ? "up" : "down"}
              trendLabel={Number(summary?.ctr ?? 0) >= 1 ? "İyi" : "Düşük"}
            />
          </>
        )}
      </div>

      {/* Secondary KPIs + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Secondary Metrics */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
          {summaryLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="card p-6 h-28">
                <Skeleton h={60} />
              </div>
            ))
          ) : (
            <>
              <MetricCard
                label="Ort. CPC"
                value={formatCurrency(Number(summary?.cpc ?? 0))}
                icon="💰"
                color="#f59e0b"
              />
              <MetricCard
                label="CPM"
                value={formatCurrency(Number(summary?.cpm ?? 0))}
                icon="📱"
                color="#ec4899"
              />
              <MetricCard
                label="Aktif Kampanya"
                value={String(campaigns.filter(c => c.status === "ACTIVE").length)}
                icon="🟢"
                color="#10b981"
              />
            </>
          )}
        </div>

        {/* Forecast Card */}
        <div>
          {forecastLoading ? (
            <div className="card p-6 h-28">
              <Skeleton h={60} />
            </div>
          ) : forecast && forecast.days_analyzed > 0 ? (
            <div className="card p-6 bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-100">
              <div className="flex items-center gap-2 mb-2">
                <ChartIcon className="w-4 h-4 text-primary-600" />
                <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
                  Tahmini Harcama
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                {formatCurrency(forecast.forecast_total_spend)}
              </div>
              <div className="text-xs text-slate-600">
                Son {forecast.days_analyzed} gün: {formatCurrency(forecast.average_daily_spend)}/gün
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Günlük Harcama & Tıklama
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                <span className="text-slate-600">Harcama</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                <span className="text-slate-600">Tıklama</span>
              </div>
            </div>
          </div>
          {dailyLoading ? (
            <Skeleton h={280} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date_start"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v?.slice(5)}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₺${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, Math.ceil(maxClicks * 1.15) || 10]}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                  labelStyle={{ color: "#475569" }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#spendGrad)"
                  name="Harcama (₺)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clicks"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  name="Tıklama"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-6">
            Harcama Dağılımı
          </h3>
          {campaignsLoading ? (
            <Skeleton h={280} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                  formatter={(v: number) => [formatCurrency(v), "Harcama"]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#64748b" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Campaigns Table */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            En İyi Kampanyalar
          </h3>
          <a href="/campaigns" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Tümünü Gör
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
        {campaignsLoading ? (
          <Skeleton h={200} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kampanya Adı</th>
                  <th>Durum</th>
                  <th className="text-right">Harcama</th>
                  <th className="text-right">Gösterim</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">CPC</th>
                  <th className="text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map(c => {
                  const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.ARCHIVED;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="font-medium text-slate-900 max-w-[200px] truncate" title={c.name}>
                          {c.name}
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td className="text-right mono font-medium text-slate-900">
                        {formatCurrency(c.spend)}
                      </td>
                      <td className="text-right mono text-slate-600">
                        {formatNum(c.impressions)}
                      </td>
                      <td className={`text-right mono font-medium ${Number(c.ctr ?? 0) >= 1 ? "text-success-600" : "text-danger-600"}`}>
                        %{Number(c.ctr ?? 0).toFixed(2)}
                      </td>
                      <td className="text-right mono text-slate-600">
                        {formatCurrency(c.cpc)}
                      </td>
                      <td className={`text-right mono font-medium ${Number(c.roas ?? 0) >= 2 ? "text-success-600" :
                          Number(c.roas ?? 0) >= 1 ? "text-warning-600" : "text-danger-600"
                        }`}>
                        {Number(c.roas ?? 0).toFixed(2)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaigns Bar Chart */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-5">
          Kampanya Harcama Karşılaştırması
        </h3>
        {campaignsLoading ? (
          <Skeleton h={220} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCampaigns} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₺${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={150}
                tickFormatter={(v) => v.length > 22 ? v.slice(0, 22) + "..." : v}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                }}
                formatter={(v: number) => [formatCurrency(v), "Harcama"]}
              />
              <Bar
                dataKey="spend"
                fill="#2563eb"
                radius={[0, 6, 6, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
