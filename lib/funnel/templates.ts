// lib/funnel/templates.ts
//
// Seeded starter funnels. Each template describes a small ordered list of
// steps + edges. They're loaded into the new-funnel modal as quick-start
// options so prospects/clients can see "10 minute setup" rather than starting
// from blank.
//
// Positions are calibrated for a default zoom canvas — each step is 280px to
// the right of the previous one at y=200. React Flow's fitView re-centres on
// load anyway.

import type { FunnelStepType, FunnelStepMetrics } from '@/lib/supabase';

export interface TemplateStepSeed {
  /** Local id used by edge seeds to reference this step. Not stored. */
  key: string;
  step_type: FunnelStepType;
  label?: string;
  icon?: string;
  color?: string;
  metrics?: FunnelStepMetrics;
}

export interface TemplateEdgeSeed {
  from: string;
  to: string;
  label?: string;
  split_percent?: number;
  animated?: boolean;
}

export interface FunnelTemplate {
  slug: string;
  name: string;
  description: string;
  /** Category for the picker tabs. */
  category: 'leadgen' | 'sales' | 'ecommerce' | 'service' | 'course';
  steps: TemplateStepSeed[];
  edges: TemplateEdgeSeed[];
}

const ROW_Y = 200;
const STEP_X = (i: number) => 80 + i * 280;

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    slug: 'lead-magnet',
    name: 'Lead Magnet',
    description: 'Free download → email sequence → core offer.',
    category: 'leadgen',
    steps: [
      { key: 'src',   step_type: 'traffic_paid',     label: 'Paid Ads',    icon: 'megaphone', metrics: { visitors: 5000, cost: 0.50 } },
      { key: 'opt',   step_type: 'page_optin',       label: 'Opt-In Page', metrics: { conversion_rate: 25 } },
      { key: 'ty',    step_type: 'page_thankyou',    label: 'Thank You',   metrics: { conversion_rate: 60 } },
      { key: 'offer', step_type: 'offer_product',    label: 'Core Offer',  metrics: { conversion_rate: 8, value: 97 } },
    ],
    edges: [
      { from: 'src', to: 'opt' },
      { from: 'opt', to: 'ty' },
      { from: 'ty',  to: 'offer' },
    ],
  },
  {
    slug: 'tripwire',
    name: 'Tripwire',
    description: 'Low-ticket entry → core offer → high-ticket upsell.',
    category: 'sales',
    steps: [
      { key: 'src',     step_type: 'traffic_paid',     label: 'Paid Ads',     icon: 'megaphone', metrics: { visitors: 10000, cost: 0.40 } },
      { key: 'sales',   step_type: 'page_sales',       label: 'Tripwire ($7)', metrics: { conversion_rate: 5, value: 7 } },
      { key: 'upsell',  step_type: 'page_upsell',      label: 'Upsell ($47)',  metrics: { conversion_rate: 30, value: 47 } },
      { key: 'core',    step_type: 'offer_product',    label: 'Core ($297)',   metrics: { conversion_rate: 15, value: 297 } },
    ],
    edges: [
      { from: 'src', to: 'sales' },
      { from: 'sales', to: 'upsell' },
      { from: 'upsell', to: 'core' },
    ],
  },
  {
    slug: 'webinar',
    name: 'Webinar Funnel',
    description: 'Registration → confirmation → live event → replay → offer.',
    category: 'sales',
    steps: [
      { key: 'src',  step_type: 'traffic_paid',   label: 'Paid Ads',     icon: 'megaphone', metrics: { visitors: 8000, cost: 1.20 } },
      { key: 'reg',  step_type: 'page_webinar',   label: 'Registration', metrics: { conversion_rate: 35 } },
      { key: 'conf', step_type: 'page_thankyou',  label: 'Confirmation', metrics: { conversion_rate: 100 } },
      { key: 'show', step_type: 'page_webinar',   label: 'Live Webinar', metrics: { conversion_rate: 40 } },
      { key: 'pitch',step_type: 'offer_course',   label: 'Course Pitch', metrics: { conversion_rate: 12, value: 997 } },
    ],
    edges: [
      { from: 'src',  to: 'reg' },
      { from: 'reg',  to: 'conf' },
      { from: 'conf', to: 'show' },
      { from: 'show', to: 'pitch' },
    ],
  },
  {
    slug: 'application',
    name: 'Application Funnel',
    description: 'VSL → application → strategy call → high-ticket close.',
    category: 'service',
    steps: [
      { key: 'src',   step_type: 'traffic_paid',   label: 'Paid Ads',      icon: 'megaphone', metrics: { visitors: 3000, cost: 2.00 } },
      { key: 'vsl',   step_type: 'page_sales',     label: 'VSL',           metrics: { conversion_rate: 30 } },
      { key: 'app',   step_type: 'page_optin',     label: 'Application',   metrics: { conversion_rate: 25 } },
      { key: 'call',  step_type: 'offer_service',  label: 'Strategy Call', metrics: { conversion_rate: 60 } },
      { key: 'close', step_type: 'offer_service',  label: 'Close',         metrics: { conversion_rate: 30, value: 5000 } },
    ],
    edges: [
      { from: 'src',  to: 'vsl' },
      { from: 'vsl',  to: 'app' },
      { from: 'app',  to: 'call' },
      { from: 'call', to: 'close' },
    ],
  },
  {
    slug: 'book-a-call',
    name: 'Book a Call',
    description: 'Ad → landing → calendar booking → discovery call.',
    category: 'service',
    steps: [
      { key: 'src',     step_type: 'traffic_paid',   label: 'Meta Ads',       icon: 'megaphone', metrics: { visitors: 2000, cost: 3.00 } },
      { key: 'land',    step_type: 'page_landing',   label: 'Landing Page',   metrics: { conversion_rate: 20 } },
      { key: 'cal',     step_type: 'page_optin',     label: 'Book a Time',    metrics: { conversion_rate: 50 } },
      { key: 'show',    step_type: 'offer_service',  label: 'Discovery Call', metrics: { conversion_rate: 65 } },
      { key: 'closed',  step_type: 'offer_service',  label: 'Client Won',     metrics: { conversion_rate: 35, value: 2500 } },
    ],
    edges: [
      { from: 'src',  to: 'land' },
      { from: 'land', to: 'cal' },
      { from: 'cal',  to: 'show' },
      { from: 'show', to: 'closed' },
    ],
  },
  {
    slug: 'ecommerce',
    name: 'E-commerce Checkout',
    description: 'Product page → cart → checkout → upsell → thank you.',
    category: 'ecommerce',
    steps: [
      { key: 'src',    step_type: 'traffic_paid',     label: 'Shopping Ads', icon: 'megaphone', metrics: { visitors: 15000, cost: 0.30 } },
      { key: 'prod',   step_type: 'page_sales',       label: 'Product Page', metrics: { conversion_rate: 12 } },
      { key: 'cart',   step_type: 'page_checkout',    label: 'Cart',         metrics: { conversion_rate: 70 } },
      { key: 'pay',    step_type: 'page_checkout',   label: 'Checkout',     metrics: { conversion_rate: 50, value: 39 } },
      { key: 'up',     step_type: 'page_upsell',      label: 'Order Bump',   metrics: { conversion_rate: 25, value: 19 } },
      { key: 'ty',     step_type: 'page_thankyou',    label: 'Thank You' },
    ],
    edges: [
      { from: 'src',  to: 'prod' },
      { from: 'prod', to: 'cart' },
      { from: 'cart', to: 'pay' },
      { from: 'pay',  to: 'up' },
      { from: 'up',   to: 'ty' },
    ],
  },
  {
    slug: 'free-shipping',
    name: 'Free + Shipping',
    description: 'Free product, customer pays shipping → upsell stack.',
    category: 'ecommerce',
    steps: [
      { key: 'src',    step_type: 'traffic_paid',     label: 'Paid Ads',       icon: 'megaphone', metrics: { visitors: 12000, cost: 0.60 } },
      { key: 'page',   step_type: 'page_sales',       label: 'Free + Shipping', metrics: { conversion_rate: 8, value: 7 } },
      { key: 'up1',    step_type: 'page_upsell',      label: 'Upsell #1',      metrics: { conversion_rate: 25, value: 37 } },
      { key: 'up2',    step_type: 'page_upsell',      label: 'Upsell #2',      metrics: { conversion_rate: 15, value: 97 } },
      { key: 'ty',     step_type: 'page_thankyou',    label: 'Thank You' },
    ],
    edges: [
      { from: 'src',  to: 'page' },
      { from: 'page', to: 'up1' },
      { from: 'up1',  to: 'up2' },
      { from: 'up2',  to: 'ty' },
    ],
  },
  {
    slug: 'course-launch',
    name: 'Course Launch',
    description: 'Pre-launch sequence → cart open → cart close.',
    category: 'course',
    steps: [
      { key: 'list',   step_type: 'traffic_email',    label: 'Email List',    icon: 'mail', metrics: { visitors: 10000 } },
      { key: 'pre',    step_type: 'page_landing',     label: 'Pre-Launch',    metrics: { conversion_rate: 50 } },
      { key: 'sales',  step_type: 'page_sales',       label: 'Sales Page',    metrics: { conversion_rate: 5, value: 497 } },
      { key: 'cart',   step_type: 'page_checkout',    label: 'Checkout',      metrics: { conversion_rate: 75 } },
      { key: 'ty',     step_type: 'page_thankyou',    label: 'Welcome'  },
    ],
    edges: [
      { from: 'list',  to: 'pre' },
      { from: 'pre',   to: 'sales' },
      { from: 'sales', to: 'cart' },
      { from: 'cart',  to: 'ty' },
    ],
  },
  {
    slug: 'quiz',
    name: 'Quiz Funnel',
    description: 'Quiz → segmented offer based on result.',
    category: 'leadgen',
    steps: [
      { key: 'src',    step_type: 'traffic_paid',     label: 'Paid Ads',     icon: 'megaphone', metrics: { visitors: 6000, cost: 0.80 } },
      { key: 'quiz',   step_type: 'page_optin',       label: 'Quiz',         icon: 'sparkles', metrics: { conversion_rate: 55 } },
      { key: 'opt',    step_type: 'page_optin',       label: 'Email Gate',   metrics: { conversion_rate: 60 } },
      { key: 'a',      step_type: 'offer_product',    label: 'Result A',     metrics: { conversion_rate: 8, value: 97 } },
      { key: 'b',      step_type: 'offer_product',    label: 'Result B',     metrics: { conversion_rate: 12, value: 147 } },
    ],
    edges: [
      { from: 'src',  to: 'quiz' },
      { from: 'quiz', to: 'opt' },
      { from: 'opt',  to: 'a', split_percent: 60 },
      { from: 'opt',  to: 'b', split_percent: 40 },
    ],
  },
  {
    slug: 'service-leadgen',
    name: 'Local Service Lead Gen',
    description: 'Local ad → quote page → form → phone call.',
    category: 'service',
    steps: [
      { key: 'src',   step_type: 'traffic_paid',   label: 'Local Ads',   icon: 'megaphone', metrics: { visitors: 1500, cost: 4.00 } },
      { key: 'land',  step_type: 'page_landing',   label: 'Quote Page',  metrics: { conversion_rate: 18 } },
      { key: 'form',  step_type: 'page_optin',     label: 'Lead Form',   metrics: { conversion_rate: 70 } },
      { key: 'call',  step_type: 'offer_service',  label: 'Phone Call',  metrics: { conversion_rate: 50, value: 800 } },
    ],
    edges: [
      { from: 'src',  to: 'land' },
      { from: 'land', to: 'form' },
      { from: 'form', to: 'call' },
    ],
  },
];

export function templatePositionForIndex(i: number) {
  return { board_x: STEP_X(i), board_y: ROW_Y };
}
