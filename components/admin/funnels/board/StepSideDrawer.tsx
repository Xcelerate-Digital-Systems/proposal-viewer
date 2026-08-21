'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, ArrowUpRight, Trash2, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import type { FunnelStep, FunnelStepMetrics, FunnelTab } from '@/lib/supabase';
import {
  FUNNEL_STEP_DEFAULTS, FUNNEL_ICON_LIBRARY, FUNNEL_COLOR_PRESETS,
  messageKindForStep, parseNodeMessage, hasMessageContent,
  type FunnelNodeMessage,
} from '@/lib/types/funnel';
import { StepIcon, isFullColourBrand } from './nodes/FunnelStepNode';
import FunnelLinkPicker from './FunnelLinkPicker';
import NodeMessageEditor from './NodeMessageEditor';
import RolePicker from './RolePicker';
import PlatformPicker from './PlatformPicker';
import { useFunnelBoardContext } from './FunnelBoardContext';
import NodeMessageModal from './NodeMessageModal';
interface Props {
  step: FunnelStep;
  onUpdate: (patch: Partial<FunnelStep>) => void;
  onDelete: () => void;
  onClose: () => void;
  tabs?: FunnelTab[];
  activeTabId?: string | null;
}

const RECURRING_TYPES = new Set(['offer_subscription', 'offer_saas', 'offer_trial']);

