"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
