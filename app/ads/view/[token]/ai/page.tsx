// app/ads/view/[token]/ai/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Copy, Check, ArrowLeft, FileJson } from 'lucide-react';
import type { AdTrackerSharePayload, AdCreativeWithVariants } from '@/lib/types/ads';

export default function AiAdTrackerViewer({ params }: { params: { token: string } }) {
  const [payload, setPayload] = useState<AdTrackerSharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ads/share/${params.token}`);
      if (cancelled) return;
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setPayload(json);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params.token]);

  const markdown = useMemo(() => payload ? renderMarkdown(payload) : '', [payload]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-edge border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-ink mb-2">Ad tracker not found</h2>
          <p className="text-sm text-muted">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-edge sticky top-0 z-10 bg-white">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <Link
            href={`/ads/view/${params.token}`}
            className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to table view
          </Link>

          <div className="flex items-center gap-2">
            <a
              href={`/api/ads/share/${params.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink bg-surface hover:bg-edge rounded-[10px] px-3 py-2 transition-colors"
            >
              <FileJson size={14} />
              View JSON
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-teal hover:bg-teal-hover rounded-[10px] px-3 py-2 transition-colors"
            >
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy markdown</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8">
        <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">
          {markdown}
        </pre>
      </main>
    </div>
  );
}

// ─── Markdown renderer ──────────────────────────────────────────────────────

function renderMarkdown(p: AdTrackerSharePayload): string {
  const lines: string[] = [];
  lines.push(`# ${p.tracker.name} — Ad Tracker`);
  if (p.tracker.client_name) lines.push(`_Client: ${p.tracker.client_name}_`);
  if (p.tracker.description) lines.push(`_${p.tracker.description}_`);
  lines.push('');
  lines.push(`Total ads: ${p.creatives.length}`);
  lines.push('');

  // Standards block
  const s = p.tracker.standards || {};
  const label = s.metric_label || 'CPL';
  const target = s.cpl_target != null ? `$${s.cpl_target}` : '—';
  const personas = s.personas && s.personas.length ? s.personas.join(', ') : '—';
  lines.push('## Standards');
  lines.push(`- **${label} target:** ${target}`);
  lines.push(`- **Personas:** ${personas}`);
  if (p.account_standards) {
    const a = p.account_standards;
    lines.push(
      `- **Account targets:** Hook rate ≥ ${pct(a.hook_rate_target)} · Hold rate ≥ ${pct(a.hold_rate_target)} · Unique CTR ≥ ${pct(a.uctr_target)}`
    );
  }
  lines.push('');

  if (p.creatives.length === 0) {
    lines.push('_No ads tracked yet._');
    return lines.join('\n');
  }

  // Group creatives by status for at-a-glance game plan
  const groups: Record<string, AdCreativeWithVariants[]> = {};
  for (const c of p.creatives) {
    const key = c.status || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const statusOrder = ['live', 'ready', 'in_production', 'briefed', 'draft', 'paused', 'killed'];
  const sortedStatuses = Object.keys(groups).sort((a, b) => {
    const ai = statusOrder.indexOf(a);
    const bi = statusOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  lines.push('## Ads by status');
  lines.push('');

  for (const status of sortedStatuses) {
    const creatives = groups[status];
    lines.push(`### ${humanize(status)} (${creatives.length})`);
    lines.push('');
    for (const c of creatives) {
      lines.push(...renderCreative(c));
      lines.push('');
    }
  }

  const withActions = p.creatives.filter((c) => c.next_action && c.next_action.trim());
  if (withActions.length > 0) {
    lines.push('## Game plan — next actions');
    lines.push('');
    for (const c of withActions) {
      lines.push(`- **${c.ad_name}** (${humanize(c.status)}): ${c.next_action}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderCreative(c: AdCreativeWithVariants): string[] {
  const lines: string[] = [];
  lines.push(`#### ${c.ad_name}`);

  const meta: string[] = [];
  if (c.winner) meta.push(`Winner: ${humanize(c.winner)}`);
  if (c.launch_date) meta.push(`Launched: ${c.launch_date}`);
  if (c.kill_date) meta.push(`Killed: ${c.kill_date}`);
  if (meta.length) lines.push(`_${meta.join(' · ')}_`);

  const facts: Array<[string, string | null | undefined]> = [
    ['Hypothesis', c.hypothesis],
    ['Ad concept', c.ad_concept],
    ['Angle', joinOrNull(c.angle_family, c.angle_idea)],
    ['Persona', c.persona],
    ['Awareness', humanizeOrNull(c.awareness_level)],
    ['Sophistication', humanizeOrNull(c.market_sophistication)],
    ['Hook', c.hook],
    ['Format', joinOrNull(c.creative_style, c.creative_format)],
    ['Offer / lander', joinOrNull(c.offer_variant, c.lander_variant)],
  ];

  for (const [label, value] of facts) {
    if (value) lines.push(`- **${label}:** ${value}`);
  }

  if (c.ad_copy_variants && c.ad_copy_variants.length > 0) {
    const byType: Record<string, string[]> = {};
    for (const v of c.ad_copy_variants) {
      if (!byType[v.variant_type]) byType[v.variant_type] = [];
      byType[v.variant_type].push(v.content);
    }
    const copyBits: string[] = [];
    if (byType.headline?.length) copyBits.push(`Headline: "${byType.headline[0]}"`);
    if (byType.primary_text?.length) copyBits.push(`Primary: "${byType.primary_text[0]}"`);
    if (byType.cta?.length) copyBits.push(`CTA: "${byType.cta[0]}"`);
    if (copyBits.length) lines.push(`- **Copy:** ${copyBits.join(' · ')}`);
  }

  const metrics: string[] = [];
  if (c.hook_rate != null) metrics.push(`Hook ${c.hook_rate}%`);
  if (c.hold_rate != null) metrics.push(`Hold ${c.hold_rate}%`);
  if (c.uctr != null) metrics.push(`uCTR ${c.uctr}%`);
  if (c.cvr != null) metrics.push(`CVR ${c.cvr}`);
  if (c.cpl != null) metrics.push(`${c.cpl_label || 'CPL'} $${c.cpl}`);
  if (c.creative_lifespan_days != null) metrics.push(`Ran ${c.creative_lifespan_days}d`);
  if (metrics.length) lines.push(`- **Metrics:** ${metrics.join(' · ')}`);

  if (c.next_action) lines.push(`- **Next action:** ${c.next_action}`);

  return lines;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeOrNull(value: string | null): string | null {
  return value ? humanize(value) : null;
}

function joinOrNull(a: string | null, b: string | null): string | null {
  const parts = [a, b].filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

function pct(value: number | null | undefined): string {
  return value != null ? `${value}%` : '—';
}
