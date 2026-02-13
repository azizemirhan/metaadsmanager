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
  const getTrendColor = () => {
    if (trend === "up") return "text-success-600 bg-success-50 border-success-200";
    if (trend === "down") return "text-danger-600 bg-danger-50 border-danger-200";
    return "text-slate-600 bg-slate-100 border-slate-200";
  };

  const getTrendIcon = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "→";
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon && (
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ 
              backgroundColor: color ? `${color}15` : 'rgba(37, 99, 235, 0.1)',
              color: color || '#2563eb'
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div 
        className="text-2xl font-bold mb-3"
        style={{ 
          color: color || '#0f172a',
          fontFamily: 'SF Mono, Monaco, monospace',
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {value}
      </div>

      <div className="flex items-center gap-2">
        {trend && trendLabel && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${getTrendColor()}`}>
            {getTrendIcon()} {trendLabel}
          </span>
        )}
        {sub && (
          <span className="text-xs text-slate-500">{sub}</span>
        )}
      </div>
    </div>
  );
}

// Compact version for smaller spaces
export function MetricCardCompact({ label, value, trend, trendValue }: { 
  label: string; 
  value: string; 
  trend?: "up" | "down";
  trendValue?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-xl font-bold text-slate-900" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
          {value}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-success-600" : "text-danger-600"}`}>
            {trend === "up" ? "↑" : "↓"} {trendValue}
          </div>
        )}
      </div>
    </div>
  );
}
