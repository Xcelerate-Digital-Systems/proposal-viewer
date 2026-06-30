// components/viewer/quote-view/quote-view-helpers.ts
// Pure utility and domain functions for the quote single-page view.

import type { Proposal, ProposalPricing } from '@/lib/supabase';
import { buildGradientCss, resolveStops } from '@/lib/gradient-stops';

/* ── Style helpers ──────────────────────────────────────────────────────── */

export const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export function fontStack(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  return `'${name}', ${fallback}`;
}

/** Convert any CSS colour to rgba with explicit alpha. Falls back gracefully. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  // Already rgb()/rgba()/named — wrap in color-mix for alpha overlay.
  return `color-mix(in srgb, ${hex} ${alpha * 100}%, transparent)`;
}

/* ── Domain helpers ─────────────────────────────────────────────────────── */

export function buildHeaderBackground(p: Proposal): string {
  // Quote body header band uses quote_header_* with fallback to cover_*
  // (so existing quotes keep their look until the user explicitly diverges).
  const style = (p.quote_header_bg_style ?? p.cover_bg_style) === 'solid' ? 'solid' : 'gradient';
  const c1    = p.quote_header_bg_color_1 ?? p.cover_bg_color_1 ?? '#0f172a';
  const c2    = p.quote_header_bg_color_2 ?? p.cover_bg_color_2 ?? '#1e293b';
  const angle = p.quote_header_gradient_angle ?? p.cover_gradient_angle ?? 135;
  const cx    = p.quote_header_gradient_position_x ?? p.cover_gradient_position_x ?? 50;
  const cy    = p.quote_header_gradient_position_y ?? p.cover_gradient_position_y ?? 50;
  const type  = (p.quote_header_gradient_type ?? p.cover_gradient_type ?? 'linear') as 'linear' | 'radial' | 'conic';
  const stopsRaw = p.quote_header_gradient_stops ?? p.cover_gradient_stops;
  const stops = resolveStops(stopsRaw, c1, c2);
  return buildGradientCss(style, type, angle, cx, cy, stops);
}

export function deriveDeposit(pricing: ProposalPricing | null, total: number) {
  if (!pricing?.payment_schedule) return null;
  const sched = pricing.payment_schedule;
  if (sched.milestones?.enabled && sched.milestones.payments.length > 0) {
    const first = sched.milestones.payments[0];
    const amount =
      first.type === 'percentage'
        ? Math.round(total * (first.value / 100) * 100) / 100
        : first.value;
    const pct = first.type === 'percentage' ? first.value : Math.round((first.value / total) * 100);
    return { amount, pct, label: first.label || 'Deposit' };
  }
  if (sched.one_off?.enabled && sched.one_off.amount > 0) {
    return {
      amount: sched.one_off.amount,
      pct: total > 0 ? Math.round((sched.one_off.amount / total) * 100) : 0,
      label: sched.one_off.label || 'Deposit',
    };
  }
  return null;
}

export function formatValidUntil(pricing: ProposalPricing | null): string | null {
  if (!pricing?.validity_days || !pricing.proposal_date) return null;
  const start = new Date(pricing.proposal_date);
  start.setDate(start.getDate() + pricing.validity_days);
  return start.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function parsePhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string');
}

/* ── Expiry urgency helpers ─────────────────────────────────────────────── */

export type ExpiryState =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'soon'; days: number }   // 2–3 days
  | { kind: 'valid'; label: string }; // >3 days — just show the date

export function computeExpiryState(
  proposal: { valid_until: string | null },
  pricing: { validity_days?: number | null; proposal_date?: string | null } | null,
): ExpiryState {
  let expiryDate: Date | null = null;

  if (proposal.valid_until) {
    expiryDate = new Date(proposal.valid_until);
  } else if (pricing?.validity_days && pricing.proposal_date) {
    expiryDate = new Date(pricing.proposal_date);
    expiryDate.setDate(expiryDate.getDate() + pricing.validity_days);
  }

  if (!expiryDate || isNaN(expiryDate.getTime())) return { kind: 'none' };

  // Compare at day granularity in local time
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryStart = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
  );
  const diffMs = expiryStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { kind: 'expired' };
  if (diffDays === 0) return { kind: 'today' };
  if (diffDays === 1) return { kind: 'tomorrow' };
  if (diffDays <= 3) return { kind: 'soon', days: diffDays };

  const label = expiryDate.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return { kind: 'valid', label };
}
