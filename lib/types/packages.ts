// lib/types/packages.ts

// ─── Shared primitive ────────────────────────────────────────────────────────

export type PackageFeatureIcon = 'dot' | 'check' | 'checkCircle' | 'arrow' | 'star' | 'dash';

// ─── Pricing types ────────────────────────────────────────────────────────────

export type PricingLineItem = {
  id: string;
  label: string;
  description: string;
  percentage: number;
  amount: number;
  sort_order: number;
};

export type PricingOptionalItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
  sort_order: number;
};

export type MilestonePayment = {
  id: string;
  label: string;
  type: 'percentage' | 'fixed';
  value: number;
  note: string;
};

export type PaymentSchedule = {
  one_off: {
    enabled: boolean;
    amount: number;
    label: string;
    note: string;
  };
  milestones: {
    enabled: boolean;
    payments: MilestonePayment[];
  };
  recurring: {
    enabled: boolean;
    amount: number;
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';
    label: string;
    note: string;
  };
};

export const DEFAULT_PAYMENT_SCHEDULE: PaymentSchedule = {
  one_off: { enabled: false, amount: 0, label: 'One-off Payment', note: 'Due on signing' },
  milestones: {
    enabled: false,
    payments: [
      { id: 'ms_deposit', label: 'Deposit', type: 'percentage', value: 50, note: 'Due on signing' },
      { id: 'ms_final', label: 'Final Payment', type: 'percentage', value: 50, note: 'Due on completion' },
    ],
  },
  recurring: { enabled: false, amount: 0, frequency: 'monthly', label: 'Ongoing Retainer', note: '' },
};

/**
 * Normalize a payment schedule from DB, handling both the old deposit/balance
 * format and the new milestones format for backward compatibility.
 */
export function normalizePaymentSchedule(raw: unknown): PaymentSchedule {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PAYMENT_SCHEDULE };

  const r = raw as Record<string, unknown>;

  // Already new format
  if (r.milestones && typeof r.milestones === 'object') {
    // Ensure one_off has amount field (may be missing from older data)
    const oneOff = r.one_off as Record<string, unknown> | undefined;
    return {
      ...(raw as PaymentSchedule),
      one_off: {
        enabled: !!(oneOff?.enabled),
        amount: (oneOff?.amount as number) ?? 0,
        label: (oneOff?.label as string) || 'One-off Payment',
        note: (oneOff?.note as string) || '',
      },
    };
  }

  // Legacy deposit/balance → migrate to milestones
  const dep = r.deposit as Record<string, unknown> | undefined;
  const bal = r.balance as Record<string, unknown> | undefined;

  if (dep) {
    const payments: MilestonePayment[] = [
      {
        id: 'ms_deposit',
        label: (dep.label as string) || 'Deposit',
        type: (dep.type as 'percentage' | 'fixed') || 'percentage',
        value: (dep.value as number) || 50,
        note: (dep.note as string) || 'Due on signing',
      },
    ];
    if (bal) {
      payments.push({
        id: 'ms_balance',
        label: (bal.label as string) || 'Balance Payment',
        type: 'percentage',
        value: dep.type === 'percentage' ? 100 - ((dep.value as number) || 50) : 0,
        note: (bal.note as string) || 'Due on project completion',
      });
    }
    return {
      one_off: (r.one_off as PaymentSchedule['one_off']) || DEFAULT_PAYMENT_SCHEDULE.one_off,
      milestones: {
        enabled: !!(dep.enabled),
        payments,
      },
      recurring: (r.recurring as PaymentSchedule['recurring']) || DEFAULT_PAYMENT_SCHEDULE.recurring,
    };
  }

  return { ...DEFAULT_PAYMENT_SCHEDULE };
}

