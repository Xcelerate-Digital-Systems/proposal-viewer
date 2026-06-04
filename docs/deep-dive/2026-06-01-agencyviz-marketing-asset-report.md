# AgencyViz Marketing Asset Report

**Date:** 1 June 2026
**Prepared for:** Marketing, Sales, and Content teams
**Source:** Complete codebase audit + existing website copy analysis
**Note:** All testimonials currently on the site are placeholders attributed to "Founding Agency." Real testimonials are needed before scaling any paid channel.

---

## 1. Executive Summary

AgencyViz ("The Agency Toolbox") is a B2B SaaS that consolidates the entire agency-to-client workflow into one white-labeled workspace. It replaces the duct-taped stack of Proposify, Filestage, Funnelytics, Google Docs, and spreadsheets with a single product that handles proposals, quotes, documents, creative review, funnel planning, ad inspiration libraries, and Looker Studio data connectors. The core marketing thesis is simple: everything your client sees lives in one place, opens in the browser, and never requires them to create an account. The founding-member offer ($49/mo locked for life vs. $79/mo standard) gives early adopters a clear incentive to move now.

---

## 2. Product Positioning

### Core Value Proposition

One workspace for everything your agency delivers to clients. Build it, share a link, get sign-off. No more five subscriptions, five logins, and a group chat full of "did you see my feedback?"

### Ideal Customer Profile (ICP)

| Segment | Description | Pain Intensity |
|---|---|---|
| **Digital marketing agencies (5-50 people)** | Running paid media, creative production, and strategy for multiple clients. Juggling 4-6 tools to deliver work. | Very high |
| **Creative/design agencies** | Producing visual assets that need structured client feedback. Currently using email threads or Filestage/Ziflow. | High |
| **Freelancers & boutique shops (1-5 people)** | Need a professional proposal + review workflow but can't justify 4 separate tool subscriptions. | High (budget-driven) |
| **Performance marketing agencies** | Need Looker Studio reporting alongside creative review and proposals. Currently exporting CSVs manually. | High |

### The "Before vs. After" Narrative

**Before AgencyViz (The duct-taped stack):**
- Proposals in Proposify, quotes in a spreadsheet, docs in Google Drive
- Creative feedback buried in email threads and Slack DMs
- Clients download PDFs they never open
- Campaign plans scattered across decks and docs nobody updates
- No single source of truth for revisions or approvals
- Monday mornings spent exporting CSVs for client reports
- Five subscriptions, five logins, five billing dates
- Every tool shows its own branding, not yours

**After AgencyViz (One workspace. Both sides.):**
- Proposals, quotes, docs, templates, creative review, funnel plans, ad inspiration, and reporting connectors in one workspace
- One link per deliverable. Client opens it in the browser. No account, no download, no friction
- Pin feedback on the actual creative. Assign the fix. Track it to done
- Visual funnel maps replace static slide decks
- Your brand on everything the client sees
- Live data in Looker Studio without manual exports
- One subscription. One login. One invoice

### Competitive Landscape Positioning

AgencyViz competes on breadth + client experience, not depth in any single category:

| Competitor | What they do | What AgencyViz does differently |
|---|---|---|
| **Proposify / PandaDoc** | Proposals + e-signatures | AgencyViz adds creative review, funnel planning, and reporting connectors. Client experience is browser-native, not a PDF download. |
| **Filestage / Ziflow** | Creative review + approval | AgencyViz adds the pitch workflow (proposals, quotes, docs) and connects review to funnel strategy. |
| **Funnelytics** | Visual funnel mapping | AgencyViz includes funnel planning as one tool inside a broader workspace. Funnels live alongside the proposals and creative they support. |
| **Google Docs / Notion / Canva** | General-purpose content creation | AgencyViz is purpose-built for the agency-client workflow. White-labeled, no client account needed, built-in approval flows. |
| **Monday / Asana / Trello** | Project management + kanban | AgencyViz Kanban is specifically for creative review stages (draft to approved), not general task management. Pin-on-creative feedback is native. |
| **Dropbox / Slack / Loom** | File sharing + communication | AgencyViz structures the conversation around the deliverable with pins, threads, and stage-based visibility. |

**The positioning line:** "One workspace instead of five logins."

---

## 3. Complete Feature Inventory

### PITCH (Proposals, Quotes, Documents, Templates)

#### Proposals

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Multi-page proposal builder | Drag-and-drop page editor with reorderable pages, section headers, and table of contents | Build polished, multi-page proposals without design skills | Drag-and-drop proposals with pages, covers, and professional layouts. |
| Page types | PDF (uploaded), rich text, pricing tables, package tiers, TOC, section headers | Mix content types in one document — strategy narrative next to the line-item quote | Mix strategy decks, pricing tables, and uploaded PDFs in one proposal. |
| Full-screen branded cover | Custom background (solid/gradient/image), typography, logo, "prepared by" member | First impression is a branded splash screen, not a generic doc header | Branded cover pages that set the tone before the client reads a word. |
| Design system | Google Fonts (4 slots: title, heading, body, button), brand colours, page orientation, background images, per-section overrides | Every proposal looks like your agency, not like a template tool | Your fonts, your colours, your brand on every page. |
| Embedded quotes | Line items with qty/rate/description, optional add-ons, payment schedules (one-off/milestones/recurring), tax config, validity period | Client sees the scope and the price in the same document | Pricing with line items, packages, and payment schedules baked into the proposal. |
| Package tiers | Tiered pricing cards with features, conditions, recommended badge, full appearance customisation | Upsell naturally with side-by-side package comparison | Present Good/Better/Best packages with a recommended badge. |
| Decision panel | Accept/Request Changes/Decline with optional e-signature (draw or type), custom copy per action, next steps, T&Cs | Client acts on the proposal without leaving the page | One-click accept with optional e-signature. No back-and-forth. |
| Post-acceptance actions | Redirect to payment link/Calendly or show custom message | Seamlessly move the client to the next step (payment, booking) after they accept | Auto-redirect to payment or booking after acceptance. |
| View analytics | Total views, unique viewers, avg time, pages viewed, device breakdown, view history | Know exactly when and how the client engaged with your proposal | Know when your client opens the proposal and how far they read. |
| Kanban pipeline | Admin list with drag-and-drop status changes across pipeline stages | Visual overview of all proposals in progress | Kanban pipeline to track every proposal from draft to signed. |
| Notifications | Viewed, accepted, declined, revision requested — email + in-app + webhooks | Never miss a client action | Get notified the moment a client views, accepts, or requests changes. |
| Mobile-responsive viewer | Full-screen branded experience on any device | Clients read and act on proposals from their phone | Proposals look perfect on desktop, tablet, and mobile. |
| Shareable link | Unique token URL, custom domain support | One link. No login, no download, no friction | Share a link. Client opens it in the browser. Done. |

