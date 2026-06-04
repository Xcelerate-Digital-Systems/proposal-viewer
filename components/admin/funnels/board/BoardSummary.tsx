'use client';

import { formatMoney } from '@/lib/funnel/forecast';
import type { Forecast } from '@/lib/funnel/forecast';
import type { FunnelCurrency, FunnelForecastPeriod } from '@/lib/supabase';

interface Props {
  forecast: Forecast;
  currency?: FunnelCurrency;
  period?: FunnelForecastPeriod;
}

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
    <div
      className="flex items-center gap-3 bg-white rounded-lg border border-edge shadow-sm px-3.5 py-2"
      role="group"
      aria-label="Funnel forecast summary"
    >
      <span
        className="text-detail text-muted/50 font-medium select-none"
        title="Values are modeled projections based on your funnel configuration"
      >
        Forecast
      </span>
      <Divider />
      <Stat
        label={revenueLabel}
        value={formatMoney(forecast.totalRevenue, currency)}
        tone="positive"
        tooltip="Total projected revenue from this funnel"
      />
      <Divider />
      <Stat
        label={costLabel}
        value={formatMoney(forecast.totalCost, currency)}
        tone={forecast.totalCost > 0 ? 'negative' : 'neutral'}
        tooltip="Total advertising and operational cost"
      />
      <Divider />
      <Stat
        label={profitLabel}
        value={formatMoney(forecast.totalProfit, currency)}
        tone={forecast.totalProfit > 0 ? 'positive' : forecast.totalProfit < 0 ? 'negative' : 'neutral'}
        tooltip="Revenue minus cost"
      />
      <Divider />
      <Stat
        label="ROAS"
        value={roasLabel}
        tone={forecast.roas >= 1 ? 'positive' : 'neutral'}
        tooltip="Return on ad spend — revenue earned per dollar spent"
      />
    </div>
  );
}

function Stat({ label, value, tone, tooltip }: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral'; tooltip?: string }) {
  const cls = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : 'text-ink';
  return (
    <div className="leading-tight" title={tooltip}>
      <div className="text-detail text-muted">{label}</div>
      <div className={`text-caption font-semibold ${cls}`} aria-label={`${label}: ${value}`}>
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-edge" aria-hidden />;
}