export type ProposalPricing = {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  title: string;
  intro_text: string | null;
  items: PricingLineItem[];
  optional_items: PricingOptionalItem[];
  payment_schedule: PaymentSchedule | null;
  tax_enabled: boolean;
  tax_rate: number;
  tax_label: string;
  validity_days: number | null;
  indent: number;
  proposal_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplatePricing = Omit<ProposalPricing, 'proposal_id' | 'proposal_date'> & {
  template_id: string;
};

/** Helper: compute subtotal from line items */
export function pricingSubtotal(items: PricingLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Helper: compute tax amount */
export function pricingTax(subtotal: number, rate: number): number {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

/** Helper: format AUD currency */
export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Helper: generate a short unique id for line items */
export function generateItemId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Helper: calculate the dollar amount for a milestone payment */
export function milestoneAmount(payment: MilestonePayment, projectTotal: number): number {
  if (payment.type === 'fixed') return payment.value;
  return Math.round(projectTotal * (payment.value / 100) * 100) / 100;
}

/** Helper: sum of all milestone percentages */
export function milestoneTotalPercent(payments: MilestonePayment[]): number {
  return payments
    .filter((p) => p.type === 'percentage')
    .reduce((sum, p) => sum + p.value, 0);
}

/** Helper: sum of all milestone fixed amounts */
export function milestoneTotalFixed(payments: MilestonePayment[]): number {
  return payments
    .filter((p) => p.type === 'fixed')
    .reduce((sum, p) => sum + p.value, 0);
}

// ─── Package types ────────────────────────────────────────────────────────────

// Individual feature within a package
export type PackageFeature = {
  text: string;             // Main feature text e.g. "Funnel management to optimise..."
  bold_prefix: string | null; // Optional bold lead-in e.g. "Funnel management" (null = no bold)
  children: string[];       // Nested sub-features e.g. under "Local SEO"
};

// A single package/tier
export type PackageTier = {
  id: string;
  name: string;
  price: number;
  price_prefix: string;
  price_suffix: string;
  is_recommended: boolean;
  highlight_color: string | null;     // Override accent color for this tier
  conditions: string[];
  features: PackageFeature[];
  sort_order: number;
  card_bg_color?: string | null;      // Per-tier card background
  card_text_color?: string | null;    // Per-tier card text color
};

// Full packages record for a proposal
export type ProposalPackages = {
  id: string;
  proposal_id: string;
  company_id: string;
  enabled: boolean;
  position: number;
  indent: number;
  sort_order: number;       // ordering when multiple packages pages exist
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
  styling: PackageStyling;
  created_at: string;
  updated_at: string;
};

export interface PackagesPageData {
  id: string;
  enabled: boolean;
  position: number;
  indent: number;
  sort_order: number;
  title: string;
  intro_text: string | null;
  packages: PackageTier[];
  footer_text: string | null;
  styling: PackageStyling;
}

export const DEFAULT_PACKAGE_TIER_UPDATED: Omit<PackageTier, 'id' | 'sort_order'> = {
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
  card_bg_color: null,
  card_text_color: null,
};

// Template variant (same shape minus proposal-specific fields)
export type TemplatePackages = Omit<ProposalPackages, 'proposal_id'> & {
  template_id: string;
};

export const DEFAULT_PACKAGE_TIER: Omit<PackageTier, 'id' | 'sort_order'> = {
  name: 'Package Name',
  price: 0,
  price_prefix: 'FROM',
  price_suffix: '/month',
  is_recommended: false,
  highlight_color: null,
  conditions: [],
  features: [],
};

// ─── Package styling ──────────────────────────────────────────────────────────

export type PackageStyling = {
  title_color: string | null;
  card_bg_color: string | null;
  card_bg_independent: boolean;
  card_text_color: string | null;
  card_text_independent: boolean;
  recommended_text_color: string | null;
  recommended_bg_color: string | null;
  feature_icon: PackageFeatureIcon;
  border_radius: number;
  border_width: number;
};

export const DEFAULT_PACKAGE_STYLING: PackageStyling = {
  title_color: null,
  card_bg_color: null,
  card_bg_independent: false,
  card_text_color: null,
  card_text_independent: false,
  recommended_text_color: null,
  recommended_bg_color: null,
  feature_icon: 'dot',
  border_radius: 12,
  border_width: 1,
};

// Default state for a new packages page (used by usePackagesState)
export const DEFAULT_PACKAGES_PAGE_DATA: Omit<PackagesPageData, 'id'> = {
  enabled: true,
  position: -1,
  indent: 0,
  sort_order: 0,
  title: 'Your Investment',
  intro_text: null,
  packages: [],
  footer_text: null,
  styling: { ...DEFAULT_PACKAGE_STYLING },
};

/** Normalize styling from DB, filling in defaults for any missing keys */
export function normalizePackageStyling(raw: unknown): PackageStyling {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PACKAGE_STYLING };
  const r = raw as Record<string, unknown>;
  return {
    title_color: (r.title_color as string) ?? null,
    card_bg_color: (r.card_bg_color as string) ?? null,
    card_bg_independent: !!(r.card_bg_independent),
    card_text_color: (r.card_text_color as string) ?? null,
    card_text_independent: !!(r.card_text_independent),
    recommended_text_color: (r.recommended_text_color as string) ?? null,
    recommended_bg_color: (r.recommended_bg_color as string) ?? null,
    feature_icon: (['dot', 'check', 'checkCircle', 'arrow', 'star', 'dash'].includes(r.feature_icon as string)
      ? r.feature_icon as PackageFeatureIcon
      : 'dot'),
    border_radius: typeof r.border_radius === 'number' ? r.border_radius : 12,
    border_width: typeof r.border_width === 'number' ? r.border_width : 1,
  };
}