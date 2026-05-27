// app/ads/naming-convention/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Sparkles, Lock, Layers, RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

export default function NamingConventionPage() {
  return (
    <AdminLayout>
      {() => <NamingConvention />}
    </AdminLayout>
  );
}

const SEGMENT_CODES = [
  {
    code: 'OFFER',
    description: 'The campaign or offer code — what the ad is driving leads to',
    examples: 'FREEQUOTE, BOOKCALL, FREEAUDIT, LEADMAGNET',
  },
  {
    code: 'ANGLE',
    description: 'The persuasion argument — why someone should care. Pick from the standard angle list (same tags used in the swipe file).',
    examples: 'CLARITY, IDENTITY, ENEMY, PROOF, MECHANISM, CURIOSITY, URGENCY, EMOTION, NOVELTY',
  },
  {
    code: 'PERSONA',
    description: 'Who the ad is aimed at — short uppercase code for the audience. Define one per client based on their actual customer (see persona section below).',
    examples: 'TRADIES, MUMS, COACHES, GYMOWNERS',
  },
  {
    code: 'FORMAT##',
    description: 'Asset type + zero-padded sequence number',
    examples: 'VID01, IMG03, CAR02, UGC01, STATIC01, GIF01',
  },
  {
    code: 'HOOK##',
    description: 'A numeric counter for hook variations within the same concept. HOOK01 is the first execution, HOOK02 is a re-cut with a different opening shot or burnt-in text. The actual hook description lives on the ad form, not in the filename.',
    examples: 'HOOK01, HOOK02, HOOK03',
  },
];

const FORMAT_CODES = [
  { code: 'VID', label: 'Video' },
  { code: 'IMG', label: 'Static image' },
  { code: 'CAR', label: 'Carousel' },
  { code: 'UGC', label: 'User-generated content / creator' },
  { code: 'STATIC', label: 'Static graphic / designed asset' },
  { code: 'GIF', label: 'GIF / motion graphic' },
];

// Mirrors STANDARD_SWIPE_TAGS in lib/swipe-files/standard-tags.ts
// (emojis stripped, codes shortened for filename use)
const ANGLES = [
  { code: 'CLARITY', desc: 'Clarity & value — make the offer obvious' },
  { code: 'IDENTITY', desc: 'Identity & alignment — "this is for people like me"' },
  { code: 'ENEMY', desc: 'Enemy / contrarian — call out what\'s wrong with the alternative' },
  { code: 'PROOF', desc: 'Proof & transformation — testimonials, before/after, results' },
  { code: 'MECHANISM', desc: 'Mechanism / education — explain how it works' },
  { code: 'CURIOSITY', desc: 'Pattern interrupt & curiosity — open loop, scroll-stopper' },
  { code: 'URGENCY', desc: 'Offer & urgency — deadline, scarcity, limited time' },
  { code: 'EMOTION', desc: 'Emotional resonance — feeling-led storytelling' },
  { code: 'NOVELTY', desc: 'Novelty / future-proof — new, fresh, unseen' },
];

const PERSONA_EXAMPLES = [
  { code: 'TRADIES', desc: 'Tradesmen — plumbers, electricians, builders' },
  { code: 'MUMS', desc: 'Busy mothers / family decision-makers' },
  { code: 'COACHES', desc: 'Online coaches & course creators' },
  { code: 'GYMOWNERS', desc: 'Gym & fitness studio owners' },
  { code: 'CHIROS', desc: 'Chiropractors / clinic owners' },
  { code: 'REALTORS', desc: 'Real estate agents' },
];