#### Quotes (Quote Builder)

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Single-page scroll layout | Floating card on background — different from multi-page proposals | Clean, focused view for straightforward pricing | A focused, scrollable quote your client reads in 30 seconds. |
| Quote sections | About Us, Testimonial, Trust Badges (up to 3), Next Steps, Terms & Conditions | Build credibility directly inside the quote | Add testimonials, trust badges, and next steps inside the quote. |
| Quote numbering | Configurable prefix and zero-padding | Professional numbering system (e.g., QT-0042) | Auto-numbered quotes with custom prefix. |
| Expiry with urgency | Countdown indicators ("Expires today", "Expires in N days", "Expired") | Creates urgency that drives faster decisions | Expiry dates with countdown urgency your client can see. |
| Attachments | Downloadable files attached to quote | Attach SOWs, rate cards, or supporting docs alongside pricing | Attach supporting documents alongside the quote. |
| GST/tax config | Toggle with configurable rate | Compliant pricing for any tax regime | GST/tax toggle with configurable rate. |
| Deposit toggle | Deposit percentage configuration | Collect upfront payment as standard practice | Built-in deposit percentage. |
| E-signature | Draw or type signature on acceptance | Legally binding without a third-party e-sign tool | E-signature built in. No DocuSign needed. |
| Cover splash | Full-screen branded intro before quote body | Professional first impression even for quick quotes | Branded cover splash before the client sees pricing. |

#### Documents

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Branded documents | Shareable docs (contracts, SOWs, onboarding guides) with same editor as proposals | One tool for every document you send to clients | Contracts, SOWs, and onboarding guides — all branded and shareable by link. |
| PDF + rich text pages | Upload PDFs or write rich text with the TipTap editor | Mix uploaded assets with editable content | Mix uploaded PDFs with rich text pages in one document. |
| Separate public viewer | /doc/[token] — streamlined viewer without pricing/decision UI | Clean reading experience for non-transactional documents | Clients open documents in the browser. No download. No login. |
| Full branding + cover | Same design system as proposals (fonts, colours, cover page) | Every document carries your agency's brand | Your brand on every document, from cover to footer. |

#### Templates

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| 5 template types | Proposal templates, quote templates, line item templates, package tier templates, page templates | Reuse everything — from full proposals down to individual line items | Five template types: proposals, quotes, pages, packages, and line items. |
| Page library | Community + custom pages with search and filter | Start from proven page layouts, not a blank page | Pull from a shared page library or save your own. |
| "New from template" | Copies all settings (pages, cover, design, pricing, packages, decision) | Ship the next proposal in minutes, not hours | Clone a template. Customise. Send. Minutes, not hours. |
| Team-wide library | Shared across all team members in the company | Consistency across every team member's output | One template library for the whole team. |

---

### CAMPAIGNS (Markup / Creative Review)

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| 10+ content types | Webpage, email, ad (Meta), image, video, SMS, Google Search Ad, Google Banner Ad, PDF, Meta Lead Form — each with dedicated mockup previews | Review any content type your agency produces, in its native format | Review images, video, PDFs, emails, SMS, webpages, and ads — all in one place. |
| Pin comments | Click anywhere on a creative to drop a numbered pin with a comment | Feedback sits on the exact pixel it refers to — no more "the headline on the third one" | Clients pin feedback exactly where it belongs. |
| Drawing annotations | Arrows, boxes, text overlays via rough.js | Circle the problem, draw an arrow, add a note — visually | Draw arrows, boxes, and annotations directly on the creative. |
| Text highlighting | Highlight text in email/SMS content and attach comments | Inline text feedback for copy review | Highlight text and comment inline on emails and SMS. |
| 8-stage Kanban | Draft, In Progress, Internal Review, Client Review, Revision Needed, Approved, Rejected, Archived | Structured workflow from first draft to final approval | Kanban workflow from draft to approval with stage-based visibility. |
| Guest visibility controls | Clients only see items in Client Review, Approved, Rejected — internal stages invisible | Internal work stays internal; clients see only what's ready for them | Internal stages invisible to clients. They only see what's ready. |
| Per-stage assignees | Team members and guests scoped to specific stages | Right person reviews at the right time | Assign reviewers per stage. The right eyes at the right time. |
| Per-reviewer approvals | Individual approve/changes_requested votes per (item, stage, reviewer) | Every reviewer's opinion is tracked independently | Every reviewer signs off individually. Full accountability. |
| Auto-advance | Items move to next stage when all assigned reviewers approve | No manual stage changes — the workflow runs itself | Auto-advance when all reviewers approve. |
| Versioning | Multiple asset versions per item, version picker, comments anchored to versions | Upload a new version without losing the conversation on the old one | Upload new versions. Every version keeps its own comments and history. |
| React Flow whiteboard | Infinite canvas with item nodes, sticky notes, 30+ shapes, labeled edges | Map the campaign visually — see how assets connect | Map your campaign on an infinite whiteboard with shapes, sticky notes, and edges. |
| Comment features | Threaded replies, resolve/reopen, @mentions, priority levels, quick-assign, task toggle, emoji reactions | Comments become actionable tasks, not just notes | Threaded comments with @mentions, priority, task assignment, and reactions. |
| Sub-view scoping | Pins scoped per Meta ad variant, per email view (inbox/client), per SMS platform, per Google Ad headline | Feedback is contextual to the exact variant or view | Pin feedback on specific ad variants, email views, and headline options. |
| Bulk review submission | "Finish reviewing" modal for bulk status changes with optional message | Clients can approve/reject multiple assets in one pass | Clients review everything and submit all decisions in one pass. |
| Public share | Project-level and per-item tokens, configurable tab visibility, reviewer note overlay | Share any project or individual asset with a link | Share a review link. Clients comment and approve without signing up. |
| Notifications | Stage-scoped per assignee, 5 event types, email + in-app, unsubscribe | Everyone gets notified about what matters to their stage | Stage-scoped notifications so nobody gets noise from stages they don't own. |
| Due dates + overdue | Due date fields with overdue indicators | Visual urgency when deadlines pass | Due dates with overdue indicators keep projects on track. |
| Dashboard widgets | "Awaiting my review" + "Needs new version" + unresolved client comments inbox | Action items surfaced the moment you log in | Dashboard shows what needs your attention right now. |

