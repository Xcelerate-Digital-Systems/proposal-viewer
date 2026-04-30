// components/admin/ads/ReferenceTabContent.tsx
'use client';

import {
  AWARENESS_LEVELS,
  MARKET_SOPHISTICATION_LEVELS,
} from '@/lib/ad-tracker/constants';

type TabType = 'angles' | 'formats' | 'awareness' | 'sophistication';

type Props = {
  type: TabType;
};

// ─── Angles Menu Data ────────────────────────────────────────────────────────

type AngleIdea = {
  name: string;
  exampleHook: string;
  sophistication: string;
};

type AngleCategory = {
  name: string;
  description: string;
  ideas: AngleIdea[];
};

const ANGLE_CATEGORIES: AngleCategory[] = [
  {
    name: '🧠 Clarity & Value',
    description: 'Simplifies a complex offer or promise so the audience instantly understands what they get and why it matters.',
    ideas: [
      { name: '3-Step System', exampleHook: '"Our 3-step process helps you achieve [outcome] faster and with less stress."', sophistication: 'L3' },
      { name: 'Explain It Like I\'m Five', exampleHook: '"Here\'s exactly how this works — no jargon, no fluff."', sophistication: 'L1–L2' },
      { name: 'Real-Math', exampleHook: '"We spent $1 → made $6 — here\'s the simple math behind it."', sophistication: 'L4' },
      { name: 'Gain / Benefit', exampleHook: '"Imagine doubling your revenue without doubling your hours."', sophistication: 'L1–L3' },
    ],
  },
  {
    name: '💪 Identity & Alignment',
    description: 'Connects to who the audience believes they are or want to become, creating belonging and aspiration.',
    ideas: [
      { name: 'People Like Us', exampleHook: '"For people who refuse to settle for average results."', sophistication: 'L2–L3' },
      { name: 'Reclaim Control', exampleHook: '"You built this to gain freedom — not more stress."', sophistication: 'L5' },
      { name: 'Personal Evolution', exampleHook: '"You\'re not unmotivated — you just need a system that works."', sophistication: 'L5' },
      { name: 'Status / Elite Positioning', exampleHook: '"The strategies only top 1% use."', sophistication: 'L3–L5' },
      { name: 'Community / Movement', exampleHook: '"Join thousands rewriting what success looks like."', sophistication: 'L2–L4' },
    ],
  },
  {
    name: '⚔️ Enemy / Contrarian',
    description: 'Challenges a common belief or calls out an enemy, positioning your brand as the alternative.',
    ideas: [
      { name: 'Industry Call-Out', exampleHook: '"Most [industry pros] do this wrong — here\'s the truth."', sophistication: 'L5' },
      { name: 'Common Enemy', exampleHook: '"[Big companies / systems] profit from keeping you stuck."', sophistication: 'L5' },
      { name: 'Old vs. New Way', exampleHook: '"How 99% do it vs. how the top 1% do it."', sophistication: 'L3–L4' },
    ],
  },
  {
    name: '📊 Proof & Transformation',
    description: 'Demonstrates results or success stories that show the promise works in real life.',
    ideas: [
      { name: 'Case Study', exampleHook: '"How [client/person] achieved [result] in [timeframe]."', sophistication: 'L4' },
      { name: 'Before & After', exampleHook: '"From [pain state] to [dream state] in just weeks."', sophistication: 'L3' },
      { name: 'Screenshot Proof', exampleHook: '"Actual results from last month 👇"', sophistication: 'L4' },
    ],
  },
  {
    name: '⚙️ Mechanism / Education',
    description: 'Reveals the how behind your unique system or process, turning curiosity into understanding.',
    ideas: [
      { name: 'Behind-the-Scenes', exampleHook: '"Here\'s exactly what happens when you use this method."', sophistication: 'L3' },
      { name: 'Hidden Mechanism', exampleHook: '"Why this approach works when others don\'t."', sophistication: 'L3' },
      { name: 'Counter-Intuitive', exampleHook: '"Why doing less can actually get you more results."', sophistication: 'L5' },
      { name: 'Proprietary System', exampleHook: '"Introducing The 4-Phase Profit Method™."', sophistication: 'L3' },
      { name: 'Analogy / Metaphor', exampleHook: '"Your marketing funnel is a leaky bucket — here\'s how to plug it."', sophistication: 'L2–L3' },
    ],
  },
  {
    name: '💥 Pattern Interrupt & Curiosity',
    description: 'Uses surprise, contrast, or intrigue to grab attention and spark immediate engagement.',
    ideas: [
      { name: 'Wrong Belief', exampleHook: '"Everyone thinks this… but they\'re wrong."', sophistication: 'L5' },
      { name: 'Shock Opener', exampleHook: '"I almost gave up — and then this happened."', sophistication: 'L2–L4' },
      { name: 'Weird Rule', exampleHook: '"The one rule I follow that changed everything."', sophistication: 'L3' },
      { name: 'Mistake / Warning', exampleHook: '"If you\'re doing this one thing, you\'re losing money every month."', sophistication: 'L3–L4' },
      { name: 'Burning Question', exampleHook: '"What if everything you\'ve been told about [this] was wrong?"', sophistication: 'L1–L3' },
    ],
  },
  {
    name: '⏰ Offer & Urgency',
    description: 'Drives fast action with time-sensitive, limited, or high-value offers that trigger immediate response.',
    ideas: [
      { name: 'Limited Intake', exampleHook: '"Only [X spots/time left] to get access."', sophistication: 'L1' },
      { name: 'Micro-Step CTA', exampleHook: '"Take this quick quiz to see if you qualify."', sophistication: 'L2' },
      { name: 'Value Stack', exampleHook: '"You get [$X of value] for free when you join today."', sophistication: 'L2–L3' },
    ],
  },
  {
    name: '❤️ Emotional Resonance',
    description: 'Taps into raw feelings like relief, pride, guilt, or hope to create a human connection.',
    ideas: [
      { name: 'Vulnerable Confession', exampleHook: '"I was ready to quit — until I discovered this."', sophistication: 'L2' },
      { name: 'I Was You', exampleHook: '"If you feel stuck, here\'s what finally worked for me."', sophistication: 'L3' },
      { name: 'Emotional Payoff', exampleHook: '"Imagine waking up knowing [problem] is finally solved."', sophistication: 'L1–L2' },
      { name: 'Existing Pain', exampleHook: '"Tired of working harder every month for the same result?"', sophistication: 'L1–L2' },
    ],
  },
  {
    name: '🔮 Novelty / Futureproof',
    description: 'Positions the offer as new, innovative, or ahead of the curve, appealing to early adopters.',
    ideas: [
      { name: 'AI Empowerment', exampleHook: '"How AI tools are transforming how [industry] gets results."', sophistication: 'L3' },
      { name: 'Future Forecast', exampleHook: '"The 2026 strategy every [job title] needs to know now."', sophistication: 'L4–L5' },
      { name: 'The Shift Is Here', exampleHook: '"Everything is changing — here\'s how to stay ahead."', sophistication: 'L5' },
    ],
  },
];