const EXAMPLES = [
  {
    name: 'FREEQUOTE_PROOF_TRADIES_VID01_HOOK01',
    note: 'Free quote lead magnet, proof / authority angle, tradies persona, video 1, first hook variant',
  },
  {
    name: 'FREEQUOTE_PROOF_TRADIES_VID01_HOOK02',
    note: 'Same concept re-cut with a different opening shot — new hook variant, same angle',
  },
  {
    name: 'BOOKCALL_IDENTITY_COACHES_IMG03_HOOK01',
    note: 'Book-a-call offer, identity angle ("for coaches like you"), online coaches persona, static image 3',
  },
  {
    name: 'FREEAUDIT_ENEMY_GYMOWNERS_UGC02_HOOK01',
    note: 'Free audit offer, enemy / mythbuster angle, gym owners persona, creator UGC asset 2',
  },
];

const REMIX_TABLE = [
  { element: 'Video first 3 seconds', baked: true, entityId: true },
  { element: 'Static image', baked: true, entityId: true },
  { element: 'Burnt-in text on the creative', baked: true, entityId: true },
  { element: 'Primary text (above the post)', baked: false, entityId: false },
  { element: 'Headline field', baked: false, entityId: false },
  { element: 'Description field', baked: false, entityId: false },
  { element: 'CTA button', baked: false, entityId: false },
];

