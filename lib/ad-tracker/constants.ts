// lib/ad-tracker/constants.ts

import type {
  AwarenessLevel,
  MarketSophistication,
  AdCreativeStatus,
  AdWinnerStatus,
  AdIterationType,
  AdMediaType,
  AdCopyVariantType,
} from '@/lib/types/ads';

// ─── Awareness Levels (Eugene Schwartz framework) ────────────────────────────

export const AWARENESS_LEVELS: {
  value: AwarenessLevel;
  label: string;
  description: string;
}[] = [
  { value: 'unaware', label: 'Unaware', description: "Doesn't know they have a problem" },
  { value: 'problem_aware', label: 'Problem Aware', description: 'Knows the problem, not the solution' },
  { value: 'solution_aware', label: 'Solution Aware', description: 'Knows solutions exist, not your product' },
  { value: 'product_aware', label: 'Product Aware', description: 'Knows your product, not yet convinced' },
  { value: 'most_aware', label: 'Most Aware', description: 'Knows and wants, just needs a push' },
];

// ─── Market Sophistication (Eugene Schwartz framework) ───────────────────────

export const MARKET_SOPHISTICATION_LEVELS: {
  value: MarketSophistication;
  level: number;
  label: string;
  description: string;
  whatToDo: string;
  example: string;
}[] = [
  { value: 'simple_claim', level: 1, label: 'Level 1 – Simple Claim', description: 'The market has never heard a promise like yours before.', whatToDo: 'Make a clear, direct claim. Bold, simple, unrefined.', example: '"Lose weight fast." "Get leads with Facebook Ads."' },
  { value: 'enlarged_claim', level: 2, label: 'Level 2 – Stronger Claim', description: 'The market has heard similar claims, so you must amplify yours.', whatToDo: 'Make a bigger, more specific promise or introduce proof. Add credibility, speed, or guarantee.', example: '"Lose 10 pounds in 10 days — guaranteed."' },
  { value: 'unique_mechanism', level: 3, label: 'Level 3 – Mechanism', description: 'The market is saturated with promises; they want to know why yours works better.', whatToDo: 'Introduce a unique mechanism — your method, process, or system. Shift focus from outcome to the unique way you get the outcome.', example: '"Lose 10 pounds in 10 days using the new Fat-Burning Zone method."' },
  { value: 'proof_heavy', level: 4, label: 'Level 4 – Mechanism + Proof', description: 'The market has seen multiple "mechanisms," so they\'re skeptical.', whatToDo: 'Prove why your mechanism works better, faster, easier. Use case studies, results, authority.', example: '"Why the Ketogenic Cycle System burns 3x more fat — backed by 27 clinical studies."' },
  { value: 'contrarian', level: 5, label: 'Level 5 – Contrarian', description: 'The market is jaded — they\'ve seen every mechanism and claim.', whatToDo: 'Go against the grain or reframe the problem entirely. Thought leadership, myth-busting, controversial.', example: '"Forget weight loss — it\'s not your metabolism, it\'s your sleep hormone."' },
];

// ─── Ad Creative Status ──────────────────────────────────────────────────────

export const AD_CREATIVE_STATUSES: {
  value: AdCreativeStatus;
  label: string;
  color: string;
}[] = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'briefed', label: 'Briefed', color: 'blue' },
  { value: 'in_production', label: 'In Production', color: 'purple' },
  { value: 'ready', label: 'Ready', color: 'teal' },
  { value: 'live', label: 'Live', color: 'green' },
  { value: 'paused', label: 'Paused', color: 'amber' },
  { value: 'killed', label: 'Killed', color: 'red' },
];

// ─── Winner Status ───────────────────────────────────────────────────────────

export const AD_WINNER_STATUSES: {
  value: AdWinnerStatus;
  label: string;
  color: string;
}[] = [
  { value: 'yes', label: 'Winner', color: 'green' },
  { value: 'scaled', label: 'Scaled', color: 'green' },
  { value: 'no', label: 'No', color: 'gray' },
  { value: 'didnt_win', label: "Didn't Win", color: 'red' },
  { value: 'stopped', label: 'Stopped', color: 'red' },
  { value: 'fatigued', label: 'Fatigued', color: 'amber' },
];

// ─── Iteration Type ──────────────────────────────────────────────────────────

export const AD_ITERATION_TYPES: { value: AdIterationType; label: string }[] = [
  { value: 'new', label: 'New Ad' },
  { value: 'iteration', label: 'Iteration' },
];

