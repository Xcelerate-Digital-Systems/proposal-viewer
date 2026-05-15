'use client';

import { CheckCircle2, PlayCircle, Lock } from 'lucide-react';
import type { FunnelStepType } from '@/lib/supabase';

/**
 * Funnelytics-style mini page mockup. Replaces the generic icon disc on
 * page_* step types so a funnel built of Landing → Sales → Checkout → Thank
 * You actually looks like a sequence of pages.
 *
 * Layout per type is fixed but uses the step's tint so opt-in/sales/checkout
 * etc. read at a glance. Width/height kept consistent at 200×120 so step
 * positioning stays predictable regardless of type.
 */
export const PAGE_MOCKUP_W = 200;
export const PAGE_MOCKUP_H = 120;

interface Props {
  stepType: FunnelStepType;
  tint: string;
  selected?: boolean;
}

export default function PageMockup({ stepType, tint, selected }: Props) {
  return (
    <div
      className={`relative bg-white rounded-md overflow-hidden transition-shadow ${
        selected
          ? 'ring-2 ring-teal ring-offset-2 ring-offset-white shadow-md'
          : 'border border-edge shadow-[0_3px_8px_rgba(20,20,40,0.12)] hover:shadow-lg'
      }`}
      style={{ width: PAGE_MOCKUP_W, height: PAGE_MOCKUP_H }}
    >
      <BrowserChrome />
      <div className="px-3 pt-2 pb-2">{renderForType(stepType, tint)}</div>
    </div>
  );
}

function BrowserChrome() {
  return (
    <div className="h-4 bg-surface flex items-center px-1.5 gap-[3px] border-b border-edge">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <div className="ml-1 flex-1 h-2 bg-white rounded-sm border border-edge/60" />
    </div>
  );
}

function renderForType(t: FunnelStepType, tint: string) {
  switch (t) {
    case 'page_landing':   return <LandingLayout tint={tint} />;
    case 'page_sales':     return <SalesLayout tint={tint} />;
    case 'page_optin':     return <OptInLayout tint={tint} />;
    case 'page_checkout':  return <CheckoutLayout tint={tint} />;
    case 'page_thankyou':  return <ThankYouLayout tint={tint} />;
    case 'page_upsell':    return <UpsellLayout tint={tint} badge="Limited Offer" />;
    case 'page_downsell':  return <UpsellLayout tint={tint} badge="One-Time Deal" />;
    case 'page_webinar':   return <WebinarLayout tint={tint} />;
    default:               return <LandingLayout tint={tint} />;
  }
}

/* ─── Layouts ──────────────────────────────────────────────────── */

function LandingLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="h-3 rounded-sm w-[70%]" style={{ backgroundColor: tint }} />
      <Line w="100%" />
      <Line w="85%" />
      <Line w="60%" />
      <CTA tint={tint} label="Get Started" mt={6} />
    </>
  );
}

function SalesLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="h-3 rounded-sm w-[60%]" style={{ backgroundColor: tint }} />
      <Line w="100%" />
      <Line w="78%" />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[8px] font-bold" style={{ color: tint }}>$49</span>
        <CTA tint={tint} label="Buy Now" inline />
      </div>
    </>
  );
}

function OptInLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="h-3 rounded-sm w-[55%]" style={{ backgroundColor: tint }} />
      <Line w="90%" />
      <FieldPlaceholder />
      <FieldPlaceholder />
      <CTA tint={tint} label="Sign Up" mt={2} />
    </>
  );
}

function CheckoutLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="flex items-center gap-1">
        <Lock size={8} className="text-muted" />
        <span className="text-[7px] uppercase tracking-wider text-muted font-semibold">Secure Checkout</span>
      </div>
      <FieldPlaceholder />
      <FieldPlaceholder />
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[8px] text-muted">Total</span>
        <span className="text-[9px] font-bold" style={{ color: tint }}>$97.00</span>
      </div>
      <CTA tint={tint} label="Place Order" mt={2} />
    </>
  );
}

function ThankYouLayout({ tint }: { tint: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full -mt-1">
      <CheckCircle2 size={20} style={{ color: tint }} strokeWidth={2.2} />
      <div className="text-[8px] font-semibold text-ink mt-1.5">Thank You!</div>
      <Line w="70%" />
      <Line w="50%" />
    </div>
  );
}

function UpsellLayout({ tint, badge }: { tint: string; badge: string }) {
  return (
    <>
      <div
        className="text-[7px] font-bold uppercase tracking-wider text-center py-0.5 rounded-sm"
        style={{ backgroundColor: tint, color: 'white' }}
      >
        {badge}
      </div>
      <Line w="100%" />
      <Line w="80%" />
      <div className="flex items-center gap-1.5 mt-1">
        <CTA tint={tint} label="Yes, Add" inline />
        <span className="text-[7px] text-muted underline">No thanks</span>
      </div>
    </>
  );
}

function WebinarLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="h-9 rounded-sm bg-ink/85 flex items-center justify-center">
        <PlayCircle size={16} className="text-white/95" />
      </div>
      <Line w="80%" />
      <CTA tint={tint} label="Register" mt={2} />
    </>
  );
}

/* ─── Primitives ───────────────────────────────────────────────── */

function Line({ w }: { w: string }) {
  return <div className="h-1 rounded-full bg-ink/15 mt-1" style={{ width: w }} />;
}

function FieldPlaceholder() {
  return <div className="h-2.5 rounded-sm bg-surface border border-edge/60 mt-1" />;
}

function CTA({ tint, label, mt = 4, inline = false }: { tint: string; label: string; mt?: number; inline?: boolean }) {
  return (
    <div
      className={`${inline ? 'inline-flex' : 'flex'} items-center justify-center rounded-sm px-2 py-0.5 text-[8px] font-semibold text-white`}
      style={{ backgroundColor: tint, marginTop: mt }}
    >
      {label}
    </div>
  );
}
