'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink, Trash2, Check } from 'lucide-react';
import type { FunnelStep, FunnelStepMetrics } from '@/lib/supabase';
import {
  FUNNEL_STEP_DEFAULTS, FUNNEL_ICON_LIBRARY, FUNNEL_COLOR_PRESETS,
} from '@/lib/types/funnel';
import { StepIcon } from './nodes/FunnelStepNode';
import { formatCount, formatMoney } from '@/lib/funnel/forecast';

interface Props {
  step: FunnelStep;
  forecastVisitors: number;
  forecastConversions: number;
  forecastRevenue: number;
  forecastCost: number;
  onUpdate: (patch: Partial<FunnelStep>) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Side drawer for editing a single step — label, URL, icon, color, and the
 * manual planner metrics. Writes are optimistic via the parent's onUpdate
 * callback (which already does optimistic local update + DB save).
 */
export default function StepSideDrawer({
  step, forecastVisitors, forecastConversions, forecastRevenue, forecastCost,
  onUpdate, onDelete, onClose,
}: Props) {
  const defaults = FUNNEL_STEP_DEFAULTS[step.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;

  // Local drafts so typing doesn't re-fire DB writes on every keystroke.
  const [label, setLabel] = useState(step.label);
  const [url, setUrl] = useState(step.url || '');
  const [metrics, setMetrics] = useState<FunnelStepMetrics>(step.metrics || {});

  // Re-sync drafts when the user switches to a different step.
  useEffect(() => { setLabel(step.label); setUrl(step.url || ''); setMetrics(step.metrics || {}); }, [step.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const commitLabel = () => {
    const next = label.trim() || defaults.label;
    if (next !== step.label) onUpdate({ label: next });
  };
  const commitUrl = () => {
    const next = url.trim() || null;
    if (next !== (step.url || null)) onUpdate({ url: next });
  };

  const setMetric = (key: keyof FunnelStepMetrics, raw: string) => {
    let parsed: number | null | undefined;
    if (raw === '') parsed = null;
    else {
      const n = Number(raw);
      parsed = Number.isFinite(n) ? n : null;
    }
    const next = { ...metrics, [key]: parsed };
    setMetrics(next);
    onUpdate({ metrics: next });
  };

  const setIcon = (slug: string) => onUpdate({ icon: slug });
  const setColor = (hex: string) => onUpdate({ color: hex });
  const resetColor = () => onUpdate({ color: null });

  // Field visibility mirrors Funnelytics' approach — each node type shows
  // only the inputs that meaningfully drive its forecast contribution.
  //   sources       → visitors + cost-per-click (CPC)
  //   pages         → conversion %
  //   offers        → conversion % + value per conversion (+ recurring months for subs)
  //   generic       → all of them (catch-all)
  const isTrafficSource = step.step_type.startsWith('traffic_');
  const isPage = step.step_type.startsWith('page_');
  const isOffer = step.step_type.startsWith('offer_');
  const isRecurring =
    step.step_type === 'offer_subscription' ||
    step.step_type === 'offer_saas' ||
    step.step_type === 'offer_trial';

  // Icon picker — only show icon groups that make sense for this node type.
  // Landing pages don't need brand logos in the picker; Facebook Ads
  // doesn't need a "Pages" set.
  const relevantIconGroups: string[] =
    isPage ? ['Pages', 'Actions'] :
    isTrafficSource ? ['Traffic', 'Brands', 'Actions'] :
    isOffer ? ['Offers', 'Actions'] :
    ['Pages', 'Traffic', 'Offers', 'Actions', 'Brands'];
  const visibleIconGroups = FUNNEL_ICON_LIBRARY.filter((g) => relevantIconGroups.includes(g.group));
  const showVisitors = isTrafficSource;
  const showConversion = isPage || isOffer || !isTrafficSource; // i.e. not pure sources
  const showCost = isTrafficSource || step.step_type === 'generic';
  const showValue = isOffer || step.step_type === 'generic';
  const costLabel = isTrafficSource ? 'Cost per click' : 'Cost per conversion';

  return (
    <aside className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: step.color || defaults.tint }}
          >
            <StepIcon slug={step.icon || defaults.icon} size={16} />
          </div>
          <span className="text-xs font-semibold text-ink truncate">{step.label || defaults.label}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Forecast snapshot */}
        <div className="bg-surface rounded-lg p-3 grid grid-cols-2 gap-2">
          <Stat label="Visitors"    value={formatCount(forecastVisitors)} />
          <Stat label="Conversions" value={formatCount(forecastConversions)} />
          <Stat label="Revenue"     value={formatMoney(forecastRevenue)} tone="positive" />
          <Stat label="Cost"        value={formatMoney(forecastCost)} tone={forecastCost > 0 ? 'negative' : 'neutral'} />
        </div>

        {/* Label */}
        <Field label="Label">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full px-2.5 py-1.5 rounded-md border border-edge text-[13px] outline-none focus:border-teal"
          />
        </Field>

        {/* URL */}
        <Field label="URL (optional)">
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={commitUrl}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="https://example.com/page"
              className="flex-1 px-2.5 py-1.5 rounded-md border border-edge text-[13px] outline-none focus:border-teal"
            />
            {step.url && (
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-md border border-edge text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors"
                title="Open URL"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </Field>

        {/* Metrics — fields scoped to the step type */}
        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Metrics</h4>
          <div className="space-y-2">
            {showVisitors && (
              <MetricInput
                label="Visitors"
                value={metrics.visitors}
                onChange={(v) => setMetric('visitors', v)}
                placeholder="e.g. 5000"
              />
            )}
            {showConversion && (
              <MetricInput
                label="Conversion %"
                value={metrics.conversion_rate}
                onChange={(v) => setMetric('conversion_rate', v)}
                placeholder="e.g. 8"
                suffix="%"
                max={100}
              />
            )}
            {showCost && (
              <MetricInput
                label={costLabel}
                value={metrics.cost}
                onChange={(v) => setMetric('cost', v)}
                placeholder="e.g. 0.50"
                prefix="$"
              />
            )}
            {showValue && (
              <MetricInput
                label="Value per conversion"
                value={metrics.value}
                onChange={(v) => setMetric('value', v)}
                placeholder="e.g. 49"
                prefix="$"
              />
            )}
            {isRecurring && (
              <MetricInput
                label="Recurring months"
                value={metrics.recurring_months}
                onChange={(v) => setMetric('recurring_months', v)}
                placeholder="e.g. 12"
                suffix="mo"
              />
            )}
          </div>
          {isRecurring && (
            <p className="text-2xs text-muted mt-2 leading-snug">
              For subscriptions, the forecast multiplies the per-conversion value
              by recurring months to model LTV.
            </p>
          )}
        </div>

        {/* Icon picker */}
        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Icon</h4>
          <div className="space-y-3">
            {visibleIconGroups.map((group) => (
              <div key={group.group}>
                <div className="text-2xs text-muted mb-1.5">{group.group}</div>
                <div className="grid grid-cols-8 gap-1">
                  {group.icons.map((slug) => {
                    const active = (step.icon || defaults.icon) === slug;
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setIcon(slug)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          active
                            ? 'bg-teal text-white ring-2 ring-teal/30'
                            : 'bg-surface text-ink/70 hover:bg-white hover:ring-1 hover:ring-edge'
                        }`}
                        style={active ? { backgroundColor: step.color || defaults.tint } : undefined}
                        title={slug}
                      >
                        <StepIcon slug={slug} size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Color</h4>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={resetColor}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-2xs uppercase ${
                step.color == null ? 'border-teal' : 'border-edge'
              }`}
              style={{ backgroundColor: defaults.tint, color: 'white' }}
              title="Default"
            >
              {step.color == null && <Check size={12} />}
            </button>
            {FUNNEL_COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                  step.color === hex ? 'border-ink' : 'border-edge'
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              >
                {step.color === hex && <Check size={12} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <Field label="Notes (private)">
          <textarea
            value={metrics.notes ?? ''}
            onChange={(e) => {
              const next = { ...metrics, notes: e.target.value || null };
              setMetrics(next);
              onUpdate({ metrics: next });
            }}
            rows={3}
            placeholder="Internal context for this step…"
            className="w-full px-2.5 py-1.5 rounded-md border border-edge text-[13px] outline-none focus:border-teal resize-none"
          />
        </Field>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-edge">
        <button
          type="button"
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 rounded-md py-1.5 transition-colors"
        >
          <Trash2 size={12} />
          Delete step
        </button>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const toneCls = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : 'text-ink';
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function MetricInput({
  label, value, onChange, placeholder, prefix, suffix, max,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (raw: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  max?: number;
}) {
  const [local, setLocal] = useState(value == null ? '' : String(value));
  useEffect(() => { setLocal(value == null ? '' : String(value)); }, [value]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted w-[110px] shrink-0">{label}</label>
      <div className="flex-1 flex items-center bg-white border border-edge rounded-md focus-within:border-teal transition-colors">
        {prefix && <span className="text-xs text-muted pl-2">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={max}
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 px-2 py-1.5 text-[13px] bg-transparent outline-none w-full"
        />
        {suffix && <span className="text-xs text-muted pr-2">{suffix}</span>}
      </div>
    </div>
  );
}
