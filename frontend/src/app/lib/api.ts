const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function _accountParam(adAccountId?: string | null): string {
  return adAccountId ? `&ad_account_id=${encodeURIComponent(adAccountId)}` : "";
}

export const api = {
  // Accounts (çoklu hesap)
  getAccounts: () =>
    apiFetch<{ data: { id: string; name: string }[] }>("/api/campaigns/accounts"),

  getPages: () =>
    apiFetch<{ data: { page_id: string; page_name: string; instagram_username: string }[] }>("/api/campaigns/pages"),

  getSavedAdSummaries: () =>
    apiFetch<{ data: { id: string; name: string; summary_text: string; created_at: string }[]; count: number }>(
      "/api/ad-summaries"
    ),
  getSavedAdSummary: (id: string) =>
    apiFetch<{ id: string; name: string; summary_text: string; created_at: string }>(
      `/api/ad-summaries/${id}`
    ),
  saveAdSummary: (body: { name: string; summary_text: string }) =>
    apiFetch<{ success: boolean; id: string; name: string; created_at: string }>("/api/ad-summaries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAdSummary: (id: string) =>
    apiFetch<{ success: boolean; id: string }>(`/api/ad-summaries/${id}`, { method: "DELETE" }),

  // Campaigns
  getCampaigns: (days = 30, adAccountId?: string | null) =>
    apiFetch<{ data: Campaign[]; count: number }>(`/api/campaigns?days=${days}${_accountParam(adAccountId)}`),
  
  getSummary: (days = 30, adAccountId?: string | null) =>
    apiFetch<AccountSummary>(`/api/campaigns/summary?days=${days}${_accountParam(adAccountId)}`),
  
  getDaily: (days = 30, adAccountId?: string | null) =>
    apiFetch<{ data: DailyData[] }>(`/api/campaigns/daily?days=${days}${_accountParam(adAccountId)}`),
  
  getCampaignAds: (id: string, days = 30, adAccountId?: string | null) =>
    apiFetch<{ data: Ad[] }>(`/api/campaigns/${id}/ads?days=${days}${_accountParam(adAccountId)}`),

  // Settings (kalıcı ayarlar)
  getSettings: () => apiFetch<Record<string, string>>("/api/settings"),
  updateSettings: (body: Record<string, string | undefined>) =>
    apiFetch<{ message: string; settings: Record<string, string> }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // AI
  analyzeAll: (days = 30, adAccountId?: string | null) =>
    apiFetch<{ analysis: string; campaign_count: number; period_days: number }>(
      `/api/ai/analyze?days=${days}${_accountParam(adAccountId)}`
    ),
  analyzeCampaign: (id: string, days = 30) =>
    apiFetch<{ campaign: Campaign; analysis: string }>(
      `/api/ai/analyze/${id}?days=${days}`
    ),
  getForecast: (days = 30, adAccountId?: string | null) =>
    apiFetch<{
      forecast_total_spend: number;
      average_daily_spend: number;
      total_spend_so_far?: number;
      days_analyzed: number;
      forecast_days: number;
      message?: string;
    }>(`/api/ai/forecast?days=${days}${_accountParam(adAccountId)}`),
  getAnomalies: (days = 14, adAccountId?: string | null) =>
    apiFetch<{ data: AnomalyAlert[]; count: number }>(
      `/api/ai/anomalies?days=${days}${_accountParam(adAccountId)}`
    ),

  // Faz 7: Kampanya / reklam seti güncelleme
  updateCampaignStatus: (campaignId: string, status: "ACTIVE" | "PAUSED" | "ARCHIVED") =>
    apiFetch<{ success: boolean; campaign_id: string; status: string }>(`/api/campaigns/${campaignId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  updateAdsetBudget: (adsetId: string, body: { daily_budget?: number; lifetime_budget?: number }) =>
    apiFetch<{ success: boolean; adset_id: string }>(`/api/adsets/${adsetId}/budget`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Faz 8: Reklam oluşturma
  // Hedef kitle seçenekleri (reklam özeti için)
  getTargetingOptions: () =>
    apiFetch<{ demographics: { label: string; size?: string }[]; interests: { label: string; size?: string }[]; behaviors: { label: string; size?: string }[] }>("/api/targeting/options"),

  createCampaign: (body: { name: string; objective?: string; status?: string; ad_account_id?: string | null }) =>
    apiFetch<{ success: boolean; campaign: { id: string } }>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createAdset: (body: {
    campaign_id: string;
    name: string;
    daily_budget?: number;
    lifetime_budget?: number;
    start_time?: string;
    end_time?: string;
    targeting?: Record<string, unknown>;
    status?: string;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; adset: { id: string } }>("/api/adsets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadCreativeImage: (imageUrl: string, adAccountId?: string | null) =>
    apiFetch<{ success: boolean; hash: string }>("/api/creatives/upload-image", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ad_account_id: adAccountId ?? undefined }),
    }),
  uploadCreativeVideo: (videoUrl: string, title?: string, adAccountId?: string | null) =>
    apiFetch<{ success: boolean; video_id: string }>("/api/creatives/upload-video", {
      method: "POST",
      body: JSON.stringify({ video_url: videoUrl, title, ad_account_id: adAccountId ?? undefined }),
    }),
  createCreative: (body: {
    name: string;
    image_hash?: string;
    video_id?: string;
    link?: string;
    message?: string;
    headline?: string;
    call_to_action?: string;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; creative: { id: string } }>("/api/creatives", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createAd: (body: {
    adset_id: string;
    creative_id: string;
    name: string;
    status?: string;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; ad: { id: string } }>("/api/ads", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Rapor şablonları ve hazır raporlar
  getReportTemplates: () =>
    apiFetch<{ data: ReportTemplate[]; count: number }>("/api/reports/templates"),
  exportTemplateCsv: async (templateId: string, days: number, adAccountId?: string | null) => {
    const q = `days=${days}${adAccountId ? `&ad_account_id=${encodeURIComponent(adAccountId)}` : ""}`;
    const res = await fetch(`${API_BASE}/api/reports/export/template/${templateId}?${q}`);
    if (!res.ok) throw new Error("CSV indirilemedi");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapor_${templateId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportTemplatesZip: async (templateIds: string[], days: number, adAccountId?: string | null) => {
    if (templateIds.length === 0) throw new Error("En az bir şablon seçin");
    const q = new URLSearchParams({ template_ids: templateIds.join(","), days: String(days) });
    if (adAccountId) q.set("ad_account_id", adAccountId);
    const res = await fetch(`${API_BASE}/api/reports/export/templates?${q}`);
    if (!res.ok) throw new Error("ZIP indirilemedi");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raporlar_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
  getSavedReports: () =>
    apiFetch<{ data: SavedReport[]; count: number }>("/api/reports/saved"),
  createSavedReport: (body: {
    name: string;
    template_id?: string;
    template_ids?: string[];
    days?: number;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; id: string; message: string }>("/api/reports/saved", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Kayıtlı raporun CSV dosyalarını backend/data/reports klasörüne yazar (indirme yapmaz). Uzun sürebilir; 2 dk timeout. */
  writeSavedReportCsvToDisk: async (reportId: string) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(`${API_BASE}/api/reports/saved/${reportId}/write-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        success: boolean;
        written: number;
        files: { template_id: string; file_name: string; path: string }[];
        errors?: string[];
      }>;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  },
  exportSavedReportCsv: async (reportId: string) => {
    const res = await fetch(`${API_BASE}/api/reports/saved/${reportId}/export`);
    if (!res.ok) throw new Error("İndirilemedi");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = blob.type.includes("zip") ? "zip" : "csv";
    a.download = `kayitli_rapor_${reportId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Yerelde saklanan son oluşturulmuş CSV/ZIP'i indirir. Meta API çağrısı yapmaz. */
  downloadLastExport: async (reportId: string) => {
    const res = await fetch(`${API_BASE}/api/reports/saved/${reportId}/last-export`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail || "İndirilemedi");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const disp = res.headers.get("Content-Disposition");
    const match = disp?.match(/filename="?([^";]+)"?/);
    a.download = match ? match[1].trim() : `son_rapor_${reportId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
  deleteSavedReport: (reportId: string) =>
    apiFetch<{ success: boolean }>(`/api/reports/saved/${reportId}`, { method: "DELETE" }),
  // Arka plan işleri (RabbitMQ/Celery): job başlat, durum, indir
  startExportJob: (reportId: string) =>
    apiFetch<{ job_id: string; report_id: string; job_type: string }>(`/api/jobs/export-report/${reportId}`, { method: "POST" }),
  startAnalyzeJob: (reportId: string) =>
    apiFetch<{ job_id: string; report_id: string; job_type: string }>(`/api/jobs/analyze-report/${reportId}`, { method: "POST" }),
  getJobStatus: (jobId: string) =>
    apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`),
  getJobDownload: async (jobId: string) => {
    const res = await fetch(`${API_BASE}/api/jobs/${jobId}/download`);
    if (!res.ok) throw new Error("İndirilemedi");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const disp = res.headers.get("Content-Disposition");
    const match = disp?.match(/filename="?([^";]+)"?/);
    a.download = match ? match[1].trim() : `rapor_${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  getJobPDF: (jobId: string) => `${API_BASE}/api/jobs/${jobId}/pdf`,
  getAnalysisHistory: () =>
    apiFetch<{ data: JobStatusResponse[]; count: number }>("/api/jobs/history/analyze"),
  deleteJob: (jobId: string) =>
    apiFetch<{ message: string; job_id: string }>(`/api/jobs/${jobId}`, { method: "DELETE" }),
  analyzeReport: (reportId: string) =>
    apiFetch<{
      report_id: string;
      report_name: string;
      template_title?: string | null;
      template_titles?: string[];
      analysis: string;
      row_count: number;
    }>("/api/ai/analyze-report", { method: "POST", body: JSON.stringify({ report_id: reportId }) }),

  generateAdSummaryFromReports: (body: {
    user_context: string;
    user_context_image_base64?: string | null;
    job_ids: string[];
  }) =>
    apiFetch<{ form: Record<string, unknown> }>("/api/ai/generate-ad-summary", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Stratejist Asistanı
  getBehaviorModes: () =>
    apiFetch<{ modes: BehaviorMode[] }>("/api/ai/behavior-modes"),
  
  generateStrategicAdSummary: async (body: {
    user_context: string;
    behavior_mode: string;
    raw_data_csv?: string;
    raw_data_json?: string;
    job_ids: string[];
    user_context_image_base64?: string | null;
  }) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-strategic-ad-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        form: Record<string, unknown>;
        strategy: { behavior_mode: string; mode_name: string; risk_level: string; budget_multiplier: number; applied_rules: string[]; performance_insights: { best_platforms: string[]; best_ages: string[]; excluded_platforms: string[]; excluded_ages: string[] }; lessons_applied: number };
      }>;
    } catch (e) {
      clearTimeout(t);
      if ((e as Error).name === "AbortError") {
        throw new Error("İstek zaman aşımına uğradı (2 dakika). AI yanıt vermedi.");
      }
      throw e;
    }
  },

  // Reports
  exportCsv: async (type = "campaigns", days = 30) => {
    const res = await fetch(`${API_BASE}/api/reports/export/csv?type=${type}&days=${days}`);
    if (!res.ok) throw new Error("Export hatası");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta_ads_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportHtml: async (reportType = "weekly_summary", days = 30) => {
    const res = await fetch(`${API_BASE}/api/reports/export/html?report_type=${reportType}&days=${days}`);
    if (!res.ok) throw new Error("HTML export hatası");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta_ads_${reportType}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Email
  sendReport: (toEmail: string, periodDays = 7, includeCsv = true) =>
    apiFetch<{ message: string }>("/api/email/send-report", {
      method: "POST",
      body: JSON.stringify({ to_email: toEmail, period_days: periodDays, include_csv: includeCsv }),
    }),

  // WhatsApp
  sendWhatsAppReport: (toPhone: string, periodDays = 7, adAccountId?: string | null) =>
    apiFetch<{ success: boolean; message: string; message_id?: string }>("/api/whatsapp/send-report", {
      method: "POST",
      body: JSON.stringify({ to_phone: toPhone, period_days: periodDays, ad_account_id: adAccountId }),
    }),

  sendWhatsAppDailySummary: (toPhone: string, adAccountId?: string | null) =>
    apiFetch<{ success: boolean; message: string; message_id?: string }>(`/api/whatsapp/send-daily-summary?to_phone=${encodeURIComponent(toPhone)}${adAccountId ? `&ad_account_id=${adAccountId}` : ""}`, {
      method: "POST",
    }),

  getWhatsAppHealth: () =>
    apiFetch<{ configured: boolean; phone_id?: string; message: string }>("/api/whatsapp/health"),
};

// AI Provider Types
export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  default_model: string;
}

export interface AIProvidersResponse {
  providers: AIProvider[];
}

export interface CurrentAIProviderResponse {
  provider: string;
  model: string;
  available_models: string[];
}

// Types
export interface Campaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  frequency: number;
  conversions: number;
  conversion_value: number;
  daily_budget?: number;
  lifetime_budget?: number;
}

export interface AccountSummary {
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface DailyData {
  date_start: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface Ad {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface AnomalyAlert {
  type: string;
  campaign_id: string;
  campaign_name: string;
  metric: string;
  value: number;
  message: string;
  action: string;
}

export interface ReportTemplate {
  id: string;
  title: string;
  breakdown: string;
  metrics: string;
  data_source?: string;
  csv_columns?: string[];
}

export interface SavedReport {
  id: string;
  name: string;
  template_id?: string;
  template_ids?: string[];
  days: number;
  ad_account_id?: string;
  created_at?: string;
}

export interface JobStatusResponse {
  id: string;
  report_id: string;
  job_type: "export" | "analyze";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result_text?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  pdf_path?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BehaviorMode {
  key: string;
  name: string;
  description: string;
  risk_level: string;
  budget_multiplier: number;
  creative_variations: number;
  features: string[];
}
