'use client';

import { Eye, EyeOff } from 'lucide-react';
import { formatMoney } from '@/lib/funnel/forecast';
import type { Forecast } from '@/lib/funnel/forecast';

interface Props {
  forecast: Forecast;
  showMetrics: boolean;
  onToggleMetrics?: () => void;
}

/** Sticky summary chip rendered in the top-left of the canvas. Shows the
 *  rolled-up planner forecast for the entire funnel. */
export default function BoardSummary({ forecast, showMetrics, onToggleMetrics }: Props) {
  const roasLabel = !Number.isFinite(forecast.roas)
    ? '∞'
    : forecast.roas > 0
    ? `${forecast.roas.toFixed(2)}x`
    : '—';

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-edge shadow-lg px-4 py-2">
      <Stat label="Revenue" value={formatMoney(forecast.totalRevenue)} tone="positive" />
      <Divider />
      <Stat label="Cost"    value={formatMoney(forecast.totalCost)}    tone={forecast.totalCost > 0 ? 'negative' : 'neutral'} />
      <Divider />
      <Stat
        label="Profit"
        value={formatMoney(forecast.totalProfit)}
        tone={forecast.totalProfit > 0 ? 'positive' : forecast.totalProfit < 0 ? 'negative' : 'neutral'}
      />
      <Divider />
      <Stat label="ROAS" value={roasLabel} tone={forecast.roas >= 1 ? 'positive' : 'neutral'} />

      {onToggleMetrics && (
        <button
          type="button"
          onClick={onToggleMetrics}
          className="ml-2 flex items-center gap-1 text-[11px] text-muted hover:text-ink hover:bg-surface px-2 py-1 rounded transition-colors"
          title={showMetrics ? 'Hide metrics on canvas' : 'Show metrics on canvas'}
        >
          {showMetrics ? <Eye size={12} /> : <EyeOff size={12} />}
          {showMetrics ? 'Hide' : 'Show'}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }) {
  const cls = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : 'text-ink';
  return (
    <div className="leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-[13px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-edge" />;
}
