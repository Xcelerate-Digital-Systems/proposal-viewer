'use client';

import { CheckCircle2, PlayCircle, Lock, PartyPopper } from 'lucide-react';
import type { FunnelStepType } from '@/lib/supabase';

/**
 * Funnelytics-style mini page mockup. Replaces the generic icon disc on
 * page_* step types so a funnel built of Landing → Sales → Checkout → Thank
 * You actually looks like a sequence of pages.
 *
 * Portrait orientation — real web pages are taller than wide. 140×200 keeps
 * each tile comfortably scannable at default board zoom while giving each
 * layout room for hero + body + CTA.
 */
export const PAGE_MOCKUP_W = 160;
export const PAGE_MOCKUP_H = 200;

interface Props {
  stepType: FunnelStepType;
  tint: string;
  selected?: boolean;
}

export default function PageMockup({ stepType, tint, selected }: Props) {
  return (
    <div
      className={`relative bg-white rounded-lg overflow-hidden transition-shadow ${
        selected
          ? 'ring-2 ring-teal ring-offset-2 ring-offset-white shadow-md'
          : 'border border-edge shadow-[0_3px_8px_rgba(20,20,40,0.12)] hover:shadow-lg'
      }`}
      style={{ width: PAGE_MOCKUP_W, height: PAGE_MOCKUP_H }}
    >
      <BrowserChrome />
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col h-[calc(100%-16px)]">
        {renderForType(stepType, tint)}
      </div>
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
    case 'page_form':      return <FormLayout tint={tint} />;
    case 'page_calendar':  return <CalendarLayout tint={tint} />;
    default:               return <LandingLayout tint={tint} />;
  }
}

/* ─── Layouts ──────────────────────────────────────────────────── */

function LandingLayout({ tint }: { tint: string }) {
  return (
    <>
      <Hero tint={tint} h={24} />
      <Heading w="80%" />
      <Line w="100%" />
      <Line w="95%" />
      <Line w="78%" />
      <Line w="60%" />
      <CTA tint={tint} label="Get Started" />
    </>
  );
}

function SalesLayout({ tint }: { tint: string }) {
  return (
    <>
      <Hero tint={tint} h={28} />
      <Heading w="85%" />
      <Line w="100%" />
      <Line w="90%" />
      <Line w="70%" />
      <div className="flex items-center justify-between mt-auto">
        <span className="text-2xs font-bold" style={{ color: tint }}>$49</span>
        <CTA tint={tint} label="Buy" inline />
      </div>
    </>
  );
}

function OptInLayout({ tint }: { tint: string }) {
  return (
    <>
      <Heading w="80%" />
      <Line w="100%" />
      <Line w="65%" />
      <div className="mt-2 space-y-1.5">
        <FieldPlaceholder label="Name" />
        <FieldPlaceholder label="Email" />
      </div>
      <CTA tint={tint} label="Sign Up" />
    </>
  );
}

function CheckoutLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="flex items-center gap-1 mb-1">
        <Lock size={9} className="text-muted" />
        <span className="text-2xs uppercase tracking-wider text-muted font-semibold">Secure Checkout</span>
      </div>
      <FieldPlaceholder label="Email" />
      <FieldPlaceholder label="Card" />
      <FieldPlaceholder label="Address" />
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xs text-muted">Total</span>
        <span className="text-2xs font-bold" style={{ color: tint }}>$97.00</span>
      </div>
      <CTA tint={tint} label="Place Order" />
    </>
  );
}

function ThankYouLayout({ tint }: { tint: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full">
      <PartyPopper size={32} style={{ color: tint }} strokeWidth={2.2} />
      <div className="text-2xs font-bold text-ink mt-1.5">Congratulations!</div>
      <div className="text-2xs text-muted">Thank You</div>
      <Line w="80%" />
      <Line w="60%" />
      <CheckCircle2 size={12} style={{ color: tint }} className="mt-1" />
    </div>
  );
}