---

### FUNNEL PLANNER

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Visual funnel builder | Drag-and-drop on infinite canvas (React Flow) with 60+ node types | Build the campaign map visually, not in a slide deck | Drag-and-drop funnel builder on an infinite canvas. |
| Three node types | Funnel Steps (traffic sources, pages, offers), Shapes (30+ action/decision/automation shapes), Sticky Notes | Model any campaign from first touchpoint to final conversion | 60+ node types: traffic sources, pages, offers, decisions, automations, and sticky notes. |
| Forecast engine | Topological forward pass, fan-outs with split percentages, period multiplier, LTV via recurring months | See projected revenue, cost, profit, and ROAS before the campaign launches | Built-in forecast: projected revenue, cost, profit, and ROAS. |
| Metrics per node | Traffic (visitors + CPC), pages (conversion %), offers (conversion % + value + recurring months for LTV) | Plug in real numbers and watch the funnel calculate | Input metrics per step. The funnel calculates the rest. |
| Board summary | Rolled-up Revenue / Cost / Profit / ROAS always visible | The business case is always visible, not buried in a spreadsheet | Revenue, cost, profit, and ROAS visible at a glance. |
| Numbers Layer | Toggle show/hide forecast overlay on nodes | Present the funnel clean or with all the numbers | Toggle forecast numbers on and off for clean presentations. |
| Scenarios | Duplicate any funnel as a "what-if" clone, switch between scenarios | Test different strategies without starting over | Duplicate funnels as "what-if" scenarios. Compare strategies side by side. |
| Template gallery | Lead Gen, Sales, E-commerce, Service, Course templates | Start from a proven funnel structure, not a blank canvas | Start from pre-built funnel templates: lead gen, e-commerce, service, and more. |
| Export | PNG and PDF export | Drop the funnel into a deck or attach to a proposal | Export as PNG or PDF. Drop into any deck or document. |
| Smart alignment | Alignment guides during drag | Clean, professional-looking funnels without fiddling | Smart alignment guides for clean, professional layouts. |
| Keyboard shortcuts | Cmd-Z/Y undo/redo, Cmd-D duplicate | Power-user speed for experienced planners | Keyboard shortcuts for fast funnel building. |
| Public viewer | Read-only canvas with forecast summary, branded header | Client sees the strategy, not just the deliverables | Share a link. Client sees the full funnel and forecast in the browser. |
| Forecast settings | Currency (6 options), period (one-off/monthly/yearly) | Localised financial projections | Six currencies and three period options for localised forecasts. |

---

### SWIPE VAULT

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Ad library | Save images + videos with full ad copy metadata (headline, primary text, description, CTA, source URL, notes) | One place for every ad reference your team collects | Save ads with the creative, the copy, and the metadata — all together. |
| Facebook feed mockup | Realistic preview of how ads look in the Facebook feed | See exactly how an ad appears in-feed, not as a flat screenshot | Realistic Facebook feed mockup for every saved ad. |
| 9 persuasion angle tags | Clarity & Value, Identity & Alignment, Enemy/Contrarian, Proof & Transformation, Mechanism/Education, Pattern Interrupt & Curiosity, Offer & Urgency, Emotional Resonance, Novelty/Futureproof | Categorise ads by the persuasion angle, not just the format | Tag ads by persuasion angle: clarity, proof, urgency, curiosity, and more. |
| Folder organisation | Sidebar navigation with folders | Organise by client, campaign, industry, or any scheme that works | Organise saves into folders and boards. |
| Grid view + tag filters | AND logic filtering across tags | Find the right reference in seconds | Filter by tag, format, or folder to find exactly what you need. |
| Detail modal | Full-size mockup + accordion metadata sections | Dive deep into any saved ad without leaving the grid | Click any ad for the full-size mockup, copy, and metadata. |
| Bulk upload | Upload multiple assets at once | Populate the vault fast after a research session | Bulk upload after a research session. |
| Shareable per-swipe links | Open Graph/Twitter cards, JSON-LD structured data | Share a single ad reference with rich link previews | Share individual ads with rich link previews. |
| Direct storage upload | Supabase Storage via signed URLs (bypasses serverless size limits) | Upload videos up to 100MB without hitting size limits | Upload videos up to 100MB. |
| Video transcription field | Store the spoken words alongside the video | Reference what was said, not just what was shown | Save video transcriptions alongside the creative. |
| Naming Convention reference | Meta Andromeda engine explainer built into the app | Understand naming conventions in context | Built-in naming convention reference for Meta campaigns. |

---

### INTEGRATIONS

