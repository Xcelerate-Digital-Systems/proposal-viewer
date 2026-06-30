import type {
  FeedbackDecisionBranch,
  FeedbackDecisionBranchSide,
  FeedbackDecisionContent,
  FeedbackWaitContent,
  FeedbackWaitUnit,
  FeedbackActionContent,
} from '@/lib/supabase';

/* ─── Branch palette ─────────────────────────────────────────────── */

export const NEUTRAL_PALETTE = { fill: '#F3F4F6', border: '#9CA3AF', text: '#6B7280', label: 'None' };

export const BRANCH_PALETTE: { fill: string; border: string; text: string; label: string }[] = [
  NEUTRAL_PALETTE,
  { fill: '#A7F3D0', border: '#047857', text: '#064E3B', label: 'Green' },
  { fill: '#FECACA', border: '#B91C1C', text: '#7F1D1D', label: 'Red' },
  { fill: '#BFDBFE', border: '#1D4ED8', text: '#1E3A8A', label: 'Blue' },
  { fill: '#FDE68A', border: '#B45309', text: '#78350F', label: 'Yellow' },
  { fill: '#DDD6FE', border: '#6D28D9', text: '#4C1D95', label: 'Purple' },
  { fill: '#FBCFE8', border: '#BE185D', text: '#831843', label: 'Pink' },
];

export function paletteEntry(color: string) {
  return BRANCH_PALETTE.find((p) => p.fill === color) || NEUTRAL_PALETTE;
}

/* ─── Decision content ───────────────────────────────────────────── */

export const ALL_SIDES: FeedbackDecisionBranchSide[] = ['top', 'right', 'bottom', 'left'];

export function emptyBranchForSide(side: FeedbackDecisionBranchSide): FeedbackDecisionBranch {
  return { id: side, label: '', color: NEUTRAL_PALETTE.fill, side };
}

export const DEFAULT_DECISION_CONTENT: FeedbackDecisionContent = {
  question: 'Decision?',
  branches: ALL_SIDES.map(emptyBranchForSide),
};

export function cloneDefaultDecisionContent(): FeedbackDecisionContent {
  return {
    question: DEFAULT_DECISION_CONTENT.question,
    branches: DEFAULT_DECISION_CONTENT.branches.map((b) => ({ ...b })),
  };
}

export function parseDecisionContent(raw: string | null | undefined): FeedbackDecisionContent {
  if (!raw) return cloneDefaultDecisionContent();
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDecisionContent>;
    const question = typeof parsed?.question === 'string' ? parsed.question : DEFAULT_DECISION_CONTENT.question;

    // Enforce exactly one branch per side. Keep the first branch we encounter
    // for each side (older content may have multiple), and fill any missing
    // sides with neutral defaults so every corner always has a slot.
    const bySide: Partial<Record<FeedbackDecisionBranchSide, FeedbackDecisionBranch>> = {};
    const incoming = Array.isArray(parsed?.branches) ? parsed.branches : [];
    for (const b of incoming) {
      if (!b || !ALL_SIDES.includes(b.side as FeedbackDecisionBranchSide)) continue;
      const side = b.side as FeedbackDecisionBranchSide;
      if (bySide[side]) continue;
      bySide[side] = {
        id: b.id || side,
        label: typeof b.label === 'string' ? b.label : '',
        color: b.color ?? NEUTRAL_PALETTE.fill,
        side,
      };
    }
    const branches = ALL_SIDES.map((side) => bySide[side] ?? emptyBranchForSide(side));
    return { question, branches };
  } catch {
    return cloneDefaultDecisionContent();
  }
}

export function serializeDecisionContent(content: FeedbackDecisionContent): string {
  return JSON.stringify(content);
}

/* ─── Wait content ───────────────────────────────────────────────── */

export const WAIT_UNITS: { value: FeedbackWaitUnit; label: string; short: string }[] = [
  { value: 'minutes', label: 'Minutes', short: 'min' },
  { value: 'hours',   label: 'Hours',   short: 'hr' },
  { value: 'days',    label: 'Days',    short: 'day' },
  { value: 'weeks',   label: 'Weeks',   short: 'wk' },
];

export const DEFAULT_WAIT_CONTENT: FeedbackWaitContent = { duration: 1, unit: 'days', label: null };

export function parseWaitContent(raw: string | null | undefined): FeedbackWaitContent {
  if (!raw) return DEFAULT_WAIT_CONTENT;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackWaitContent>;
    const unit = WAIT_UNITS.find((u) => u.value === parsed?.unit)?.value ?? DEFAULT_WAIT_CONTENT.unit;
    const duration = typeof parsed?.duration === 'number' && parsed.duration > 0
      ? Math.min(parsed.duration, 9999)
      : DEFAULT_WAIT_CONTENT.duration;
    return {
      duration,
      unit,
      label: typeof parsed?.label === 'string' ? parsed.label : null,
    };
  } catch {
    return DEFAULT_WAIT_CONTENT;
  }
}

export function serializeWaitContent(content: FeedbackWaitContent): string {
  return JSON.stringify(content);
}

export function formatWaitLabel(content: FeedbackWaitContent): string {
  const unitDef = WAIT_UNITS.find((u) => u.value === content.unit);
  const short = content.duration === 1 ? unitDef?.short : `${unitDef?.short}s`;
  return `${content.duration} ${short || content.unit}`;
}

/* ─── Action content ─────────────────────────────────────────────── */

export function parseActionContent(raw: string | null | undefined): FeedbackActionContent {
  if (!raw) return { label: null };
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackActionContent>;
    return { label: typeof parsed?.label === 'string' ? parsed.label : null };
  } catch {
    // Fall back to treating stray plain-text content as the label.
    return { label: typeof raw === 'string' ? raw : null };
  }
}

export function serializeActionContent(content: FeedbackActionContent): string {
  return JSON.stringify(content);
}