function FormLayout({ tint }: { tint: string }) {
  return (
    <>
      <Heading w="70%" />
      <Line w="95%" />
      <Line w="60%" />
      <div className="mt-1.5 space-y-1">
        <FieldPlaceholder label="Name" />
        <FieldPlaceholder label="Email" />
        <FieldPlaceholder label="Phone" />
        <div className="h-6 rounded-sm bg-surface border border-edge/60 flex items-start px-1 pt-0.5">
          <span className="text-2xs text-muted/80">Message</span>
        </div>
      </div>
      <CTA tint={tint} label="Submit" />
    </>
  );
}

function CalendarLayout({ tint }: { tint: string }) {
  // Mini month grid: 4 rows × 7 cols, current day tinted, one cell "booked".
  const cells = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-bold text-ink">Book a Time</span>
        <span className="text-2xs text-muted">Mar 2026</span>
      </div>
      <div className="grid grid-cols-7 gap-[1.5px] mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-2xs font-semibold text-muted">{d}</div>
        ))}
        {cells.map((n) => {
          const isToday = n === 12;
          const isBooked = n === 18;
          return (
            <div
              key={n}
              className={`text-center text-2xs py-[1px] rounded-[1.5px] ${
                isToday ? 'text-white font-bold' : isBooked ? 'text-white' : 'text-ink/60 bg-surface/60'
              }`}
              style={
                isToday ? { backgroundColor: tint }
                : isBooked ? { backgroundColor: `${tint}99` }
                : undefined
              }
            >
              {n}
            </div>
          );
        })}
      </div>
      <CTA tint={tint} label="Confirm Time" />
    </>
  );
}

function UpsellLayout({ tint, badge }: { tint: string; badge: string }) {
  return (
    <>
      <div
        className="text-2xs font-bold uppercase tracking-wider text-center py-0.5 rounded-sm"
        style={{ backgroundColor: tint, color: 'white' }}
      >
        {badge}
      </div>
      <Hero tint={tint} h={22} mt={4} />
      <Heading w="80%" />
      <Line w="100%" />
      <Line w="85%" />
      <CTA tint={tint} label="Yes, Add to Order" />
      <div className="text-2xs text-center text-muted underline mt-1">No thanks</div>
    </>
  );
}

function WebinarLayout({ tint }: { tint: string }) {
  return (
    <>
      <div className="h-16 rounded-sm bg-ink/85 flex items-center justify-center mb-1">
        <PlayCircle size={28} className="text-white/95" />
      </div>
      <Heading w="85%" />
      <Line w="100%" />
      <Line w="75%" />
      <CTA tint={tint} label="Register" />
    </>
  );
}

/* ─── Primitives ───────────────────────────────────────────────── */

function Hero({ tint, h, mt = 0 }: { tint: string; h: number; mt?: number }) {
  return <div className="rounded-sm w-full" style={{ height: h, backgroundColor: tint, marginTop: mt }} />;
}

function Heading({ w }: { w: string }) {
  return <div className="h-1.5 rounded-full bg-ink/55 mt-1.5" style={{ width: w }} />;
}

function Line({ w }: { w: string }) {
  return <div className="h-1 rounded-full bg-ink/15 mt-1" style={{ width: w }} />;
}

function FieldPlaceholder({ label }: { label?: string }) {
  return (
    <div className="h-3.5 rounded-sm bg-surface border border-edge/60 flex items-center px-1">
      {label && <span className="text-2xs text-muted/80">{label}</span>}
    </div>
  );
}

function CTA({ tint, label, inline = false }: { tint: string; label: string; inline?: boolean }) {
  return (
    <div
      className={`${inline ? 'inline-flex' : 'flex'} items-center justify-center rounded-sm px-2 py-1 text-2xs font-semibold text-white mt-auto`}
      style={{ backgroundColor: tint }}
    >
      {label}
    </div>
  );
}