// ─── Creative Format Data ────────────────────────────────────────────────────

type FormatArchetype = {
  name: string;
  example: string;
};

type FormatFamily = {
  name: string;
  description: string;
  archetypes: FormatArchetype[];
};

const FORMAT_FAMILIES: FormatFamily[] = [
  {
    name: '👩\u200D🦰 Human / Relatable',
    description: 'Authentic, story-driven content that feels personal, emotional, and unscripted — connects through empathy and identity.',
    archetypes: [
      { name: 'Real UGC Video', example: '"I\'m a midwife who joined this program — here\'s what happened." (phone-style selfie, unpolished, emotional tone)' },
      { name: 'Reaction Video', example: 'Creator reacts to screenshots, testimonials, or common myths — authentic facial expressions.' },
      { name: 'Founder / F2C Video', example: 'Founder or expert speaks directly to camera with mission story or key insight.' },
      { name: 'Paid AGC Video', example: 'Professionally shot UGC (clean lighting, controlled script) that maintains an organic tone.' },
    ],
  },
  {
    name: '🧠 Authority / Proof',
    description: 'Demonstrates credibility, expertise, and results using data, credentials, or legacy — builds trust.',
    archetypes: [
      { name: 'B-Roll + Voice Over', example: 'Montage of results, brand story, or press coverage over voice-over explaining outcomes.' },
      { name: 'Testimonial Montage', example: 'Quick cuts of multiple voices saying results or transformation lines.' },
      { name: 'Before & After Still', example: 'Split screen showing visible or emotional transformation.' },
      { name: 'Branded Still / Broadcast Clip', example: 'Founder or expert shown in professional or news context; proof-driven text overlays.' },
    ],
  },
  {
    name: '💬 Educational / Mechanism',
    description: 'Explains the "how it works" — teaching the viewer the logic or unique method behind the offer.',
    archetypes: [
      { name: 'Loom Style Video', example: 'Screen-record or slides with narration teaching a key idea.' },
      { name: 'Animation / AI Avatar Video', example: 'Simple animated explainer or avatar walking through "how it works."' },
      { name: 'Carousel / Stats Still', example: 'Step-by-step breakdown or mini case study using visuals or data.' },
      { name: 'Analogy Graphic', example: 'Visual metaphor comparing old vs. new system ("Your funnel is a leaky bucket").' },
    ],
  },
  {
    name: '⚡ Pattern Interrupt / Entertainment',
    description: 'Grabs attention fast with humor, surprise, or novelty — disrupts the scroll to earn attention.',
    archetypes: [
      { name: 'Meme / Funny Still', example: 'Popular meme format reframed to highlight pain or irony.' },
      { name: 'Reaction Mashup', example: 'Cuts between audience reactions, TikTok sounds, or trending audio.' },
      { name: 'Text-on-Colour Still / Gif', example: 'Big bold text on flat background with motion pulse or pattern interrupt headline.' },
      { name: 'Weird Rule / Mistake Style Edit', example: '"Everyone does this wrong — here\'s the real reason." Hook-first ad with rapid pacing.' },
    ],
  },
  {
    name: '🎯 Offer / Direct Response',
    description: 'Focuses on urgency, scarcity, or clear value — drives immediate clicks and conversions.',
    archetypes: [
      { name: 'D2O Still', example: 'Simple bold offer ad ("8 Spots Left: Apply for $1,000 Scholarship").' },
      { name: 'Limited Intake Video', example: 'Short 6–15s video with countdown, urgency, or scarcity callout.' },
      { name: 'Carousel (Offer-Focused)', example: 'Each frame explains one benefit or bonus.' },
      { name: 'Stats or Data Still (Quant CTA)', example: '"97% of graduates report better results — Apply today."' },
    ],
  },
];