#### Meta Ads to Looker Studio

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| OAuth connection | Secure Meta login, supports multiple accounts per company | Connect in clicks, not config files | Connect Meta with OAuth. No API keys to manage. |
| Passthrough architecture | No ad data stored — every Looker Studio refresh hits Meta live | Your data never sits in a third-party database | No data stored. Every refresh pulls live from Meta. |
| ~95 insight fields | Spend, clicks, impressions, CTR, CPC, CPM, ROAS, video metrics, quality ranking, and more | One connector covers virtually every metric you need | 95+ fields: spend, clicks, impressions, CTR, CPC, ROAS, video metrics, and more. |
| Creative fields | Thumbnails, ad copy, CTAs, destination URLs hydrated via batch-get | See the ad alongside its performance in the report | Ad creative, copy, and thumbnails right inside Looker Studio. |
| Breakdowns | Age, gender, country, region, DMA, device, platform, placement, hourly | Slice data any way the client needs | Breakdowns by age, gender, country, device, placement, and more. |
| Advantage+ handling | First variant + all variants for dynamic creative | Report on dynamic ads without manual variant extraction | Advantage+ and dynamic creative variants handled automatically. |
| Token lifecycle | Active/needs_reauth/revoked with auto-reauth detection | Connections stay alive without manual token management | Auto-managed tokens. No manual refresh. |
| AES-256-GCM encryption | Encrypted token storage | Enterprise-grade security for stored credentials | AES-256-GCM encrypted token storage. |
| Apps Script connector | Google Apps Script community connector for Looker Studio (OAuth2 auth) | Add to Looker Studio like any other data source | Community connector installs directly in Looker Studio. |

#### GoHighLevel

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Two-way CRM sync | Proposal/quote stage changes push to GHL as contact upserts + opportunity stage moves | CRM stays in sync with proposal activity automatically | Proposal stage changes sync to GoHighLevel automatically. |
| Stage mapping | Map each AgencyViz stage to a GHL pipeline stage | Match your existing GHL pipeline without restructuring | Map AgencyViz stages to your existing GHL pipeline. |
| Workflow triggers | Optional GHL workflow triggers on stage change | Automate follow-ups, tasks, and notifications in GHL | Trigger GHL workflows when proposals change stage. |
| Monetary sync | Quote totals push as GHL opportunity value | Deal values update automatically when quotes change | Quote totals sync to GHL opportunity values. |
| Async job queue | Exponential backoff + sync activity log | Reliable sync even under load | Reliable sync with retry logic and activity logging. |

#### Outbound Webhooks

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Lifecycle events | Fire on viewed, accepted, sent, declined, revision requested, comment added/resolved | Trigger any downstream automation when something happens | Webhooks fire on every proposal and quote lifecycle event. |
| Full payload | Proposal metadata, pricing, packages | External systems get all the data they need | Full payload with proposal data, pricing, and packages. |
| HMAC-SHA256 signatures | Optional signature verification for webhook consumers | Verify webhooks are genuinely from AgencyViz | HMAC-SHA256 signed webhooks for verified delivery. |
| Retry logic | Up to 2 retries with delivery logging | Reliable delivery even if the endpoint is temporarily down | Automatic retries with delivery logging. |

#### OAuth2 System

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Full authorization_code flow | Standards-based OAuth2 for third-party integrations | Any platform (Zapier, Make) can integrate via OAuth | OAuth2 authorization code flow for third-party integrations. |
| Database-driven client registration | Adding new clients is a database INSERT, no code changes | Scale integrations without engineering effort | Add new OAuth clients without code changes. |

---

### PLATFORM

#### White-Label Branding

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Complete visual customisation | Logo, accent colour, backgrounds, sidebar colours, cover styles | Everything the client sees carries your brand | Your logo, colours, and fonts on everything clients see. |
| Typography system | 4 font slots (title, heading, body, button) with Google Fonts integration | Full typographic control without custom CSS | Four font slots with Google Fonts. Full typographic control. |
| Design cascade | Per-entity overrides (proposal-level > company-level > defaults) | Override branding per proposal when needed | Override branding per proposal or use company defaults. |
| White-labeled admin sidebar | Fully brandable sidebar (colours, logo) for client accounts | Client accounts see your agency inside the app | Client accounts see your brand in the sidebar, not ours. |

#### Custom Domains

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Vercel-managed DNS | CNAME for subdomains, A record for apex domains | Proposals come from proposals.youragency.com | Send proposals from proposals.youragency.com. |
| All viewers respect custom domain | Proposal, quote, doc, review, funnel, swipe URLs use custom domain when verified | Every link the client receives is on your domain | Every client-facing link lives on your custom domain. |
| DNS verification | Live status synced during setup | Know immediately when the domain is ready | DNS verification with live status. |

#### Team Management

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Role-based access | Owner / Admin / Member with permission matrix | Control who can do what | Three roles: Owner, Admin, Member. Control who can do what. |
| Invite + manage | Invite by email, change roles, remove members | Manage your team without support tickets | Invite teammates, assign roles, and manage access. |
| Per-member notification toggles | Each member controls their own notification preferences | No notification noise for people who don't need it | Each team member controls their own notifications. |

#### Notifications

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| In-app bell | Supabase Realtime, 10+ event types, mark read/all read | Real-time alerts inside the app | Real-time in-app notification bell. |
| Email notifications | Proposal + review lifecycle events | Stay informed even when you're not in the app | Email notifications for every lifecycle event. |
| Webhook notifications | Fire on lifecycle events with full payload | Pipe events to Slack, Zapier, or any endpoint | Webhooks for Slack, Zapier, Make, or any automation. |
| Stage-scoped (Campaigns) | Notifications filtered by assignee's stage scope | Only get notified about your stages | Stage-scoped notifications. No noise from stages you don't own. |

#### Dashboard

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Personalised greeting | Welcome message with user name | Feels like your workspace, not a generic SaaS | Personalised dashboard that greets you by name. |
| Action widgets | "Awaiting my review" + "Needs new version" cards | See what needs your attention immediately | See what needs your attention the moment you log in. |
| Client comments inbox | Unresolved comments with inline reply/resolve | Respond to client feedback without navigating away | Reply to client comments directly from the dashboard. |
| Proposal + quote Kanban | Pipeline overview on the dashboard | Track all active deals at a glance | Proposal and quote pipelines at a glance. |

#### Client Accounts

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Client account management | Grid of client cards, "Enter Account" to view as client | See exactly what your client sees | Switch into any client account to see their view. |
| Filtered client view | Clients see only the Pitch section in sidebar | Clean, focused experience for clients who log in | Clients log in to a focused view of their proposals and documents. |

