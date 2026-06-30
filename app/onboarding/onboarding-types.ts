// Shared types and constants for the onboarding wizard.

export type Step = 'agency' | 'invite' | 'plan' | 'done';
export const STEPS: Step[] = ['agency', 'invite', 'plan', 'done'];

export type CompanyShape = {
  id: string;
  name: string;
  slug: string;
  accent_color: string | null;
  logo_path: string | null;
  logo_url: string | null;
  onboarding_completed_at: string | null;
};

export type PlanShape = {
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
};

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}
