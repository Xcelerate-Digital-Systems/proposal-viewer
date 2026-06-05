'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2, Check, DollarSign } from 'lucide-react';
import type { Funnel, FunnelCurrency, FunnelForecastPeriod } from '@/lib/supabase';
import { FUNNEL_CURRENCIES, FUNNEL_PERIODS } from '@/lib/types/funnel';

interface Props {
  funnel: Funnel;
  onUpdate: (patch: Partial<Funnel>) => void;
}

/** Compact settings popover anchored to the board header. Owns the two
 *  forecast knobs Funnelytics surfaces — currency + period (one-off run /
 *  monthly / yearly) — so the user can switch the whole forecast in one
 *  click without leaving the canvas. */
export default function FunnelSettingsMenu({ funnel, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-ink px-3 py-1.5 rounded-full hover:bg-surface transition-colors"
        title="Forecast settings"
      >
        <Settings2 size={12} />
        Settings
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-[260px] max-h-[400px] overflow-y-auto bg-white border border-edge shadow-xl rounded-lg p-3 z-50 space-y-3">
          <Section label="Currency">
            <div className="space-y-1">
              {FUNNEL_CURRENCIES.map((c) => (
                <Row
                  key={c.code}
                  active={funnel.currency === c.code}
                  onClick={() => onUpdate({ currency: c.code as FunnelCurrency })}
                >
                  <span className="font-semibold w-9">{c.symbol}</span>
                  <span className="flex-1 truncate">{c.label}</span>
                </Row>
              ))}
            </div>
          </Section>

          <Section label="Default deal value">
            <DealValueInput
              value={funnel.default_deal_value}
              currency={FUNNEL_CURRENCIES.find((c) => c.code === funnel.currency)?.symbol ?? '$'}
              onCommit={(v) => onUpdate({ default_deal_value: v })}
            />
            <p className="text-2xs text-muted mt-1.5 leading-snug">
              Average revenue per conversion. Steps inherit this unless
              they set their own value.
            </p>
          </Section>

          <Section label="Forecast period">
            <div className="space-y-1">
              {FUNNEL_PERIODS.map((p) => (
                <Row
                  key={p.code}
                  active={funnel.forecast_period === p.code}
                  onClick={() => onUpdate({ forecast_period: p.code as FunnelForecastPeriod })}
                >
                  <span className="flex-1">{p.label}</span>
                </Row>
              ))}
            </div>
            <p className="text-2xs text-muted mt-1.5 leading-snug">
              Yearly multiplies your source visitor counts by 12 so the totals
              reflect a year of running this funnel.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Row({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
        active ? 'bg-teal/10 text-ink' : 'text-ink hover:bg-surface'
      }`}
    >
      {children}
      {active && <Check size={12} className="text-teal shrink-0" />}
    </button>
  );
}

function DealValueInput({ value, currency, onCommit }: { value: number | null; currency: string; onCommit: (v: number | null) => void }) {
  const [local, setLocal] = useState(value != null ? String(value) : '');
  useEffect(() => { setLocal(value != null ? String(value) : ''); }, [value]);
  const commit = () => {
    const raw = local.trim();
    const next = raw === '' ? null : Math.max(0, Number(raw) || 0);
    if (next !== value) onCommit(next);
  };
  return (
    <div className="flex items-center bg-white border border-edge rounded-lg focus-within:border-teal transition-colors">
      <span className="text-xs text-muted pl-2.5 select-none">{currency}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={local}
        placeholder="e.g. 5000"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="flex-1 px-2 py-1.5 text-xs bg-transparent outline-none min-w-0"
      />
    </div>
  );
}