// ─── Media Type ──────────────────────────────────────────────────────────────

export const AD_MEDIA_TYPES: { value: AdMediaType; label: string }[] = [
  { value: 'still', label: 'Still' },
  { value: 'video', label: 'Video' },
];

// ─── Signal (where the ad idea came from) ───────────────────────────────────

export const AD_SIGNALS: { value: string; label: string }[] = [
  { value: 'lead_form', label: 'Lead Form' },
  { value: 'sales_call', label: 'Sales Call' },
  { value: 'testimonial_video', label: 'Testimonial Video' },
  { value: 'ext_organic', label: 'Ext. Organic' },
  { value: 'winning_ad_on_account', label: 'Winning Ad On Account' },
  { value: 'competitor_swipe', label: 'Competitor Swipe' },
  { value: 'news_media', label: 'News/Media' },
  { value: 'another_client_winning_ad', label: 'Another Client Winning Ad' },
];

// ─── Angle Family ───────────────────────────────────────────────────────────

export const AD_ANGLE_FAMILIES: { value: string; label: string; description: string }[] = [
  { value: 'social_proof', label: '🏆 Social Proof', description: 'Testimonials, case studies, results' },
  { value: 'authority', label: '👔 Authority', description: 'Expert positioning, credentials, media features' },
  { value: 'pain_agitation', label: '😣 Pain / Agitation', description: 'Highlight the problem, frustration, cost of inaction' },
  { value: 'desire_aspiration', label: '✨ Desire / Aspiration', description: 'Dream outcome, lifestyle, transformation' },
  { value: 'logic_education', label: '🧠 Logic / Education', description: 'Teach something, data-driven, myth-busting' },
  { value: 'curiosity_pattern_interrupt', label: '🔮 Curiosity / Pattern Interrupt', description: 'Unexpected hook, contrarian take, "wait what?"' },
  { value: 'urgency_scarcity', label: '⏳ Urgency / Scarcity', description: 'Limited time, limited spots, deadline-driven' },
  { value: 'community_belonging', label: '🤝 Community / Belonging', description: 'Join others like you, movement, identity' },
];

// ─── Creative Style ─────────────────────────────────────────────────────────

export const AD_CREATIVE_STYLES: { value: string; label: string }[] = [
  { value: 'human_relatable', label: '🧑 Human / Relatable' },
  { value: 'polished_brand', label: '✨ Polished / Brand' },
  { value: 'raw_ugc', label: '📱 Raw / UGC' },
  { value: 'editorial_educational', label: '📰 Editorial / Educational' },
  { value: 'meme_trend', label: '😂 Meme / Trend' },
];

// ─── Creative Format ────────────────────────────────────────────────────────

export const AD_CREATIVE_FORMATS: { value: string; label: string }[] = [
  { value: 'ai_avatar_video', label: 'AI Avatar Video' },
  { value: 'real_ugc_video', label: 'Real UGC Video' },
  { value: 'ai_ugc_video', label: 'AI UGC Video' },
  { value: 'ai_b_roll', label: 'AI B-Roll' },
  { value: 'real_b_roll', label: 'Real B-Roll' },
  { value: 'ai_ugc_still', label: 'AI UGC Still' },
  { value: 'static_graphic', label: 'Static Graphic' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'real_ugc_still', label: 'Real UGC Still' },
  { value: 'founder_led_video', label: 'Founder-Led Video' },
  { value: 'screen_recording', label: 'Screen Recording' },
  { value: 'slideshow_video', label: 'Slideshow Video' },
  { value: 'stock_footage_mashup', label: 'Stock Footage Mashup' },
  { value: 'whiteboard_explainer', label: 'Whiteboard / Explainer' },
  { value: 'podcast_clip', label: 'Podcast Clip' },
  { value: 'interview_testimonial', label: 'Interview / Testimonial' },
  { value: 'before_after', label: 'Before & After' },
  { value: 'meme_format', label: 'Meme Format' },
  { value: 'gif', label: 'Gif' },
];

// ─── Copy Variant Types ──────────────────────────────────────────────────────

export const AD_COPY_VARIANT_TYPES: { value: AdCopyVariantType; label: string }[] = [
  { value: 'headline', label: 'Headline' },
  { value: 'primary_text', label: 'Primary Text' },
  { value: 'description', label: 'Description' },
  { value: 'cta', label: 'CTA' },
];
