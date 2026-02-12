"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "./AccountContext";

const nav = [
  { href: "/", label: "Dashboard", icon: "⬛" },
  { href: "/campaigns", label: "Kampanyalar", icon: "📢" },
  { href: "/analytics", label: "Analitik", icon: "📈" },
  { href: "/ai-insights", label: "AI Analiz", icon: "🤖" },
  { href: "/reports", label: "Raporlar", icon: "📄" },
  { href: "/settings", label: "Ayarlar", icon: "⚙️" },
];

export function Sidebar() {
  const path = usePathname();
  const { accounts, selectedAccountId, setSelectedAccountId, loading: accountsLoading } = useAccount();

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      background: "var(--bg-secondary)",
      borderRight: "1px solid var(--border)",
      padding: "24px 0",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "0 20px 28px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: "var(--meta-blue)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>f</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Meta Ads</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Dashboard</div>
          </div>
        </div>
      </div>

      {/* Account selector */}
      {accounts.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Reklam Hesabi
          </div>
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value || null)}
            style={{
              width: "100%",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              padding: "7px 8px",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">Varsayilan hesap</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name || acc.id} {acc.currency ? `(${acc.currency})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        {nav.map(item => {
          const active = path === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 4,
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "rgba(24,119,242,0.12)" : "transparent",
                borderLeft: active ? "2px solid var(--meta-blue)" : "2px solid transparent",
                transition: "all 0.15s",
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "0 20px", fontSize: 11, color: "var(--text-muted)" }}>
        <div style={{ background: "rgba(24,119,242,0.06)", border: "1px solid rgba(24,119,242,0.15)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ color: "var(--meta-blue)", fontWeight: 600, marginBottom: 4 }}>🤖 AI Destekli</div>
          <div>Claude AI ile akıllı reklam optimizasyonu</div>
        </div>
      </div>
    </aside>
  );
}
