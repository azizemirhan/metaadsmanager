const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AUTH_TOKEN_KEY = "meta_ads_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    setStoredToken(null);
    if (typeof window !== "undefined") window.location.href = "/login";
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Oturum süresi doldu");
  }

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
  /** Kayıtlı raporun CSV dosyalarını backend/data/reports klasörüne yazar (indirme yapmaz). Uzun sürebilir; 5 dk timeout. */
  writeSavedReportCsvToDisk: async (reportId: string) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 300000);
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

  // Alerts API
  getAlertRules: (adAccountId?: string | null, isActive?: boolean | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    if (isActive !== null) params.set("is_active", String(isActive));
    return apiFetch<{ data: AlertRule[]; count: number; limit: number; offset: number }>(`/api/alerts/rules?${params}`);
  },

  getAlertRule: (ruleId: string) =>
    apiFetch<{ data: AlertRule }>(`/api/alerts/rules/${ruleId}`),

  createAlertRule: (body: {
    name: string;
    metric: string;
    condition: string;
    threshold: number;
    ad_account_id?: string | null;
    channels?: string[];
    email_to?: string | null;
    whatsapp_to?: string | null;
    cooldown_minutes?: number;
  }) =>
    apiFetch<{ success: boolean; data: AlertRule; message: string }>("/api/alerts/rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAlertRule: (ruleId: string, body: Partial<AlertRule>) =>
    apiFetch<{ success: boolean; data: AlertRule; message: string }>(`/api/alerts/rules/${ruleId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteAlertRule: (ruleId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/alerts/rules/${ruleId}`, {
      method: "DELETE",
    }),

  toggleAlertRule: (ruleId: string) =>
    apiFetch<{ success: boolean; is_active: boolean; message: string }>(`/api/alerts/rules/${ruleId}/toggle`, {
      method: "POST",
    }),

  getAlertHistory: (ruleId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (ruleId) params.set("rule_id", ruleId);
    if (limit) params.set("limit", String(limit));
    return apiFetch<{ data: AlertHistoryItem[]; count: number }>(`/api/alerts/history?${params}`);
  },

  testAlertRule: (ruleId: string, days?: number) =>
    apiFetch<{
      rule: AlertRule;
      campaigns_checked: number;
      alerts_found: number;
      results: { rule_id: string; rule_name: string; triggered: boolean; metric: string; threshold: number; actual_value: number; message?: string; campaign_id?: string; campaign_name?: string }[];
    }>(`/api/alerts/test/${ruleId}?days=${days || 7}`, {
      method: "POST",
    }),

  checkAllAlerts: (adAccountId?: string | null) =>
    apiFetch<{ message: string; checked: number; triggered: number; campaigns_checked: number }>(
      `/api/alerts/check-all${adAccountId ? `?ad_account_id=${adAccountId}` : ""}`,
      { method: "POST" }
    ),

  getAlertMetrics: () =>
    apiFetch<AlertMetricsResponse>("/api/alerts/metrics"),

  // Webhooks API
  getWebhookConfig: () =>
    apiFetch<{
      webhook_url: string;
      verify_token: string | null;
      app_secret_configured: boolean;
      is_configured: boolean;
      required_permissions: string[];
      supported_fields: string[];
    }>("/api/webhooks/config"),

  getWebhookEvents: (limit?: number, objectType?: string) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (objectType) params.set("object_type", objectType);
    return apiFetch<{ events: WebhookEvent[]; total_stored: number }>(`/api/webhooks/events?${params}`);
  },

  testWebhookDelivery: (body: {
    object_type?: string;
    object_id?: string;
    field?: string;
    new_value?: string;
  }) =>
    apiFetch<{
      status: string;
      object_type: string;
      object_id: string;
      field: string;
      new_value: string;
      message: string;
    }>("/api/webhooks/test", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Scheduled Reports API
  getScheduledReports: (adAccountId?: string | null, isActive?: boolean | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    if (isActive !== null) params.set("is_active", String(isActive));
    return apiFetch<{ data: ScheduledReport[]; count: number }>(`/api/scheduled-reports?${params}`);
  },

  getScheduledReport: (reportId: string) =>
    apiFetch<{ data: ScheduledReport }>(`/api/scheduled-reports/${reportId}`),

  createScheduledReport: (body: {
    name: string;
    report_type: string;
    days?: number;
    ad_account_id?: string | null;
    frequency: string;
    day_of_week?: number | null;
    day_of_month?: number | null;
    hour: number;
    minute: number;
    timezone?: string;
    channels: string[];
    email_to?: string | null;
    whatsapp_to?: string | null;
  }) =>
    apiFetch<{ success: boolean; data: ScheduledReport; message: string }>("/api/scheduled-reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateScheduledReport: (reportId: string, body: Partial<ScheduledReport>) =>
    apiFetch<{ success: boolean; data: ScheduledReport; message: string }>(`/api/scheduled-reports/${reportId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteScheduledReport: (reportId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/scheduled-reports/${reportId}`, {
      method: "DELETE",
    }),

  toggleScheduledReport: (reportId: string) =>
    apiFetch<{ success: boolean; is_active: boolean; message: string }>(`/api/scheduled-reports/${reportId}/toggle`, {
      method: "POST",
    }),

  runScheduledReportNow: (reportId: string) =>
    apiFetch<{ success: boolean; task_id: string; message: string }>(`/api/scheduled-reports/${reportId}/run-now`, {
      method: "POST",
    }),

  getScheduledReportLogs: (reportId: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    return apiFetch<{ data: ScheduledReportLog[]; count: number }>(`/api/scheduled-reports/${reportId}/logs?${params}`);
  },

  getScheduledReportMetadata: () =>
    apiFetch<{
      frequencies: { id: string; name: string; description: string; examples: string[] }[];
      days_of_week: { id: number; name: string }[];
      report_types: { id: string; name: string; description: string }[];
      hours: number[];
      minutes: number[];
    }>("/api/scheduled-reports/metadata/frequencies"),

  // Campaign Automation API
  getAutomationRules: (adAccountId?: string | null, isActive?: boolean | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    if (isActive !== null && isActive !== undefined) params.set("is_active", String(isActive));
    return apiFetch<{ data: AutomationRule[]; count: number }>(`/api/automation/rules?${params}`);
  },

  createAutomationRule: (body: {
    name: string;
    description?: string;
    metric: string;
    condition: string;
    threshold: number;
    action: string;
    action_value?: number;
    ad_account_id?: string | null;
    campaign_ids?: string[];
    notify_email?: string;
    notify_whatsapp?: string;
    cooldown_minutes?: number;
  }) =>
    apiFetch<{ success: boolean; data: AutomationRule }>("/api/automation/rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAutomationRule: (ruleId: string, body: Partial<AutomationRule>) =>
    apiFetch<{ success: boolean; data: AutomationRule }>(`/api/automation/rules/${ruleId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteAutomationRule: (ruleId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/automation/rules/${ruleId}`, {
      method: "DELETE",
    }),

  toggleAutomationRule: (ruleId: string) =>
    apiFetch<{ success: boolean; is_active: boolean; message: string }>(`/api/automation/rules/${ruleId}/toggle`, {
      method: "POST",
    }),

  runAutomationRule: (ruleId: string, dryRun = false) =>
    apiFetch<{ rule: AutomationRule; dry_run: boolean; triggered_count: number; results: AutomationResult[] }>(
      `/api/automation/rules/${ruleId}/run?dry_run=${dryRun}`,
      { method: "POST" }
    ),

  runAllAutomationRules: (adAccountId?: string | null, dryRun = false) => {
    const params = new URLSearchParams({ dry_run: String(dryRun) });
    if (adAccountId) params.set("ad_account_id", adAccountId);
    return apiFetch<{ rules_checked: number; total_triggered: number; dry_run: boolean; results: AutomationResult[] }>(
      `/api/automation/run-all?${params}`,
      { method: "POST" }
    );
  },

  getAutomationLogs: (ruleId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (ruleId) params.set("rule_id", ruleId);
    if (limit) params.set("limit", String(limit));
    return apiFetch<{ data: AutomationLog[]; count: number }>(`/api/automation/logs?${params}`);
  },

  getAutomationMeta: () =>
    apiFetch<{
      metrics: { id: string; name: string; unit: string }[];
      conditions: { id: string; name: string; description: string }[];
      actions: { id: string; name: string; description: string; requires_value?: boolean }[];
      examples: { name: string; metric: string; condition: string; threshold: number; action: string; action_value?: number; description: string }[];
    }>("/api/automation/meta"),

  // Audience Management API
  getAudiences: (adAccountId?: string | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    return apiFetch<{ data: Audience[]; count: number }>(`/api/audiences?${params}`);
  },

  createCustomAudience: (body: {
    name: string;
    description?: string;
    customer_file_source?: string;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; data: Audience }>("/api/audiences/custom", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createLookalikeAudience: (body: {
    source_audience_id: string;
    name: string;
    country: string;
    ratio?: number;
    ad_account_id?: string | null;
  }) =>
    apiFetch<{ success: boolean; data: Audience }>("/api/audiences/lookalike", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteAudience: (audienceId: string, adAccountId?: string | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    return apiFetch<{ success: boolean; message: string }>(`/api/audiences/${audienceId}?${params}`, {
      method: "DELETE",
    });
  },

  audienceOverlap: (audienceIds: string, adAccountId?: string | null) => {
    const params = new URLSearchParams({ audience_ids: audienceIds });
    if (adAccountId) params.set("ad_account_id", adAccountId);
    return apiFetch<{ overlap: AudienceOverlapResult[] }>(`/api/audiences/overlap?${params}`);
  },

  exportAudiencesCsv: async (adAccountId?: string | null) => {
    const params = new URLSearchParams();
    if (adAccountId) params.set("ad_account_id", adAccountId);
    const res = await fetch(`${API_BASE}/api/audiences/export/csv?${params}`);
    if (!res.ok) throw new Error("CSV indirilemedi");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audiences_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Competitor Analysis API
  searchCompetitorAds: (params: {
    q?: string;
    countries?: string;
    ad_type?: string;
    active_status?: string;
    page_ids?: string;
    date_min?: string;
    date_max?: string;
    limit?: number;
  }) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.countries) p.set("countries", params.countries);
    if (params.ad_type) p.set("ad_type", params.ad_type);
    if (params.active_status) p.set("active_status", params.active_status);
    if (params.page_ids) p.set("page_ids", params.page_ids);
    if (params.date_min) p.set("date_min", params.date_min);
    if (params.date_max) p.set("date_max", params.date_max);
    if (params.limit) p.set("limit", String(params.limit));
    return apiFetch<{ ads: CompetitorAd[]; total: number; has_next: boolean }>(`/api/competitor/search?${p}`);
  },

  getCompetitorPage: (pageId: string) =>
    apiFetch<{ id: string; name: string; category?: string; fan_count?: number; active_ads?: number; total_ads?: number }>(`/api/competitor/page/${pageId}`),

  analyzeCompetitor: (pageId: string, countries = "TR", limit = 50) =>
    apiFetch<{
      page_id: string;
      total_ads: number;
      active_ads: number;
      inactive_ads: number;
      avg_body_length: number;
      common_keywords: { word: string; count: number }[];
      ads: CompetitorAd[];
    }>(`/api/competitor/analyze?page_id=${encodeURIComponent(pageId)}&countries=${countries}&limit=${limit}`),

  // Analytics Advanced API
  runABTest: (body: {
    campaign_ids: string[];
    metric: string;
    days?: number;
  }) =>
    apiFetch<ABTestResult>("/api/analytics/ab-test", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getCohortAnalysis: (params: {
    days?: number;
    cohort_by?: string;
    metric?: string;
    ad_account_id?: string | null;
  }) => {
    const p = new URLSearchParams();
    if (params.days) p.set("days", String(params.days));
    if (params.cohort_by) p.set("cohort_by", params.cohort_by);
    if (params.metric) p.set("metric", params.metric);
    if (params.ad_account_id) p.set("ad_account_id", params.ad_account_id);
    return apiFetch<CohortAnalysisResult>(`/api/analytics/cohort?${p}`);
  },

  runAttributionModel: (body: {
    model: string;
    days?: number;
    ad_account_id?: string | null;
  }) =>
    apiFetch<AttributionResult>("/api/analytics/attribution", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getCustomMetrics: () =>
    apiFetch<{ data: CustomMetric[]; count: number }>("/api/analytics/custom-metrics"),

  createCustomMetric: (body: {
    name: string;
    formula: string;
    description?: string;
    format?: string;
    unit?: string;
  }) =>
    apiFetch<{ success: boolean; data: CustomMetric }>("/api/analytics/custom-metrics", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteCustomMetric: (metricId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/analytics/custom-metrics/${metricId}`, {
      method: "DELETE",
    }),

  calculateCustomMetric: (metricId: string, adAccountId?: string | null, days = 30) => {
    const params = new URLSearchParams({ days: String(days) });
    if (adAccountId) params.set("ad_account_id", adAccountId);
    return apiFetch<{
      metric: CustomMetric;
      results: { campaign_id: string; campaign_name: string; value: number | null; error?: string }[];
      days: number;
    }>(`/api/analytics/custom-metrics/${metricId}/calculate?${params}`, {
      method: "POST",
    });
  },

  // Auth (login/register token dışında çağrılır; 401'de yönlendirme yine apiFetch'te)
  authLogin: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  authRegister: (email: string, username: string, password: string, role?: string) =>
    apiFetch<{ access_token: string; token_type: string; user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password, role: role || "viewer" }),
    }),
  authMe: () => apiFetch<AuthUser>("/api/auth/me"),

  // Kullanıcı yönetimi (admin)
  getUsers: () => apiFetch<AuthUser[]>("/api/users"),
  updateUser: (userId: string, body: { role?: string; is_active?: boolean }) =>
    apiFetch<AuthUser>(`/api/users/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
}

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

// Webhook Types
export interface WebhookEvent {
  object_type: string;
  object_id: string;
  field: string;
  value: Record<string, unknown>;
  time: string;
}

// Scheduled Report Types
export interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  days: number;
  ad_account_id?: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  hour: number;
  minute: number;
  timezone: string;
  channels: string[];
  email_to?: string;
  whatsapp_to?: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  created_at?: string;
}

export interface ScheduledReportLog {
  id: string;
  scheduled_report_id: string;
  status: "success" | "failed" | "running";
  started_at: string;
  completed_at?: string;
  summary_data?: {
    campaign_count: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    avg_ctr: number;
  };
  ai_analysis?: string;
  error_message?: string;
  channels_sent: string[];
}

// Alert Types
export interface AlertRule {
  id: string;
  name: string;
  metric: "ctr" | "roas" | "spend" | "cpc" | "cpm" | "impressions" | "clicks" | "frequency";
  condition: "lt" | "gt" | "change_pct";
  threshold: number;
  ad_account_id?: string | null;
  channels: string[];
  email_to?: string;
  whatsapp_to?: string;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered?: string;
  trigger_count: number;
  created_at?: string;
}

export interface AlertHistoryItem {
  id: string;
  rule_id: string;
  campaign_id?: string;
  campaign_name?: string;
  metric: string;
  threshold: number;
  actual_value: number;
  message: string;
  channels_sent: string[];
  sent_at: string;
}

export interface AlertMetricInfo {
  id: string;
  name: string;
  format: string;
  example: number;
}

export interface AlertConditionInfo {
  id: string;
  name: string;
  description: string;
}

export interface AlertChannelInfo {
  id: string;
  name: string;
  requires: string;
}

export interface AlertMetricsResponse {
  metrics: AlertMetricInfo[];
  conditions: AlertConditionInfo[];
  channels: AlertChannelInfo[];
  examples: { name: string; metric: string; condition: string; threshold: number; description: string }[];
}

// Automation Types
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: "lt" | "gt";
  threshold: number;
  action: "pause" | "resume" | "notify" | "budget_decrease" | "budget_increase";
  action_value?: number;
  ad_account_id?: string | null;
  campaign_ids?: string[];
  notify_email?: string;
  notify_whatsapp?: string;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered?: string;
  trigger_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  campaign_id: string;
  campaign_name?: string;
  action_taken: string;
  metric: string;
  threshold: number;
  actual_value: number;
  success: boolean;
  message: string;
  error?: string;
  executed_at: string;
}

export interface AutomationResult {
  campaign_id: string;
  campaign_name: string;
  metric: string;
  actual_value: number;
  threshold: number;
  action: string;
  success: boolean;
  message: string;
  error?: string;
}

// Audience Types
export interface Audience {
  id: string;
  name: string;
  description?: string;
  subtype: string;
  approximate_count?: number;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  data_source?: { type: string; creation_params?: Record<string, unknown> };
  delivery_status?: { code: number; description: string };
  operation_status?: { code: number; description: string };
  time_created?: string;
  time_updated?: string;
  lookalike_spec?: { ratio: number; country: string; starting_ratio?: number };
}

export interface AudienceOverlapResult {
  audience_id_1: string;
  audience_id_2: string;
  audience_name_1?: string;
  audience_name_2?: string;
  overlap_estimate?: number;
  audience_1_size?: number;
  audience_2_size?: number;
  overlap_percentage?: number;
}

// Competitor Ad Types
export interface CompetitorAd {
  id: string;
  page_id?: string;
  page_name?: string;
  body?: string;
  bodies?: string[];
  title?: string;
  caption?: string;
  description?: string;
  snapshot_url?: string;
  start_date?: string;
  stop_date?: string;
  countries?: string[];
  bylines?: string[];
  is_active: boolean;
}

// Analytics Advanced Types
export interface ABTestVariant {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface ABTestComparison {
  variant_a: string;
  variant_b: string;
  metric: string;
  value_a: number;
  value_b: number;
  z_score: number;
  p_value: number;
  significant: boolean;
  winner?: string;
  confidence: number;
}

export interface ABTestResult {
  variants: ABTestVariant[];
  comparisons: ABTestComparison[];
  winner?: string;
  metric: string;
  days: number;
}

export interface CohortGroup {
  cohort: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  days: number;
}

export interface CohortAnalysisResult {
  cohorts: CohortGroup[];
  cohort_by: string;
  metric: string;
  days: number;
}

export interface AttributionWeight {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  conversions: number;
  attributed_weight: number;
  attributed_conversions: number;
}

export interface AttributionResult {
  model: string;
  model_name: string;
  weights: AttributionWeight[];
  total_conversions: number;
  days: number;
}

// Custom Metric Types
export interface CustomMetric {
  id: string;
  name: string;
  formula: string;
  description?: string;
  format?: string;
  unit?: string;
  created_at?: string;
}