#### Onboarding

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| 4-step wizard | Branding, Invite Team, Choose Plan, Done | Get set up in minutes, not hours | Set up in four steps: brand, invite, plan, done. |
| 8 product tours | React-joyride guided tours for each major feature | Learn by doing, not reading docs | Guided tours for every major feature. |

#### Security

| Feature | What It Does | Client-Facing Value | One-Line Bullet |
|---|---|---|---|
| Row-level security | Supabase RLS on all data tables | Data isolation between companies is enforced at the database level | Row-level security on every table. Your data is yours. |
| AES-256-GCM encryption | Encrypted token storage for integrations | Enterprise-grade credential security | AES-256-GCM encryption for stored credentials. |
| Token-based sharing | Opaque share tokens, no auth required for viewers | Secure but frictionless. No client account needed. | Token-based sharing. Secure and frictionless. |
| Rate limiting | Postgres-backed sliding-window rate limiter | Protection against abuse on every endpoint | Rate limiting on all public and authenticated endpoints. |

---

## 4. Key Differentiators

### 1. One workspace replaces five tools
The single strongest differentiator. No other product covers proposals + quotes + documents + creative review + funnel planning + ad inspiration + Looker Studio connectors in one workspace. The competitor stack (Proposify + Filestage + Funnelytics + Google Drive + a spreadsheet) costs more, requires more logins, and creates more friction for clients.

### 2. The client never creates an account
Every client-facing surface (proposals, quotes, documents, review boards, funnels, swipe files) is accessed via a share link. The client opens it in the browser and acts on it. No signup, no download, no app to install. This is a decisive advantage over tools like Filestage and Monday that require client onboarding.

### 3. White-labeled everything
Six public viewers, all white-labeled with the agency's brand. Logo, colours, fonts, and even the domain. The client never sees "Powered by AgencyViz." This matters to agencies that sell on brand equity and professionalism.

### 4. Creative review is connected to the pitch
Proposals, funnel plans, and creative review live in the same workspace. An agency can send a proposal, get it accepted, then move the creative through review stages — all without switching tools. The client sees one consistent experience.

### 5. Pin-on-creative feedback eliminates ambiguity
Pin comments land on the exact pixel. Drawing annotations circle the problem. Text highlighting marks the sentence. There is no "the headline on the third one" — every piece of feedback is visually anchored. This is table stakes for dedicated review tools but absent from general-purpose tools like Slack, email, and Notion.

### 6. Stage-based visibility keeps internal work internal
The Kanban workflow separates internal review from client review. Clients only see items that have been moved to client-facing stages. Internal feedback, drafts, and work-in-progress stay invisible. No more "the client saw a half-finished version" accidents.

### 7. Built-in funnel forecasting
The Funnel Planner calculates projected revenue, cost, profit, and ROAS based on per-step metrics. Agencies can show clients the business case for a campaign strategy, not just a diagram. The "Numbers Layer" toggles on and off for clean presentations vs. detailed planning.

### 8. Passthrough data architecture for reporting
The Meta-to-Looker-Studio connector is a pure passthrough. No ad data is stored. Every refresh hits Meta live. This is a trust differentiator — agencies can tell clients "your data never sits in a third-party database."

---

## 5. Pain Points Solved

These are framed as "before" problems that agency owners feel viscerally. Use these as ad hooks, headlines, and opening lines.

### The Tool Sprawl Problem
- "We're paying for Proposify AND Filestage AND Google Drive AND a spreadsheet — and none of them talk to each other."
- "I need a different login for proposals, creative review, and reporting. My team can't find anything."
- "We're spending more on tool subscriptions than on some of our junior staff."

### The Client Friction Problem
- "My client has to download a PDF, open it, screenshot the part they have questions about, and email it back."
- "Every time we onboard a new client, we have to get them to create accounts in three different tools."
- "Clients stop engaging with proposals because there's too much friction to open them."

### The Lost Feedback Problem
- "Client feedback is buried in a 47-message email thread and nobody knows which version they're talking about."
- "'Can you change the thing on the third one' — that's the actual feedback I got in a forwarded email."
- "We have no single source of truth for what's approved and what's still in review."

### The Brand Consistency Problem
- "Every tool we use shows its own branding. The client sees Proposify's logo, Filestage's interface, Google's header."
- "We charge a premium for brand work but our own client experience looks like a patchwork of third-party tools."

### The Manual Reporting Problem
- "Every Monday morning, my account manager spends 2 hours exporting CSVs from Meta and pasting them into a spreadsheet."
- "Our Looker Studio reports go stale because nobody has time to manually update the data source."

### The Strategy Presentation Problem
- "The campaign funnel lives in a PowerPoint that nobody updates after the kickoff call."
- "I can show the client the deliverables but not how they all connect into a strategy."

### The Version Control Problem
- "We're on v7 of the banner and I don't know which version the client approved."
- "Someone uploaded a new version and lost all the comments from the last round."

---

## 6. Marketing Angles & Campaign Ideas

### Website Homepage

**Primary angle:** Consolidation + client experience.
- Lead with "Everything your clients see, in one place" (existing — it works)
- Hero video showing the build-share-sign-off flow across all tools
- Before/After comparison (duct-taped stack vs. one workspace)
- Social proof section (once real testimonials are available)
- "One plan. Every tool." pricing teaser
- Competitor logo marquee (already in place) reinforcing "replace all of these"

**Suggested additions:**
- Interactive tool calculator: "How many tools are you paying for?" with running cost comparison
- A "See it from your client's perspective" section that shows the viewer experience
- ROI framing: time saved per week, subscription cost reduction, faster close rates

### Product Sub-Pages