// ─── Content Components ─────────────────────────────────────────────────────

function AnglesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Angles Menu</h2>
        <p className="text-[13px] text-muted">Core angle categories for structuring your ad messaging. Each angle family represents a different psychological lever.</p>
      </div>
      {ANGLE_CATEGORIES.map((cat) => (
        <div key={cat.name} className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-surface/50">
            <p className="text-[14px] font-semibold text-ink">{cat.name}</p>
            <p className="text-[12px] text-muted mt-0.5">{cat.description}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-t border-gray-100 bg-surface/30">
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Angle Idea</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Example Hook / Headline</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-[120px]">Sophistication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50">
              {cat.ideas.map((idea) => (
                <tr key={idea.name}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-ink whitespace-nowrap">{idea.name}</td>
                  <td className="px-4 py-2.5 text-[13px] text-muted italic">{idea.exampleHook}</td>
                  <td className="px-4 py-2.5 text-[12px] text-faint">{idea.sophistication}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function FormatsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Creative Format Menu</h2>
        <p className="text-[13px] text-muted">Available creative format types grouped by creative family. Choose the format that best fits your angle and target audience.</p>
      </div>
      {FORMAT_FAMILIES.map((fam) => (
        <div key={fam.name} className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-surface/50">
            <p className="text-[14px] font-semibold text-ink">{fam.name}</p>
            <p className="text-[12px] text-muted mt-0.5">{fam.description}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-t border-gray-100 bg-surface/30">
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-[220px]">Format Archetype</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-wider">Example Creative Approach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50">
              {fam.archetypes.map((arch) => (
                <tr key={arch.name}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-ink whitespace-nowrap">{arch.name}</td>
                  <td className="px-4 py-2.5 text-[13px] text-muted">{arch.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function AwarenessContent() {
  const stages = [
    {
      level: 1,
      label: 'Stage 1 – Unaware',
      description: "The market doesn't know they have a problem.",
      whatToDo: 'Lead with empathy, curiosity, or story — not the product. You must reveal the pain or desire before offering a solution.',
      example: '"They thought constant fatigue was just part of motherhood — until one small change transformed everything."',
      style: 'Emotional storytelling, agitation of latent pain, curiosity-based.',
    },
    {
      level: 2,
      label: 'Stage 2 – Problem Aware',
      description: 'They know they have a problem, but not that a solution exists.',
      whatToDo: 'Agitate the pain, describe the symptoms vividly, and hint that a solution is possible.',
      example: '"Struggling to get clients but spending 20+ hours a week on marketing? You\'re not alone."',
      style: 'Pain-focused, empathetic, relatable.',
    },
    {
      level: 3,
      label: 'Stage 3 – Solution Aware',
      description: 'They know solutions exist, but not yours.',
      whatToDo: 'Present your category or method as the best solution — without pushing your brand yet.',
      example: '"New evidence-based breakthrough reveals a faster way to scale without burnout."',
      style: 'Educational, mechanism-focused.',
    },
    {
      level: 4,
      label: 'Stage 4 – Product Aware',
      description: "They know who you are but aren't sure if you're right for them.",
      whatToDo: 'Differentiate your mechanism, show proof, and remove doubts.',
      example: '"Why 100+ midwives worldwide trust this program to grow their practice."',
      style: 'Proof-heavy, testimonial-based, specific.',
    },
    {
      level: 5,
      label: 'Stage 5 – Most Aware',
      description: 'They know you, love you, and just need a reason to act now.',
      whatToDo: 'Use urgency, scarcity, bonuses, or reminders.',
      example: '"Last 8 scholarship spots left to train directly with us this quarter."',
      style: 'Urgency, scarcity, direct CTA.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Awareness Levels</h2>
        <p className="text-[13px] text-muted">Eugene Schwartz&apos;s 5 stages of awareness — describes how aware your audience is of their problem, the solution, and you. You need to meet them where they are at.</p>
      </div>
      {stages.map((stage) => (
        <div key={stage.level} className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-teal/10 text-teal flex items-center justify-center text-sm font-bold shrink-0">
              {stage.level}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink">{stage.label}</p>
              <p className="text-[13px] text-muted">{stage.description}</p>
            </div>
          </div>
          <div className="pl-12 space-y-2">
            <div>
              <p className="text-[12px] font-semibold text-ink">What to do:</p>
              <p className="text-[13px] text-muted">{stage.whatToDo}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-ink">Example:</p>
              <p className="text-[13px] text-muted italic">{stage.example}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-ink">Style:</p>
              <p className="text-[13px] text-faint">{stage.style}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SophisticationContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Market Sophistication</h2>
        <p className="text-[13px] text-muted">Describes how familiar your audience is with promises, solutions, and marketing claims in your category — guiding how bold, specific, or unique your message needs to be. As markets mature, simple claims stop working.</p>
      </div>
      {MARKET_SOPHISTICATION_LEVELS.map((level) => (
        <div key={level.value} className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
              {level.level}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-ink">{level.label}</p>
              <p className="text-[13px] text-muted">{level.description}</p>
            </div>
          </div>
          <div className="pl-12 space-y-2">
            <div>
              <p className="text-[12px] font-semibold text-ink">What to do:</p>
              <p className="text-[13px] text-muted">{level.whatToDo}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-ink">Example:</p>
              <p className="text-[13px] text-muted italic">{level.example}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const CONTENT: Record<TabType, () => JSX.Element> = {
  angles: AnglesContent,
  formats: FormatsContent,
  awareness: AwarenessContent,
  sophistication: SophisticationContent,
};

export default function ReferenceTabContent({ type }: Props) {
  const Content = CONTENT[type];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 lg:p-10">
        <Content />
      </div>
    </div>
  );
}

export type { TabType };
