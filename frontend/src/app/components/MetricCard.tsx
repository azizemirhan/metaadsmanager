"use client";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
  icon?: string;
}

export function MetricCard({ label, value, sub, trend, trendLabel, color, icon }: MetricCardProps) {
  return (
    <div className="card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          {label}
        </span>
        {icon && (
          <span style={{
            fontSize: 16,
            background: `${color || "var(--meta-blue)"}15`,
            padding: "6px 8px",
            borderRadius: 8,
          }}>{icon}</span>
        )}
      </div>

      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: color || "var(--text-primary)",
        fontFamily: "'Space Mono', monospace",
        letterSpacing: "-0.02em",
        marginBottom: 8,
      }}>
        {value}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {trend && trendLabel && (
          <span className={`badge-${trend}`} style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20
          }}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendLabel}
          </span>
        )}
        {sub && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</span>
        )}
      </div>
    </div>
  );
}