Each sub-page should lead with the specific pain point, not the feature:
- **Pitch:** "Stop sending PDFs nobody opens." Show the viewer experience side-by-side with a PDF attachment email
- **Markup:** "Stop decoding feedback from email threads." Show pin-on-creative vs. a screenshot in Slack
- **Funnel Planner:** "The funnel shouldn't live in a dead PowerPoint." Show the living board vs. a static slide
- **Swipe Vault:** "Your best ad references are scattered across 12 devices." Show the organised vault vs. a camera roll
- **Integrations:** "Monday morning CSV exports are over." Show the live Looker Studio report vs. the manual spreadsheet

### Google Ads Campaigns

**Campaign 1: Competitor conquest**
- Target: "proposify alternative", "filestage alternative", "funnelytics alternative", "pandadoc for agencies"
- Angle: "One tool instead of five. Proposals + creative review + funnel planning in one workspace."
- Landing page: Comparison page showing AgencyViz vs. the duct-taped stack

**Campaign 2: Pain-point search**
- Target: "client proposal tool", "creative approval workflow", "agency client portal", "white label proposals"
- Angle: Lead with the specific pain point the searcher is trying to solve
- Landing pages: Corresponding product sub-pages

**Campaign 3: Branded**
- Target: "agencyviz", "agency viz", "agency toolbox"
- Angle: Direct to homepage or pricing page with free trial CTA

### Meta / Social Ads

**Angle 1: The duct-taped stack (problem-aware)**
- Creative: Split-screen showing the messy multi-tool workflow vs. the clean AgencyViz workspace
- Hook: "Your agency runs on 5 tools that don't talk to each other."
- CTA: "See what one workspace looks like."

**Angle 2: The client experience (solution-aware)**
- Creative: Screen recording of a client opening a proposal link, scrolling through, and accepting
- Hook: "Your client opens a link, reads the proposal, and accepts. 2 minutes."
- CTA: "Send your first proposal free."

**Angle 3: The specific pain (problem-aware, high specificity)**
- Creative: Text overlay on dark background, punchy one-liner
- Hooks (rotate): "Client feedback buried in email threads?" / "Still exporting CSVs every Monday?" / "Sending proposals as PDF attachments?"
- CTA: "There's a better way."

**Angle 4: The founder's deal (offer-aware)**
- Creative: Pricing card with $49 crossed through to show it's locked
- Hook: "Lock in $49/mo for life. Before it's $79."
- CTA: "Claim your founders price."

**Angle 5: Social proof (once available)**
- Creative: Video testimonial or quote card
- Hook: "This agency replaced 5 tools with one."
- CTA: "See how."

### Email Sequences

**Sequence 1: Waitlist to trial (pre-launch)**
1. Welcome + what AgencyViz does (consolidation angle)
2. Deep dive: Pitch tools (proposals, quotes, docs)
3. Deep dive: Markup (creative review)
4. Deep dive: Funnel Planner + Swipe Vault + Integrations
5. "We're opening up" — trial invitation with founders pricing

**Sequence 2: Trial onboarding (post-signup)**
1. Welcome + quick-start guide (branding, first proposal)
2. Day 2: "Send your first proposal" with template suggestions
3. Day 3: "Set up Markup for your next creative round"
4. Day 5: "Connect Meta to Looker Studio in 3 clicks"
5. Day 6: Trial ending reminder + upgrade CTA with founders pricing lock-in

**Sequence 3: Nurture (signed up, not yet active)**
1. "Here's what other agencies are building" (use case examples)
2. "Did you know you can share funnels with clients?"
3. "Your clients never need to create an account"
4. "One workspace instead of five logins — here's the math"
5. Re-engagement CTA

### LinkedIn Organic

**Post themes (rotate weekly):**
1. **Hot take:** "Agencies are spending more on tool subscriptions than on junior staff. The answer isn't better tools. It's fewer tools."
2. **Workflow comparison:** Side-by-side of the 5-tool workflow vs. the 1-tool workflow. Visual, shareable.
3. **Client experience angle:** "Your client doesn't care which tools you use. They care that the proposal opens in 2 seconds and they can accept it without creating an account."
4. **Pain point poll:** "What wastes more of your agency's time? A) Manual reporting B) Lost creative feedback C) Chasing proposal approvals D) All of the above"
5. **Behind-the-build:** Feature spotlights showing real product screenshots (Kanban, pin comments, funnel builder)
6. **Mini case studies:** "Before: 3 tools, 45 minutes to send a proposal. After: 1 tool, 7 minutes."
7. **Founder's journey:** Why we built AgencyViz, the stack problem, the decision to consolidate

### Sales Deck Talking Points

1. **The problem:** "You're running your agency on a stack of tools that don't talk to each other. Your team wastes time switching between them. Your clients see a patchwork of third-party interfaces."
2. **The cost:** "Add up Proposify ($49), Filestage ($89), Funnelytics ($49), Google Workspace, Slack, spreadsheets. That's $250+/mo per team — and your clients still need accounts in each one."
3. **The solution:** "AgencyViz puts everything your client sees in one workspace. Proposals, quotes, docs, creative review, funnel plans, and reporting connectors. One subscription. One brand."
4. **The client experience:** "Your client gets a link. They open it in the browser. They read, comment, approve, and accept — without creating an account, downloading an app, or opening a PDF."
5. **The deal:** "Founders price: $49/mo locked for life. Standard pricing will be $79/mo. 7-day free trial. Cancel anytime."
6. **Live demo flow:** Send a proposal link live → show client viewer → show pin feedback on creative → show funnel plan → show Looker Studio with live data

---

## 7. Headline & Tagline Bank

### Consolidation Angle

1. "Everything your clients see, in one place." (existing — strong, keep as primary)
2. "One workspace instead of five logins."
3. "The agency toolbox." (existing tagline)
4. "Stop paying for five tools that don't talk to each other."
5. "One tool. Every deliverable. Every client."
6. "Replace the duct-taped stack."
7. "Your whole client experience, one workspace."
8. "Five tools out. One in."
9. "The last SaaS subscription your agency needs."
10. "From pitch to approval — one workspace." (existing — strong)

### Professionalism / Brand Angle

11. "Your brand on everything. Theirs on nothing."
12. "White-labeled everything. Your agency, front and center."
13. "Every touchpoint looks like your agency."
14. "Proposals that look like your brand, not your proposal tool."
15. "Your client never sees our logo. Only yours."

