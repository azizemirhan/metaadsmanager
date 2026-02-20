"use client";
import { useState, useEffect } from "react";

type TabId = "config" | "jobs";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const authHeader = () => ({
  Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("meta_ads_token") : ""}`,
  "Content-Type": "application/json",
});

interface CloudJob {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  file_size_bytes?: number;
  status: string;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export default function CloudExportPage() {
  const [tab, setTab] = useState<TabId>("config");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Cloud Export</h1>
      <p className="text-gray-500 mb-6">AWS S3 veya Google Cloud Storage'a rapor gönderme ve otomatik arşivleme</p>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["config", "jobs"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "config" ? "Yapılandırma" : "Export İşleri"}
          </button>
        ))}
      </div>

      {tab === "config" && <ConfigTab />}
      {tab === "jobs" && <JobsTab />}
    </div>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const [provider, setProvider] = useState("s3");
  const [s3, setS3] = useState({ access_key_id: "", secret_access_key: "", region: "us-east-1", bucket: "" });
  const [gcs, setGcs] = useState({ project_id: "", credentials_json: "", bucket: "" });
  const [archive, setArchive] = useState({ auto_archive: false, prefix: "meta-ads-archive/", retention_days: 90 });
  const [msg, setMsg] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/cloud-export/config`, { headers: authHeader() }).then(async (res) => {
      if (!res.ok) return;
      const d = await res.json();
      setProvider(d.provider || "s3");
      if (d.s3) {
        setS3((prev) => ({ ...prev, region: d.s3.region || "us-east-1", bucket: d.s3.bucket || "" }));
      }
      if (d.gcs) {
        setGcs((prev) => ({ ...prev, project_id: d.gcs.project_id || "" }));
      }
      if (d.archive) {
        setArchive({ auto_archive: d.archive.auto_archive, prefix: d.archive.prefix, retention_days: d.archive.retention_days });
      }
    });
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        provider,
        auto_archive: archive.auto_archive,
        prefix: archive.prefix,
        retention_days: archive.retention_days,
      };
      if (provider === "s3") {
        if (s3.access_key_id) body.aws_access_key_id = s3.access_key_id;
        if (s3.secret_access_key) body.aws_secret_access_key = s3.secret_access_key;
        body.aws_region = s3.region;
        body.bucket_s3 = s3.bucket;
      } else {
        body.gcs_project_id = gcs.project_id;
        if (gcs.credentials_json) body.gcs_credentials_json = gcs.credentials_json;
        body.bucket_gcs = gcs.bucket;
      }
      const res = await fetch(`${BASE}/api/cloud-export/config`, { method: "PUT", headers: authHeader(), body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setMsg("Yapılandırma kaydedildi.");
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const bucket = provider === "s3" ? s3.bucket : gcs.bucket;
      if (!bucket) { setTestResult({ success: false, error: "Bucket adı girilmedi." }); return; }
      const res = await fetch(`${BASE}/api/cloud-export/test`, {
        method: "POST", headers: authHeader(), body: JSON.stringify({ provider, bucket }),
      });
      const d = await res.json();
      setTestResult(d);
    } catch (e: unknown) { setTestResult({ success: false, error: (e as Error).message }); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700">{msg}</div>}

      {/* Provider selection */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Depolama Sağlayıcısı</h2>
        <div className="grid grid-cols-2 gap-4">
          {["s3", "gcs"].map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`p-5 rounded-xl border-2 text-left ${provider === p ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="font-semibold text-lg">{p === "s3" ? "AWS S3" : "Google Cloud Storage"}</div>
              <div className="text-gray-500 text-sm mt-1">{p === "s3" ? "Amazon Web Services S3 Bucket" : "Google Cloud GCS Bucket"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* S3 config */}
      {provider === "s3" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">AWS S3 Yapılandırması</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Access Key ID</label>
              <input type="password" value={s3.access_key_id} onChange={(e) => setS3({ ...s3, access_key_id: e.target.value })} className="border rounded-lg px-3 py-2 w-full font-mono text-sm" placeholder="AKIA..." />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Secret Access Key</label>
              <input type="password" value={s3.secret_access_key} onChange={(e) => setS3({ ...s3, secret_access_key: e.target.value })} className="border rounded-lg px-3 py-2 w-full font-mono text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Region</label>
              <input value={s3.region} onChange={(e) => setS3({ ...s3, region: e.target.value })} className="border rounded-lg px-3 py-2 w-full" placeholder="us-east-1" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Bucket Adı</label>
              <input value={s3.bucket} onChange={(e) => setS3({ ...s3, bucket: e.target.value })} className="border rounded-lg px-3 py-2 w-full" placeholder="my-meta-ads-reports" />
            </div>
          </div>
        </div>
      )}

      {/* GCS config */}
      {provider === "gcs" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">Google Cloud Storage Yapılandırması</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Proje ID</label>
              <input value={gcs.project_id} onChange={(e) => setGcs({ ...gcs, project_id: e.target.value })} className="border rounded-lg px-3 py-2 w-full" placeholder="my-project-123" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Bucket Adı</label>
              <input value={gcs.bucket} onChange={(e) => setGcs({ ...gcs, bucket: e.target.value })} className="border rounded-lg px-3 py-2 w-full" placeholder="my-meta-ads-bucket" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium block mb-1">Service Account JSON</label>
              <textarea value={gcs.credentials_json} onChange={(e) => setGcs({ ...gcs, credentials_json: e.target.value })} rows={5} className="border rounded-lg px-3 py-2 w-full font-mono text-xs" placeholder='{"type": "service_account", "project_id": "...", ...}' />
            </div>
          </div>
        </div>
      )}

      {/* Archive settings */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Otomatik Arşivleme</h2>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="autoArchive" checked={archive.auto_archive} onChange={(e) => setArchive({ ...archive, auto_archive: e.target.checked })} />
          <label htmlFor="autoArchive" className="text-sm font-medium">Otomatik arşivlemeyi etkinleştir</label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Arşiv Öneki (Prefix)</label>
            <input value={archive.prefix} onChange={(e) => setArchive({ ...archive, prefix: e.target.value })} className="border rounded-lg px-3 py-2 w-full font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Saklama Süresi (gün)</label>
            <input type="number" value={archive.retention_days} onChange={(e) => setArchive({ ...archive, retention_days: parseInt(e.target.value) || 90 })} className="border rounded-lg px-3 py-2 w-full" />
          </div>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`p-4 rounded-xl ${testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {testResult.success ? "✓ Bağlantı başarılı!" : `✗ Bağlantı hatası: ${testResult.error}`}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={save} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">Kaydet</button>
        <button onClick={testConnection} disabled={loading} className="border px-6 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">Bağlantıyı Test Et</button>
      </div>
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobsTab() {
  const [jobs, setJobs] = useState<CloudJob[]>([]);
  const [filePath, setFilePath] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    const res = await fetch(`${BASE}/api/cloud-export/jobs`, { headers: authHeader() });
    if (res.ok) { const d = await res.json(); setJobs(d.data || []); }
  };

  useEffect(() => { fetchJobs(); }, []);

  const exportFile = async () => {
    if (!filePath.trim()) { setMsg("Dosya yolu girilmeli."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/cloud-export/export`, {
        method: "POST", headers: authHeader(), body: JSON.stringify({ file_path: filePath }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setMsg("Dosya başarıyla yüklendi.");
      setFilePath("");
      fetchJobs();
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  const archiveAll = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`${BASE}/api/cloud-export/archive`, {
        method: "POST", headers: authHeader(), body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setMsg(`Arşivleme tamamlandı. ${d.uploaded} dosya yüklendi.`);
      fetchJobs();
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setArchiving(false); }
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "bg-green-100 text-green-700";
    if (s === "failed") return "bg-red-100 text-red-700";
    if (s === "running") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  const formatBytes = (n?: number) => {
    if (!n) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {msg && <div className="p-3 rounded-lg text-sm bg-blue-50 text-blue-700">{msg}</div>}

      <div className="flex gap-3 flex-wrap">
        <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="Sunucudaki dosya yolu (data/reports/...)" className="border rounded-lg px-3 py-2 flex-1" />
        <button onClick={exportFile} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">Dosya Yükle</button>
        <button onClick={archiveAll} disabled={archiving} className="border border-orange-300 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-50 disabled:opacity-50 text-sm">
          {archiving ? "Arşivleniyor..." : "Tümünü Arşivle"}
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Tarih", "Sağlayıcı", "Bucket", "Nesne Anahtarı", "Boyut", "Durum"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{j.created_at ? new Date(j.created_at).toLocaleString("tr") : "-"}</td>
                <td className="px-4 py-3 font-medium uppercase text-xs">{j.provider}</td>
                <td className="px-4 py-3 text-gray-500">{j.bucket}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs max-w-xs truncate" title={j.object_key}>{j.object_key}</td>
                <td className="px-4 py-3 text-gray-500">{formatBytes(j.file_size_bytes)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span>
                  {j.error_message && <p className="text-red-500 text-xs mt-0.5 truncate max-w-xs" title={j.error_message}>{j.error_message}</p>}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Henüz export işi yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