export default function StepSideDrawer({
  step,
  onUpdate, onDelete, onClose,
  tabs, activeTabId,
}: Props) {
  const defaults = FUNNEL_STEP_DEFAULTS[step.step_type] ?? FUNNEL_STEP_DEFAULTS.generic;
  const boardCtx = useFunnelBoardContext();

  const [label, setLabel] = useState(step.label);
  const [url, setUrl] = useState(step.url || '');
  const [desc, setDesc] = useState(step.description || '');
  const [iconQuery, setIconQuery] = useState('');
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notes, setNotes] = useState((step.metrics?.notes as string) ?? '');

  const messageKind = messageKindForStep(step.step_type);
  const message = parseNodeMessage(step.message);

  const isTrafficSource = step.step_type.startsWith('traffic_');
  const isPage = step.step_type.startsWith('page_');
  const isOffer = step.step_type.startsWith('offer_');
  const showRecurring = RECURRING_TYPES.has(step.step_type);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLabel(step.label);
    setUrl(step.url || '');
    setDesc(step.description || '');
    setNotes((step.metrics?.notes as string) ?? '');
  }, [step.id]);

  /* ── Metric writes ───────────────────────────────────────────────────────
   *  Every metric field shares one debounce window, so edits are accumulated
   *  into a pending patch rather than each field owning a timer that the next
   *  field's keystroke would cancel. Without this, tabbing from Visitors to
   *  Conversion rate within the debounce window silently dropped the Visitors
   *  write while the input kept showing the typed value.
   *
   *  The pending patch is flushed on unmount and when switching nodes, so
   *  closing the drawer right after typing doesn't lose the last edit either. */
  const metricsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMetricsRef = useRef<Partial<FunnelStepMetrics>>({});
  // Latest committed metrics, read at flush time so the merge is never stale.
  const stepMetricsRef = useRef<FunnelStepMetrics | null>(step.metrics);
  stepMetricsRef.current = step.metrics;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const flushMetrics = useCallback(() => {
    if (metricsTimerRef.current) {
      clearTimeout(metricsTimerRef.current);
      metricsTimerRef.current = null;
    }
    const pending = pendingMetricsRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingMetricsRef.current = {};
    onUpdateRef.current({ metrics: { ...(stepMetricsRef.current || {}), ...pending } });
  }, []);

  const updateMetric = useCallback((key: keyof FunnelStepMetrics, raw: string) => {
    const num = raw.trim() === '' ? null : Number(raw);
    pendingMetricsRef.current = {
      ...pendingMetricsRef.current,
      [key]: num == null || Number.isNaN(num) ? null : num,
    };
    if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current);
    metricsTimerRef.current = setTimeout(flushMetrics, 400);
  }, [flushMetrics]);

  /** Notes live inside the metrics JSON, so they ride the same pending patch
   *  and debounce rather than firing a database write per character. */
  const queueNotes = useCallback((value: string) => {
    pendingMetricsRef.current = { ...pendingMetricsRef.current, notes: value || null };
    if (metricsTimerRef.current) clearTimeout(metricsTimerRef.current);
    metricsTimerRef.current = setTimeout(flushMetrics, 400);
  }, [flushMetrics]);

  // Flush on unmount (drawer closed) and before switching to another node.
  useEffect(() => () => flushMetrics(), [step.id, flushMetrics]);

  const commitLabel = () => {
    const next = label.trim() || defaults.label;
    if (next !== step.label) onUpdate({ label: next });
  };
  const commitUrl = () => {
    const next = url.trim() || null;
    if (next !== (step.url || null)) onUpdate({ url: next });
  };
  const commitDesc = () => {
    const next = desc.trim() || null;
    if (next !== (step.description || null)) onUpdate({ description: next });
  };

  const setIcon = (slug: string) => onUpdate({ icon: slug });
  const setColor = (hex: string) => onUpdate({ color: hex });
  const resetColor = () => onUpdate({ color: null });

  const relevantIconGroups: string[] =
    isPage ? ['Pages', 'Actions'] :
    isTrafficSource ? ['Traffic', 'Brands', 'Actions'] :
    isOffer ? ['Offers', 'Actions'] :
    ['Pages', 'Traffic', 'Offers', 'Actions', 'Brands'];
  const visibleIconGroups = FUNNEL_ICON_LIBRARY.filter((g) => relevantIconGroups.includes(g.group));

  return (
    <motion.aside
      data-side-drawer
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-0 right-0 h-full w-[340px] bg-white border-l border-edge shadow-xl flex flex-col z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: step.color || defaults.tint }}
          >
            <StepIcon
              slug={step.icon || defaults.icon}
              size={16}
              fillContainer={isFullColourBrand(step.icon || defaults.icon)}
            />
          </div>
          <span className="text-xs font-semibold text-ink truncate">{step.label || defaults.label}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Label */}
        <Field label="Label">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
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
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal"
            />
            {step.url && (
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-edge text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors"
                title="Open URL"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </Field>

        {/* Description (shown as card below the node on the canvas) */}
        <Field label="Description">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={commitDesc}
            rows={3}
            placeholder="Add a description to show below this node…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal resize-none"
          />
          <p className="text-2xs text-muted/70 mt-0.5 leading-snug">
            Shows as a card below the node, including to anyone with the share
            link. Leave empty to hide.
          </p>
        </Field>

        {/* Which system this step runs in — a logo badge on the node */}
        <PlatformPicker
          platform={step.platform}
          onChange={(slug) => onUpdate({ platform: slug })}
        />

        {/* Owner — a label, not an AgencyViz user */}
        {boardCtx && (
          <RolePicker
            roles={boardCtx.roles}
            roleId={step.role_id}
            onAssign={(id) => onUpdate({ role_id: id })}
            onCreate={boardCtx.ensureRole}
            onRecolour={(id, color) => void boardCtx.updateRole(id, { color })}
          />
        )}

        {/* Email / SMS content — only on message-capable step types */}
        {messageKind && (
          <NodeMessageEditor
            nodeId={step.id}
            kind={messageKind}
            message={message}
            onChange={(next: FunnelNodeMessage | null) => onUpdate({ message: next })}
            onPreview={() => setPreviewOpen(true)}
          />
        )}

        {/* Link to tab or funnel */}
        <FunnelLinkPicker
          currentFunnelId={step.funnel_id}
          linkedFunnelId={step.linked_funnel_id}
          onLink={(id) => onUpdate({ linked_funnel_id: id, linked_tab_id: id ? null : step.linked_tab_id } as any)}
          tabs={tabs}
          currentTabId={activeTabId}
          linkedTabId={step.linked_tab_id}
          onLinkTab={(id) => onUpdate({ linked_tab_id: id, linked_funnel_id: id ? null : step.linked_funnel_id } as any)}
        />

        {/* Metrics — first after identity fields so users find it immediately */}
        <div>
          <button
            type="button"
            onClick={() => setMetricsOpen((v) => !v)}
            className="w-full flex items-center justify-between text-2xs uppercase tracking-wider font-semibold text-muted hover:text-ink transition-colors mb-2"
          >
            <span>Forecast metrics</span>
            {metricsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {metricsOpen && (
            <div className="space-y-3">
              {isTrafficSource && (
                <MetricField
                  label="Visitors"
                  hint="How many visitors this source delivers"
                  value={step.metrics?.visitors}
                  onChange={(v) => updateMetric('visitors', v)}
                />
              )}
              {!isTrafficSource && (
                <MetricField
                  label="Visitors (override)"
                  hint="Leave blank to inherit from upstream edges"
                  value={step.metrics?.visitors}
                  onChange={(v) => updateMetric('visitors', v)}
                  placeholder="auto"
                />
              )}
              <MetricField
                label="Conversion rate"
                hint="% of visitors that proceed to the next step"
                value={step.metrics?.conversion_rate}
                onChange={(v) => updateMetric('conversion_rate', v)}
                suffix="%"
                placeholder="0"
              />
              <MetricField
                label="Value per conversion"
                hint="Revenue generated per conversion at this step"
                value={step.metrics?.value}
                onChange={(v) => updateMetric('value', v)}
                prefix="$"
                placeholder="0"
              />
              <MetricField
                label={isTrafficSource ? 'Cost per visitor' : 'Cost per conversion'}
                hint={isTrafficSource ? 'CPC or cost per visitor from this source' : 'Cost per conversion at this step'}
                value={step.metrics?.cost}
                onChange={(v) => updateMetric('cost', v)}
                prefix="$"
                placeholder="0"
              />
              {showRecurring && (
                <MetricField
                  label="Recurring months"
                  hint="Months of recurring revenue per conversion (LTV)"
                  value={step.metrics?.recurring_months}
                  onChange={(v) => updateMetric('recurring_months', v)}
                  placeholder="1"
                />
              )}
            </div>
          )}
        </div>

        {/* Private notes — distinct from Description above, which renders on the
            canvas. Shares the metrics debounce so it isn't a write per keystroke. */}
        <Field label="Private notes">
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); queueNotes(e.target.value); }}
            rows={3}
            placeholder="Internal context for this step…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-edge text-caption outline-none focus:border-teal resize-none"
          />
          <p className="text-2xs text-muted/70 mt-0.5 leading-snug">
            Never shown on the canvas or to anyone with the share link.
          </p>
        </Field>

        {/* Icon picker */}
        <div>
          <h4 className="text-2xs uppercase tracking-wider font-semibold text-muted mb-2">Icon</h4>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              placeholder="Search icons..."
              className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-edge text-detail outline-none focus:border-teal"
            />
          </div>
          <div className="space-y-3">
            {(() => {
              const q = iconQuery.toLowerCase().trim();
              const qNoSpaces = q.replaceAll(' ', '').replaceAll('-', '');
              const groups = q
                ? visibleIconGroups.map((g) => ({
                    ...g,
                    icons: g.icons.filter((slug) => {
                      const flat = slug.replaceAll('-', '');
                      const spaced = slug.replaceAll('-', ' ');
                      return spaced.includes(q) || slug.includes(q) || flat.includes(qNoSpaces);
                    }),
                  })).filter((g) => g.icons.length > 0)
                : visibleIconGroups;

              if (groups.length === 0) {
                return <p className="text-detail text-muted py-2 text-center">No icons match &ldquo;{iconQuery}&rdquo;</p>;
              }

              return groups.map((group) => (
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
                          className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-teal/40 ${
                            active
                              ? 'ring-2 ring-teal/30'
                              : 'hover:ring-1 hover:ring-edge'
                          }`}
                          style={{ backgroundColor: active ? (step.color || defaults.tint) : '#2B2B2B' }}
                          title={slug}
                        >
                          <StepIcon slug={slug} size={14} fillContainer={isFullColourBrand(slug)} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
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
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-edge">
        <button
          type="button"
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 rounded-lg py-1.5 transition-colors"
        >
          <Trash2 size={12} />
          Delete step
        </button>
      </div>

      {previewOpen && message && hasMessageContent(message) && (
        <NodeMessageModal
          message={message}
          title={step.label || defaults.label}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </motion.aside>
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

function MetricField({
  label, hint, value, onChange, prefix, suffix, placeholder = '',
}: {
  label: string; hint: string;
  value: number | null | undefined;
  onChange: (raw: string) => void;
  prefix?: string; suffix?: string; placeholder?: string;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : '');
  useEffect(() => { setLocal(value != null ? String(value) : ''); }, [value]);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-detail font-medium text-ink">{label}</span>
      </div>
      <div className="flex items-center bg-white border border-edge rounded-lg focus-within:border-teal transition-colors">
        {prefix && <span className="text-detail text-muted pl-2.5 select-none">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={local}
          placeholder={placeholder}
          onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
          className="flex-1 px-2.5 py-1.5 text-caption bg-transparent outline-none min-w-0"
        />
        {suffix && <span className="text-detail text-muted pr-2.5 select-none">{suffix}</span>}
      </div>
      <p className="text-2xs text-muted/70 mt-0.5 leading-snug">{hint}</p>
    </div>
  );
}