### Client Experience Angle

16. "One link. No login. No download. No friction."
17. "Clients open it, read it, act on it. Done."
18. "Your client accepted the proposal in 2 minutes. No PDF. No back-and-forth."
19. "Proposals your clients actually open."
20. "No account needed. No app to install. Just a link."
21. "Share a link. Get sign-off."
22. "The proposal went out at 2pm. Accepted by 2:07."

### Speed / Efficiency Angle

23. "Ship the next proposal in minutes, not hours."
24. "From template to sent in 10 minutes."
25. "Monday morning CSV exports? Over."
26. "Build, share, sign off. Three steps."
27. "From kickoff to sign-off in three steps." (existing — effective)

### Simplicity Angle

28. "One plan. Every tool." (existing — clean and punchy)
29. "Build it. Share a link. Get sign-off."
30. "No integrations to set up. It's already connected."
31. "One dashboard. Every client. Every project."

### Feedback / Review Angle

32. "Feedback that lands where it belongs." (existing — excellent)
33. "Stop decoding 'the headline on the third one.'"
34. "Pin it. Assign it. Done."
35. "No more email thread archaeology."
36. "Every reviewer signs off. Every version tracked."

### Urgency / Offer Angle

37. "$49/mo. Locked for life. Before it's $79."
38. "Founding-member pricing ends when it ends."
39. "Lock in the founders price while it exists."
40. "7-day free trial. One plan. Cancel anytime."

---

## 8. Testimonial Gaps & Social Proof Strategy

### Current State

All testimonials on the website are placeholders attributed to "Founding Agency" with generic role titles (Agency Director, Creative Lead, Account Manager, Strategy Director). These must be replaced with real testimonials before scaling any paid acquisition channel. Placeholder testimonials erode trust on closer inspection.

### Priority Testimonial Types Needed

**Tier 1 — Get these first (highest conversion impact):**

1. **The consolidation story:** An agency that cancelled multiple tool subscriptions after switching to AgencyViz. Ideal: specific tool names, specific cost savings, specific time savings. Example: "We cancelled Proposify, Filestage, and a Google Workspace add-on. That's $200/mo back and my team stopped wasting 3 hours a week switching between tools."

2. **The client experience story:** A moment where a client's experience was noticeably better. Ideal: specific scenario, specific time frame. Example: "I sent the proposal at 2pm. The client texted me at 2:04 saying it was the most professional pitch they'd ever received. They accepted 3 minutes later."

3. **The creative review story:** Feedback ambiguity eliminated. Ideal: specific content type, specific before/after. Example: "Clients used to screenshot our banners and email me 'change the blue thing.' Now they pin a comment on the exact element and I assign it to my designer in one click."

**Tier 2 — Get these for product pages:**

4. **The funnel planning story:** Client understood the strategy because it was visual and shareable
5. **The reporting story:** Monday morning CSV exports eliminated via Looker Studio connector
6. **The template library story:** Proposals that used to take 2 hours now take 15 minutes
7. **The white-label story:** Client thought the agency built the tool themselves

**Tier 3 — Get these for scale:**

8. **The freelancer/small shop story:** One person running a professional operation that looks like a big agency
9. **The multi-client agency story:** Managing 10+ clients in one workspace
10. **The team onboarding story:** New team members productive in hours, not days, because of templates and shared library

### Social Proof Formats Needed

| Format | Use Case | Priority |
|---|---|---|
| Written quotes (2-3 sentences) | Website testimonial sections, ad creative | Immediate |
| Short video testimonials (30-60s) | Meta ads, LinkedIn, product pages | High |
| Case study (1 page) | Sales deck insert, blog post, landing page | Medium |
| Logo wall | Homepage credibility section | Medium |
| Usage metrics | "X proposals sent", "Y assets reviewed" — aggregate platform stats | Medium |
| G2/Capterra reviews | Third-party validation, Google Ads seller ratings | Post-launch |

### Collection Strategy

1. **Founders outreach:** Email founding-member agencies 30 days after signup. Ask for a 15-minute interview. Offer: logo on homepage + extended trial/discount if applicable.
2. **In-app prompt:** After a client accepts a proposal or completes a review cycle, show a "How was that?" modal with an option to leave a testimonial.
3. **Milestone triggers:** When an agency hits milestones (10 proposals sent, 50 assets reviewed), prompt for feedback.
4. **Template:** Provide a fill-in-the-blank template: "Before AgencyViz, we used [old tool] for [task]. The biggest problem was [pain]. Now, [specific improvement]. It saves us [time/money]."

---

## 9. Content Calendar Seed Ideas

### Awareness Stage (Top of Funnel)

1. **"The true cost of your agency's tool stack"** — Calculate what agencies typically spend on Proposify + Filestage + Funnelytics + Google Workspace + Slack integrations. Include time cost, not just subscription cost.
2. **"Why your clients hate downloading PDFs"** — Data on PDF open rates vs. link open rates. The friction of downloads, file management, and version confusion.
3. **"The agency-client handoff is broken"** — How feedback gets lost between email, Slack, and review tools. The cost of ambiguity.
4. **"5 signs your agency has outgrown its tool stack"** — Checklist format. Relatable, shareable.
5. **"What your client actually sees when you send a proposal"** — Walk through the client experience of a PDF attachment vs. a browser-native proposal.
6. **"The Monday morning reporting ritual (and how to kill it)"** — The manual CSV export workflow and what it costs in hours per month.
7. **"How many logins does your agency need?"** — Tool audit framework. List every tool, every login, every monthly cost. Shareable worksheet.

### Consideration Stage (Middle of Funnel)