function NamingConvention() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="border-b border-edge bg-white">
        <div className="max-w-5xl mx-auto px-8 py-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-muted mb-3"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal/10 flex items-center justify-center">
              <BookOpen size={18} className="text-teal" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ink">Ad Naming Convention</h1>
              <p className="text-caption text-faint mt-0.5">
                Post-Andromeda creative naming for AgencyViz
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        {/* Pattern */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Pattern</h2>
          <div className="bg-white rounded-2xl border border-edge px-6 py-5">
            <div className="font-mono text-[15px] text-ink tracking-wide">
              [OFFER]_[ANGLE]_[PERSONA]_[FORMAT##]_[HOOK##]
            </div>
            <div className="mt-3 font-mono text-caption text-teal">
              FREEQUOTE_PROOF_TRADIES_VID01_HOOK02
            </div>
            <p className="text-xs text-faint mt-3">
              Underscores between fields. No spaces. Zero-pad numbers (VID01, not VID1).
              Inside a field use no separator (COSTSAVINGS, not COST_SAVINGS).
            </p>
          </div>
        </section>

        {/* Segment legend */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Segment Legend</h2>
          <div className="bg-white rounded-2xl border border-edge overflow-hidden">
            {SEGMENT_CODES.map((row, i) => (
              <div
                key={row.code}
                className={`flex gap-5 px-6 py-4 ${i < SEGMENT_CODES.length - 1 ? 'border-b border-edge' : ''}`}
              >
                <span className="font-mono text-xs text-teal shrink-0 w-[110px] pt-0.5">
                  {row.code}
                </span>
                <div className="min-w-0">
                  <p className="text-caption text-ink leading-relaxed">{row.description}</p>
                  <p className="text-xs text-faint mt-1 font-mono">{row.examples}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Angle list */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-1">Angle List</h2>
          <p className="text-xs text-faint mb-3">
            Same nine angles used as standard tags in the swipe file. Pick one per ad.
          </p>
          <div className="bg-white rounded-2xl border border-edge overflow-hidden">
            {ANGLES.map((row, i) => (
              <div
                key={row.code}
                className={`flex gap-5 px-5 py-3 ${i < ANGLES.length - 1 ? 'border-b border-edge' : ''}`}
              >
                <span className="font-mono text-xs text-teal shrink-0 w-[110px] pt-0.5">
                  {row.code}
                </span>
                <span className="text-xs text-muted">{row.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Persona — how to name */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-1">Persona</h2>
          <p className="text-xs text-faint mb-3">
            Persona is the audience the ad is built for. Unlike angles, there&apos;s no fixed list —
            each client has their own customer. Pick a short, obvious code per client and stick with it.
          </p>

          <div className="bg-white rounded-2xl border border-edge p-5 mb-4">
            <h3 className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">How to name a persona</h3>
            <ul className="space-y-2 text-caption text-muted">
              <li>
                <span className="text-teal font-medium">Use the customer, not the business size.</span>{' '}
                &quot;TRADIES&quot; or &quot;MUMS&quot; tells you who you&apos;re talking to. &quot;SMB&quot; doesn&apos;t.
              </li>
              <li>
                <span className="text-teal font-medium">Keep it short and uppercase.</span>{' '}
                One word ideally. Pluralised so it reads naturally (&quot;COACHES&quot; not &quot;COACH&quot;).
              </li>
              <li>
                <span className="text-teal font-medium">Define it once per client.</span>{' '}
                Write it down for the client and reuse the same code on every ad. Don&apos;t invent variants.
              </li>
              <li>
                <span className="text-teal font-medium">If a client has two distinct audiences,</span>{' '}
                use two persona codes (e.g. <span className="font-mono text-xs">TRADIES</span> and{' '}
                <span className="font-mono text-xs">OFFICEMGR</span>) and run them as parallel tests.
              </li>
            </ul>
          </div>

          <p className="text-xs text-faint mb-2">Example persona codes you might define:</p>
          <div className="bg-white rounded-2xl border border-edge overflow-hidden">
            {PERSONA_EXAMPLES.map((row, i) => (
              <div
                key={row.code}
                className={`flex gap-5 px-5 py-3 ${i < PERSONA_EXAMPLES.length - 1 ? 'border-b border-edge' : ''}`}
              >
                <span className="font-mono text-xs text-teal shrink-0 w-[110px] pt-0.5">
                  {row.code}
                </span>
                <span className="text-xs text-muted">{row.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Format codes */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Format Codes</h2>
          <div className="bg-white rounded-2xl border border-edge overflow-hidden">
            {FORMAT_CODES.map((row, i) => (
              <div
                key={row.code}
                className={`flex items-center gap-4 px-5 py-3 ${i < FORMAT_CODES.length - 1 ? 'border-b border-edge' : ''}`}
              >
                <span className="font-mono text-xs text-teal w-[80px] shrink-0">{row.code}</span>
                <span className="text-caption text-muted">{row.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Examples</h2>
          <div className="space-y-2">
            {EXAMPLES.map((ex) => (
              <div key={ex.name} className="bg-white rounded-2xl border border-edge px-5 py-4">
                <p className="font-mono text-caption text-ink">{ex.name}</p>
                <p className="text-xs text-faint mt-1">{ex.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rules */}
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">Rules</h2>
          <div className="bg-white rounded-2xl border border-edge px-6 py-5 space-y-3">
            {[
              ['Did the argument change?', 'New ANGLE.'],
              ['Did the visual or burnt-in text change?', 'New HOOK (same angle).'],
              ['Did only the primary text or headline field change?', 'Not a new ad — just update the existing one.'],
              ['New angle?', 'Restart the hook counter under the new angle.'],
              ['Headlines, primary text, descriptions, CTAs', 'Live as DB metadata, never in the filename.'],
            ].map(([q, a]) => (
              <div key={q} className="flex gap-3 text-caption">
                <span className="text-teal shrink-0">→</span>
                <p className="text-ink">
                  <span className="font-medium">{q}</span>{' '}
                  <span className="text-muted">{a}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Andromeda explainer */}
        <section className="pt-4 border-t border-edge">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles size={16} className="text-teal" />
            <h2 className="text-base font-semibold text-ink">Meta Andromeda, explained simply</h2>
          </div>
          <p className="text-sm text-muted leading-relaxed mb-6">
            Andromeda is the AI engine Meta now uses to decide which ad to show which person.
            It rolled out globally through late 2024 and 2025 and quietly rewrote the rules of how
            Meta ads work. If you&apos;ve never heard of it, here&apos;s the whole thing in five
            short ideas.
          </p>

          {/* What it is */}
          <div className="bg-white rounded-2xl border border-edge p-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={15} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink">1. What it actually is</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Andromeda is a giant matchmaker. Every time someone opens Facebook or Instagram, Meta
              has to pick one ad to show them out of millions of options — in about a tenth of a
              second. Andromeda is the AI brain that does that picking. It looks at the person, it
              looks at every ad in the auction, and it predicts which combination is most likely to
              work. Older systems relied much more on your audience targeting and your bid.
              Andromeda relies almost entirely on the <span className="text-ink font-medium">creative itself</span>.
            </p>
          </div>

          {/* How it sees ads */}
          <div className="bg-white rounded-2xl border border-edge p-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={15} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink">2. How it sees your ads (Entity IDs)</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              When you upload an ad, Andromeda doesn&apos;t see it as &quot;ad #47 in account X.&quot;
              It looks at the actual image or video and gives it a fingerprint based on what it
              looks like. Meta calls this an <span className="text-ink font-medium">Entity ID</span>.
              Two ads that <em>look</em> very similar — same background, same person, same layout —
              get the same fingerprint, even if you uploaded them as separate ads. To Andromeda
              they are literally the same thing.
            </p>
            <p className="text-sm text-muted leading-relaxed mt-3">
              The consequence: if you upload 30 ads that look almost identical, Andromeda groups
              them into maybe 2 or 3 buckets and only one ad in each bucket actually gets shown.
              The other 27 sit there doing nothing. To get real reach you need ads that look
              <span className="text-ink font-medium"> genuinely different</span> from each other —
              different visuals, different opening shots, different overall feel. Quantity is
              meaningless; visual variety is everything.
            </p>
          </div>

          {/* What it impacts */}
          <div className="bg-white rounded-2xl border border-edge p-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={15} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink">3. What it actually impacts</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed mb-4">
              Andromeda changed which parts of an ad matter for performance. The visual side of the
              ad — the bit baked into the image or video file — is now doing almost all of the
              heavy lifting. The text fields around it (primary text, headline, description) matter
              far less than they used to.
            </p>
            <div className="rounded-2xl border border-edge overflow-hidden">
              <div className="grid grid-cols-[1fr_140px_140px] bg-surface text-xs text-faint px-4 py-2.5 font-medium uppercase tracking-wide">
                <div>Element</div>
                <div className="text-center">Baked into asset</div>
                <div className="text-center">Affects Entity ID</div>
              </div>
              {REMIX_TABLE.map((row, i) => (
                <div
                  key={row.element}
                  className={`grid grid-cols-[1fr_140px_140px] px-4 py-3 text-caption items-center ${i < REMIX_TABLE.length - 1 ? 'border-b border-edge' : ''}`}
                >
                  <div className="text-ink">{row.element}</div>
                  <div className="text-center text-muted">{row.baked ? 'Yes' : 'No'}</div>
                  <div className="text-center">
                    {row.entityId ? (
                      <span className="text-teal font-medium">Yes</span>
                    ) : (
                      <span className="text-faint">No</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-caption text-faint mt-3 leading-relaxed">
              The simple version: if you change something inside the image or video file, you have
              made a new ad in Andromeda&apos;s eyes. If you only change the wording around it, you
              basically haven&apos;t.
            </p>
          </div>

          {/* What Meta wants you to do */}
          <div className="bg-white rounded-2xl border border-edge p-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={15} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink">4. What Andromeda rewards</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Andromeda is hungry for fresh, varied creative. The pattern that consistently wins
              under it:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              <li>
                <span className="text-teal font-medium">8–15 genuinely different concepts</span> at
                a time, not 50 near-duplicates
              </li>
              <li>
                <span className="text-teal font-medium">A mix of formats</span> — video, static
                image, carousel, creator-style UGC — not all one type
              </li>
              <li>
                <span className="text-teal font-medium">Multiple persuasion angles</span> running
                in parallel — different reasons people might care
              </li>
              <li>
                <span className="text-teal font-medium">Frequent refreshes</span> — new opening
                shots weekly, new angles every couple of weeks
              </li>
            </ul>
          </div>

          {/* How the naming convention helps */}
          <div className="bg-white rounded-2xl border-2 border-teal/30 p-6">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={15} className="text-teal" />
              <h3 className="text-sm font-semibold text-ink">5. How this naming convention helps</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed mb-4">
              Now look back at the pattern at the top of this page:
            </p>
            <div className="bg-surface rounded-2xl px-4 py-3 mb-4 font-mono text-caption text-ink">
              [OFFER]_[ANGLE]_[PERSONA]_[FORMAT##]_[HOOK##]
            </div>
            <p className="text-sm text-muted leading-relaxed mb-3">
              Every field exists because Andromeda made it matter:
            </p>
            <ul className="space-y-2.5 text-sm text-ink">
              <li>
                <span className="font-mono text-xs text-teal mr-2">ANGLE</span>
                <span className="text-muted">forces us to track <em>which persuasion argument</em> a winning ad used, so we can make more like it.</span>
              </li>
              <li>
                <span className="font-mono text-xs text-teal mr-2">PERSONA</span>
                <span className="text-muted">forces us to label <em>who</em> an ad was made for, so reports can show which audiences a concept actually resonates with.</span>
              </li>
              <li>
                <span className="font-mono text-xs text-teal mr-2">FORMAT</span>
                <span className="text-muted">forces format diversity into the naming itself — we can see at a glance whether we&apos;re leaning too hard on one type.</span>
              </li>
              <li>
                <span className="font-mono text-xs text-teal mr-2">HOOK</span>
                <span className="text-muted">tracks the only thing Andromeda cares about most: what the ad <em>looks like in the first second</em>. Different hook = different fingerprint = different ad in Meta&apos;s eyes.</span>
              </li>
            </ul>
            <p className="text-sm text-muted leading-relaxed mt-4">
              The naming convention isn&apos;t just paperwork. It mirrors exactly how Andromeda
              thinks about your ads — so when we look at our own reports, we&apos;re grouping them
              the same way Meta is. That&apos;s how we figure out what to make more of.
            </p>
          </div>
        </section>

        {/* Sources */}
        <section className="pt-4 pb-12">
          <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-3">
            Sources
          </h2>
          <ul className="space-y-1.5 text-xs text-muted">
            <li>
              <a href="https://adsuploader.com/blog/meta-andromeda" target="_blank" rel="noreferrer" className="hover:text-teal">
                Meta Andromeda Explained: Entity IDs vs Creative Volume — Adsuploader
              </a>
            </li>
            <li>
              <a href="https://motionapp.com/blog/andromeda-impact-on-bfcm" target="_blank" rel="noreferrer" className="hover:text-teal">
                What Meta Andromeda means for creative diversity — Motion
              </a>
            </li>
            <li>
              <a href="https://www.usewonderful.com/blog/meta-andromeda-creative-strategies" target="_blank" rel="noreferrer" className="hover:text-teal">
                Meta&apos;s Andromeda Update: 11 Creative Strategies — Wonderful
              </a>
            </li>
            <li>
              <a href="https://www.jonloomer.com/meta-andromeda/" target="_blank" rel="noreferrer" className="hover:text-teal">
                Meta Andromeda: What It Means for Your Ad Strategy — Jon Loomer
              </a>
            </li>
            <li>
              <a href="https://envisionitagency.com/blog/why-metas-andromeda-update-has-us-completely-rethinking-creative-testing/" target="_blank" rel="noreferrer" className="hover:text-teal">
                Why Andromeda Has Us Rethinking Creative Testing — Envisionit
              </a>
            </li>
            <li>
              <a href="https://searchengineland.com/meta-ai-driven-advertising-system-andromeda-gem-468020" target="_blank" rel="noreferrer" className="hover:text-teal">
                Inside Meta&apos;s AI-driven advertising system: Andromeda + GEM — Search Engine Land
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
