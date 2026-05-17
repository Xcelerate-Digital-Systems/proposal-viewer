'use client';

import { formatMoney } from '@/lib/funnel/forecast';
import type { Forecast } from '@/lib/funnel/forecast';
import type { FunnelCurrency, FunnelForecastPeriod } from '@/lib/supabase';

interface Props {
  forecast: Forecast;
  currency?: FunnelCurrency;
  period?: FunnelForecastPeriod;
}

/** Sticky summary chip rendered in the top-left of the canvas. Shows the
 *  rolled-up planner forecast for the entire funnel. */
export default function BoardSummary({ forecast, currency = 'USD', period }: Props) {
  const roasLabel = !Number.isFinite(forecast.roas)
    ? '∞'
    : forecast.roas > 0
    ? `${forecast.roas.toFixed(2)}x`
    : '—';
  const revenueLabel = period === 'monthly' ? 'Revenue / mo'
                     : period === 'yearly'  ? 'Revenue / yr'
                     : 'Revenue';
  const costLabel    = period === 'monthly' ? 'Cost / mo'
                     : period === 'yearly'  ? 'Cost / yr'
                     : 'Cost';
  const profitLabel  = period === 'monthly' ? 'Profit / mo'
                     : period === 'yearly'  ? 'Profit / yr'
                     : 'Profit';

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-edge shadow-lg px-4 py-2">
      <Stat label={revenueLabel} value={formatMoney(forecast.totalRevenue, currency)} tone="positive" />
      <Divider />
      <Stat label={costLabel}    value={formatMoney(forecast.totalCost, currency)}    tone={forecast.totalCost > 0 ? 'negative' : 'neutral'} />
      <Divider />
      <Stat
        label={profitLabel}
        value={formatMoney(forecast.totalProfit, currency)}
        tone={forecast.totalProfit > 0 ? 'positive' : forecast.totalProfit < 0 ? 'negative' : 'neutral'}
      />
      <Divider />
      <Stat label="ROAS" value={roasLabel} tone={forecast.roas >= 1 ? 'positive' : 'neutral'} />

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