8. **"Proposify vs. PandaDoc vs. AgencyViz: which proposal tool is built for agencies?"** — Comparison post. Focus on the creative review gap and client experience.
9. **"How to run creative review without Filestage"** — Workflow comparison. Pin comments vs. email threads. Stage-based visibility vs. everything visible.
10. **"What a white-labeled client experience actually looks like"** — Screenshots/video of the client viewer. Show branding, custom domain, zero-friction access.
11. **"How to present a campaign funnel to a client (without building a slide deck)"** — Funnel Planner walkthrough. Share link, show forecast, discuss strategy.
12. **"The agency proposal template that closes in 10 minutes"** — Template breakdown. Cover, strategy, pricing, packages, decision panel. Downloadable template.
13. **"How to set up Meta reporting in Looker Studio in 3 steps"** — Tutorial post. OAuth connect, select accounts, add connector. Step-by-step with screenshots.
14. **"How to organise your agency's ad inspiration library"** — Swipe Vault walkthrough. Folder structure, tag taxonomy, sharing with clients.
15. **"Stage-based creative review: why your client shouldn't see internal drafts"** — The case for guest visibility controls. Before/after of the client experience.

### Decision Stage (Bottom of Funnel)

16. **"AgencyViz vs. your current stack: the math"** — Side-by-side cost and time comparison. Calculator or spreadsheet.
17. **"How to migrate from Proposify to AgencyViz in one afternoon"** — Step-by-step migration guide. Templates, branding, first proposal.
18. **"What founding-member pricing means (and why it won't last)"** — Urgency-driven post. $49 locked vs. $79 standard. The math over 2 years.
19. **"30-day challenge: run your agency on one tool"** — Structured challenge. Week 1: proposals. Week 2: creative review. Week 3: funnels. Week 4: integrations.
20. **"Everything included in the founders plan"** — Feature inventory post. Comprehensive list with brief descriptions. Reference this report.

### Ongoing / Evergreen

21. **"How to write a proposal that closes"** — Best practices. Structure, pricing psychology, decision panel design. Uses AgencyViz as the example tool.
22. **"The 9 persuasion angles every ad uses"** — Educational post based on the Swipe Vault tag taxonomy. Practical framework.
23. **"How to get client feedback that's actually usable"** — The case for structured review vs. unstructured email feedback.
24. **"Agency pricing strategies: packages, tiers, and add-ons"** — How to structure pricing using the Quote Builder's package tiers.
25. **"How to build a funnel forecast your client can understand"** — Funnel Planner tutorial. Metrics, scenarios, presentation tips.

---

## 10. Existing Copy Audit

### What's Working Well

**Homepage hero:** "Everything your clients see, in one place." is an excellent primary headline. It's clear, benefit-driven, and specific to the ICP. The subtext ("Proposals, quotes, presentations, plans, and creative review. One workspace instead of five logins.") reinforces the consolidation angle without overpromising. Keep this.

**Before/After section:** "The duct-taped stack" vs. "One workspace. Both sides." is vivid and relatable. The bullet list of "before" problems is specific and painful. The OrbitalTools animation on the "after" side is a strong visual counterpoint. This section earns its place.

**Three-step flow:** "Build, Share, Sign off" is simple and effective. Three steps is the right number. The descriptions are concise.

**Product section headlines:** "Win the pitch before the call ends" (Pitch) and "Feedback that lands where it belongs" (Markup) are strong. They lead with outcome, not feature.

**Pricing framing:** "One plan. Every tool." is clean. The founding-member lock-in messaging is clear and creates appropriate urgency.

**FAQ tone:** Direct, concise, no marketing fluff. "No. Proposals are shared by link." — this is the right voice.

**Product sub-pages:** The before/after framing on each sub-page is consistent and effective. Use cases are well-chosen and specific.

### What Could Be Stronger

**Homepage lacks social proof:** The testimonials section uses placeholders. Once real testimonials are available, this section should be prominent (above the pricing teaser, not below it). Consider a logo wall alongside the competitor marquee.

**Secondary tools section ("Plan it, save it, report on it") is underpowered:** Funnel Planner, Swipe Vault, and Integrations each get a single card with a short description. These are full product features that deserve more homepage real estate. Consider expanding to mini-sections with a screenshot/mockup each, similar to the Pitch and Markup sections. The current "Plan it, save it, report on it" heading is also vague — consider something more specific.

**Missing: the client-perspective section.** The homepage talks about what the agency can build, but doesn't show what the client actually sees. A "See it from your client's side" section with a viewer screenshot or demo would strengthen the "no friction" angle.

**Missing: concrete numbers.** The copy is benefit-driven but lacks specifics. "Minutes, not hours" — how many minutes? Even estimated benchmarks would add credibility: "Send a proposal in under 10 minutes." "Your client accepts without creating an account." The FAQ answers some of this but it's buried.

**Integrations sub-page copy:** "Your report. Your data. No manual export." is good but could be stronger on specificity. "95+ fields from Meta Ads in Looker Studio — no CSV export, no spreadsheet, no manual refresh." The current copy undersells the depth of the connector.

**Funnel Planner sub-page is missing the forecast angle.** The headline "Map the plan. Share the strategy." covers the visual mapping but undersells the built-in forecast engine, which is a significant differentiator. Consider: "Map the strategy. Forecast the numbers. Share the whole picture."

**Swipe Vault sub-page:** "Save winners. Show clients." is punchy but doesn't communicate the depth of the library (metadata, persuasion tags, mockups). The "why" section is strong but the feature grid could better highlight the Facebook feed mockup and the 9 persuasion angle tags, which are unique.

**Pricing page is thin.** It has the plan card and 4 FAQs. It could benefit from: a feature comparison table (AgencyViz vs. the stack), a "What's included" expandable list, and a "founding agencies" counter or social proof element.

**CTA diversity:** Every CTA is either "Start your 7-day free trial" or a waitlist form. Consider adding secondary CTAs: "See a demo", "Watch the 2-minute walkthrough", "See it from your client's perspective." Not everyone is ready to sign up on the first visit.

**The competitor marquee lacks context.** The logos of Proposify, PandaDoc, Filestage, etc. scroll across the page but without a framing line. Consider: "Replaces your stack of:" or "Agencies switch from:" above the marquee to make the intent explicit.

---

*End of report. All feature descriptions verified against the codebase as of 1 June 2026. No claims about features that do not exist in production. All testimonials flagged as placeholders requiring replacement.*
