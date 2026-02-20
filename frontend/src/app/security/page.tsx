"use client";
import { useState, useEffect } from "react";
import { api } from "../lib/api";

type TabId = "2fa" | "api-keys" | "audit-log";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  key?: string | null;
  is_active: boolean;
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
}

interface AuditEntry {
  id: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at?: string;
}

export default function SecurityPage() {
  const [tab, setTab] = useState<TabId>("2fa");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Güvenlik Ayarları</h1>
      <p className="text-gray-500 mb-6">2FA, API anahtarları ve denetim kaydı</p>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["2fa", "api-keys", "audit-log"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "2fa" ? "İki Faktörlü Doğrulama" : t === "api-keys" ? "API Anahtarları" : "Denetim Kaydı"}
          </button>
        ))}
      </div>

      {tab === "2fa" && <TwoFATab />}
      {tab === "api-keys" && <APIKeysTab />}
      {tab === "audit-log" && <AuditLogTab />}
    </div>
  );
}

// ─── 2FA Tab ──────────────────────────────────────────────────────────────────

function TwoFATab() {
  const [status, setStatus] = useState<{ enabled: boolean; configured: boolean } | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchStatus = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/security/2fa/status`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}` } }
    );
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => { fetchStatus(); }, []);

  const setup = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/security/2fa/setup`,
        { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setSetupData({ secret: data.secret, uri: data.uri });
      setMsg("");
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/security/2fa/enable`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setBackupCodes(data.backup_codes || []);
      setSetupData(null);
      setCode("");
      setMsg("2FA başarıyla etkinleştirildi!");
      fetchStatus();
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/security/2fa/disable`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setCode("");
      setMsg("2FA devre dışı bırakıldı.");
      fetchStatus();
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">İki Faktörlü Doğrulama (2FA)</h2>
            <p className="text-gray-500 text-sm mt-1">
              Hesabınızı TOTP tabanlı 2FA ile koruyun (Google Authenticator, Authy vb.)
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${status?.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {status?.enabled ? "Etkin" : "Devre Dışı"}
          </span>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.includes("başarı") || msg.includes("etkinleştir") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Backup codes */}
      {backupCodes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-800 mb-2">Yedek Kodlar (Bir kez gösterilir!)</h3>
          <p className="text-amber-700 text-sm mb-4">Bu kodları güvenli bir yere kaydedin. Telefona erişiminizi kaybederseniz kullanabilirsiniz.</p>
          <div className="grid grid-cols-4 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="bg-white border border-amber-200 rounded px-2 py-1 text-xs text-center font-mono">{c}</code>
            ))}
          </div>
          <button onClick={() => setBackupCodes([])} className="mt-4 text-sm text-amber-700 underline">Kapat</button>
        </div>
      )}

      {/* Setup flow */}
      {!status?.enabled && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          {!setupData ? (
            <>
              <p className="text-gray-600 text-sm">2FA kurmak için aşağıdaki butona tıklayın. Google Authenticator'a QR kodu ekleyeceğiz.</p>
              <button
                onClick={setup}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                2FA Kurulumu Başlat
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">1. Google Authenticator uygulamasını açın</p>
                <p className="text-sm font-medium mb-2">2. Aşağıdaki kodu manuel girin veya QR oluşturmak için URI kullanın:</p>
                <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm break-all">{setupData.secret}</div>
                <p className="text-xs text-gray-400 mt-1">otpauth URI: <span className="break-all">{setupData.uri}</span></p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">3. Uygulamadaki 6 haneli kodu girin:</p>
                <div className="flex gap-3">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="border rounded-lg px-3 py-2 w-36 text-center font-mono text-lg"
                  />
                  <button
                    onClick={enable}
                    disabled={loading || code.length !== 6}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Etkinleştir
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disable flow */}
      {status?.enabled && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <p className="text-gray-600 text-sm">2FA'yı devre dışı bırakmak için mevcut TOTP kodunuzu girin:</p>
          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="border rounded-lg px-3 py-2 w-36 text-center font-mono text-lg"
            />
            <button
              onClick={disable}
              disabled={loading || code.length !== 6}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Devre Dışı Bırak
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function APIKeysTab() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [createdKey, setCreatedKey] = useState<APIKey | null>(null);
  const [msg, setMsg] = useState("");

  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}`, "Content-Type": "application/json" };

  const fetchKeys = async () => {
    const res = await fetch(`${BASE}/api/security/api-keys`, { headers: authHeader });
    if (res.ok) { const d = await res.json(); setKeys(d.data || []); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const create = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/security/api-keys`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ name: newKeyName, expires_days: expiresDays ? parseInt(expiresDays) : null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setCreatedKey(d.data);
      setNewKeyName("");
      setExpiresDays("");
      fetchKeys();
    } catch (e: unknown) { setMsg((e as Error).message); } finally { setLoading(false); }
  };

  const revoke = async (id: string) => {
    await fetch(`${BASE}/api/security/api-keys/${id}`, { method: "DELETE", headers: authHeader });
    fetchKeys();
  };

  return (
    <div className="space-y-6">
      {msg && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{msg}</div>}

      {createdKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h3 className="font-semibold text-green-800 mb-2">Yeni API Anahtarı (Bir kez gösterilir!)</h3>
          <code className="block bg-white border border-green-200 rounded px-3 py-2 text-sm font-mono break-all">{createdKey.key}</code>
          <button onClick={() => setCreatedKey(null)} className="mt-3 text-sm text-green-700 underline">Kapat</button>
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Yeni API Anahtarı</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Anahtar adı (örn. CI/CD Pipeline)"
            className="border rounded-lg px-3 py-2 flex-1 min-w-48"
          />
          <input
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            placeholder="Son kullanma (gün, boş=süresiz)"
            type="number"
            className="border rounded-lg px-3 py-2 w-48"
          />
          <button
            onClick={create}
            disabled={loading || !newKeyName.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Oluştur
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Ad", "Prefix", "Durum", "Son Kullanım", "Son Kullanıldı", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-gray-500">{k.key_prefix}...</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${k.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {k.is_active ? "Aktif" : "İptal"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{k.expires_at ? new Date(k.expires_at).toLocaleDateString("tr") : "Süresiz"}</td>
                <td className="px-4 py-3 text-gray-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("tr") : "-"}</td>
                <td className="px-4 py-3">
                  {k.is_active && (
                    <button onClick={() => revoke(k.id)} className="text-red-600 hover:underline text-xs">İptal Et</button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Henüz API anahtarı yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (emailFilter) p.set("user_email", emailFilter);
      if (actionFilter) p.set("action", actionFilter);
      const res = await fetch(`${BASE}/api/security/audit-logs?${p}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("meta_ads_token")}` },
      });
      if (res.ok) { const d = await res.json(); setLogs(d.data || []); }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="E-posta filtrele" className="border rounded-lg px-3 py-2" />
        <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="Aksiyon filtrele (örn. user.create)" className="border rounded-lg px-3 py-2" />
        <button onClick={fetchLogs} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900">Filtrele</button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Tarih", "Kullanıcı", "Aksiyon", "Kaynak", "IP"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString("tr") : "-"}</td>
                <td className="px-4 py-3">{l.user_email || "-"}</td>
                <td className="px-4 py-3 font-mono text-xs bg-gray-50 rounded">{l.action}</td>
                <td className="px-4 py-3 text-gray-500">{l.resource_type ? `${l.resource_type}${l.resource_id ? ` #${l.resource_id.slice(0, 8)}` : ""}` : "-"}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{l.ip_address || "-"}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
