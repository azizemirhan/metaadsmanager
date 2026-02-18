"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/Providers";
import { api, type AuthUser } from "../lib/api";

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Editör",
  viewer: "Görüntüleyen",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role !== "admin") return;
    api
      .getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentUser?.role]);

  async function updateRole(userId: string, role: string) {
    setUpdating(userId);
    setError("");
    try {
      const updated = await api.updateUser(userId, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setUpdating(null);
    }
  }

  async function toggleActive(userId: string, is_active: boolean) {
    if (userId === currentUser?.id && !is_active) {
      setError("Kendinizi devre dışı bırakamazsınız.");
      return;
    }
    setUpdating(userId);
    setError("");
    try {
      const updated = await api.updateUser(userId, { is_active });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setUpdating(null);
    }
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6">
        <p className="text-slate-600">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Kullanıcı Yönetimi</h1>
      <p className="text-slate-600 mb-6">Rolleri düzenleyin veya hesapları devre dışı bırakın.</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-48 bg-slate-100 rounded-xl" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Kullanıcı</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">E-posta</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Rol</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.username}</td>
                  <td className="px-6 py-4 text-slate-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      disabled={updating === u.id || u.id === currentUser?.id}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="input py-1.5 text-sm w-36"
                    >
                      {(["admin", "manager", "viewer"] as const).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm ${u.is_active ? "text-success" : "text-slate-400"}`}
                    >
                      {u.is_active ? "Aktif" : "Devre dışı"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        disabled={updating === u.id}
                        onClick={() => toggleActive(u.id, !u.is_active)}
                        className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                      >
                        {u.is_active ? "Devre dışı bırak" : "Etkinleştir"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
