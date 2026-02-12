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

export const api = {
  // Campaigns
  getCampaigns: (days = 30) =>
    apiFetch<{ data: Campaign[]; count: number }>(`/api/campaigns?days=${days}`),
  
  getSummary: (days = 30) =>
    apiFetch<AccountSummary>(`/api/campaigns/summary?days=${days}`),
  
  getDaily: (days = 30) =>
    apiFetch<{ data: DailyData[] }>(`/api/campaigns/daily?days=${days}`),
  
  getCampaignAds: (id: string, days = 30) =>
    apiFetch<{ data: Ad[] }>(`/api/campaigns/${id}/ads?days=${days}`),

  // AI
  analyzeAll: (days = 30) =>
    apiFetch<{ analysis: string; campaign_count: number; period_days: number }>(
      `/api/ai/analyze?days=${days}`
    ),
  
  analyzeCampaign: (id: string, days = 30) =>
    apiFetch<{ campaign: Campaign; analysis: string }>(
      `/api/ai/analyze/${id}?days=${days}`
    ),

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
};

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
