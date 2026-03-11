# AgencyViz — Architecture & Data Schema

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5.4 |
| UI | React 18.2, Tailwind CSS 3.4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic links) |
| Email | Resend |
| PDF | react-pdf (viewing), pdf-lib (generation), html2canvas (capture) |
| Rich Text | TipTap 3.20 |
| Drag & Drop | @dnd-kit |
| Whiteboard | @xyflow/react 12.10 |
| Icons | lucide-react |
| Deployment | Vercel |

---

## Project Structure

```
proposal-viewer/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (ToastProvider, ConfirmProvider)
│   ├── page.tsx                # Home → redirects to /proposals
│   ├── login/                  # Public auth page
│   ├── dashboard/              # Stats overview
│   ├── proposals/              # Proposal CRUD + sub-routes
│   ├── documents/              # Document CRUD + sub-routes
│   ├── templates/              # Template CRUD + sub-routes
│   ├── template-preview/[id]/  # Live template preview
│   ├── reviews/                # Creative review management
│   ├── view/[token]/           # Public proposal viewer
│   ├── doc/[token]/            # Public document viewer
│   ├── review/[token]/         # Public review viewer
│   ├── whiteboard/[token]/     # Public whiteboard viewer
│   ├── team/                   # Team management
│   ├── clients/                # Client management (agency)
│   ├── company/                # Branding settings
│   ├── settings/               # User settings
│   ├── accounts/               # Super-admin accounts
│   └── api/                    # ~48 API route handlers
├── components/
│   ├── admin/                  # Authenticated admin UI
│   │   ├── AdminLayout.tsx     # Layout with AuthGuard + sidebar
│   │   ├── AdminSidebar.tsx    # Navigation sidebar (thin shell)
│   │   ├── sidebar/            # Sidebar config, AccountSwitcher
│   │   ├── proposals/          # Proposal editor components
│   │   ├── documents/          # Document editor components
│   │   ├── templates/          # Template editor components
│   │   ├── reviews/            # Review management + whiteboard board
│   │   ├── page-editor/        # Sortable page editor (drag-and-drop)
│   │   ├── pricing/            # Pricing config (schedule sections, summary)
│   │   ├── shared/             # Shared editors (cover, design, TOC, etc.)
│   │   ├── text-editor/        # TipTap rich text editor
│   │   ├── company/            # Branding/color settings + useCompanySettings hook
│   │   └── settings/           # Profile, notifications, webhook settings
│   ├── viewer/                 # Public proposal/document viewer + extracted components
│   │   ├── useViewerPage.ts    # Viewer state, effects, derived branding
│   │   ├── ViewerPageContent   # Page type router (toc/text/pricing/packages/pdf)
│   │   ├── ViewerModals        # Accept/decline/revision modals
│   │   └── ...                 # TocPage, TextPage, PricingPage, etc.
│   ├── review/                 # Public review board viewer
│   ├── reviews/                # Review detail + comments + feedback
│   ├── auth/                   # AuthGuard
│   └── ui/                     # Primitives (Toast, ConfirmDialog, Toggle, etc.)
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts              # Session, roles, company override
│   ├── useProposal.ts          # Proposal data fetching + init (thin orchestrator)
│   ├── useProposalDerived.ts   # Derived page state (pageEntries, sequences, type helpers)
│   ├── useProposalActions.ts   # Proposal actions (accept, decline, comments CRUD)
│   ├── useDocument.ts          # Document data
│   ├── useTemplatePreview.ts   # Template preview data
│   ├── useInvites.ts           # Invite management
│   ├── useBrandingColors.ts    # Branding color utilities
│   ├── useCommentFilters.ts    # Comment filtering
│   ├── useGuestIdentity.ts     # Guest session for public viewers
│   └── usePinFeedback.ts       # Pin annotation state
├── lib/
│   ├── types/                  # All TypeScript type definitions
│   ├── supabase.ts             # Supabase client + re-exports types
│   ├── supabase-server.ts      # Server-side Supabase ops
│   ├── api-auth.ts             # API auth context extraction
│   ├── page-operations.ts      # Unified page CRUD barrel (re-exports from page-types/queries/mutations)
│   ├── page-types.ts           # Entity types, UnifiedPage, config helpers
│   ├── page-queries.ts         # Read operations (getPages, getPageUrls)
│   ├── page-mutations.ts       # Write operations (add, update, delete, reorder pages)
│   ├── notifications.ts        # Notification orchestrator (re-exports from sub-modules)
│   ├── notification-types.ts   # Event types, payload interfaces
│   ├── notification-emails.ts  # HTML email builders (team + client)
│   ├── notification-webhooks.ts # Webhook dispatch with HMAC signing
│   ├── resend.ts               # Resend client init
│   ├── export/                 # PDF export utilities
│   ├── google-fonts.ts         # Google Fonts integration
│   ├── branding-defaults.ts    # Default branding config
│   └── ...                     # Other utilities
├── middleware.ts                # Currently disabled (no-op)
├── next.config.js              # Webpack canvas alias
├── tailwind.config.js          # Custom fonts via CSS vars
└── vercel.json                 # Cache-control headers for API + viewer
```

---

## Data Schema

### Database Tables & Relationships

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  companies   │────<│ team_members  │     │  company_invites  │
│              │     │              │     │                  │
│  id (PK)     │     │  user_id (FK)│     │  company_id (FK) │
│  name        │     │  company_id  │     │  token           │
│  branding    │     │  role        │     │  email           │
│  domain      │     │  ...         │     │  ...             │
└──────┬───────┘     └──────────────┘     └──────────────────┘
       │
       ├───<┌──────────────┐    ┌────────────────────┐
       │    │  proposals    │───<│  proposal_pages_v2  │
       │    │              │    │                    │
       │    │  id (PK)     │    │  id (PK)           │
       │    │  company_id  │    │  entity_id (FK)    │
       │    │  share_token │    │  type              │
       │    │  status      │    │  position          │
       │    │  ...         │    │  payload (JSONB)   │
       │    └──────┬───────┘    └────────────────────┘
       │           │
       │           └───<┌────────────────────┐
       │                │ proposal_comments   │
       │                │                    │
       │                │  id (PK)           │
       │                │  proposal_id (FK)  │
       │                │  parent_id (self)  │
       │                │  author_type       │
       │                │  ...               │
       │                └────────────────────┘
       │
       ├───<┌──────────────┐    ┌────────────────────┐
       │    │  documents    │───<│  document_pages_v2  │
       │    └──────────────┘    └────────────────────┘
       │
       ├───<┌──────────────────┐    ┌────────────────────┐
       │    │proposal_templates │───<│  template_pages_v2  │
       │    └──────────────────┘    └────────────────────┘
       │
       ├───<┌──────────────────┐    ┌──────────────────┐
       │    │ review_projects   │───<│  review_items     │
       │    │                  │    │                  │
       │    │  share_token     │    │  id (PK)         │
       │    │  board_share_tkn │    │  type             │
       │    │  share_mode      │    │  status           │
       │    │  ...             │    │  share_token      │
       │    │                  │    │  board_x, board_y │
       │    │                  │    │  ...              │
       │    └────────┬─────────┘    └────────┬─────────┘
       │             │                       │
       │             ├───<┌──────────────────────┐
       │             │    │  review_comments      │
       │             │    │                      │
       │             │    │  review_item_id (FK) │
       │             │    │  parent_comment_id   │
       │             │    │  comment_type        │
       │             │    │  pin_x, pin_y        │
       │             │    │  highlight_*         │
       │             │    │  ...                 │
       │             │    └──────────────────────┘
       │             │
       │             ├───<┌──────────────────────┐
       │             │    │  review_board_edges   │
       │             │    └──────────────────────┘
       │             │
       │             └───<┌──────────────────────┐
       │                  │  review_board_notes   │
       │                  └──────────────────────┘
       │
       └───<┌──────────────────┐
            │webhook_endpoints  │
            └──────────────────┘
```

### Core Entity Types

#### `Proposal`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key (UUID) |
| `company_id` | `string` | FK → companies |
| `title` | `string` | Proposal title |
| `client_name` | `string` | Client name |
| `client_email` | `string` | Client email |
| `crm_identifier` | `string` | External CRM reference |
| `description` | `string` | Description |
| `file_path` | `string` | Supabase storage path (legacy PDF) |
| `file_size_bytes` | `number` | File size |
| `share_token` | `string` | Public sharing token |
| `status` | `'draft' \| 'sent' \| 'viewed' \| 'accepted' \| 'declined'` | Lifecycle status |
| `sent_at` | `string` | When marked as sent |
| `first_viewed_at` | `string` | First client view |
| `last_viewed_at` | `string` | Most recent view |
| `accepted_at` | `string` | Acceptance timestamp |
| `declined_at` | `string` | Decline timestamp |
| `accepted_by_name` | `string` | Who accepted |
| `page_names` | `PageNameEntry[]` | Navigation labels |
| `cover_image_path` | `string` | Cover image storage path |
| `cover_subtitle` | `string` | Cover subtitle |
| `cover_button_text` | `string` | Cover CTA button text |
| `cover_bg_*` | `string` | Cover background colors (top/bottom) |
| `cover_text_color` | `string` | Cover text color |
| `cover_accent_color` | `string` | Cover accent color |
| `cover_bg_style` | `'gradient' \| 'solid'` | Background mode |
| `background_image_path` | `string` | Viewer background image |
| `background_overlay_opacity` | `number` | Overlay opacity |
| `post_accept_action` | `'redirect' \| 'message'` | After acceptance action |
| `post_accept_url` | `string` | Redirect URL |
| `post_accept_message` | `string` | Success message |
| `created_by_name` | `string` | Creator name |
| `prepared_by` | `string` | Preparer name |
| `prepared_by_member_id` | `string` | FK → team_members |
| `client_logo_path` | `string` | Client logo |
| `client_avatar_path` | `string` | Client avatar |
| `date` | `string` | Proposal date |
| `show_date` | `boolean` | Show date flag |
| `show_description` | `boolean` | Show description flag |
| `page_orientation` | `'portrait' \| 'landscape'` | Default orientation |
| `toc_settings` | `TocSettings` | Table of contents config |
| `page_order` | `PageOrderEntry[]` | Page sequence |
| `text_page_*` | Various | Text page styling (colors, fonts, borders) |
| `page_num_*` | Various | Page number styling |
| `created_at` | `string` | Timestamp |
| `updated_at` | `string` | Timestamp |

#### `UnifiedPage` (proposal_pages_v2 / document_pages_v2 / template_pages_v2)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `entity_id` | `string` | FK → proposal / document / template |
| `company_id` | `string` | FK → companies |
| `position` | `number` | Sort order |
| `type` | `'pdf' \| 'text' \| 'pricing' \| 'packages' \| 'toc' \| 'section'` | Page type |
| `title` | `string` | Page title |
| `indent` | `number` | Nesting level (0 = top, 1 = child) |
| `enabled` | `boolean` | Visibility |
| `link_url` | `string` | Optional external link |
| `link_label` | `string` | Link button label |
| `orientation` | `'portrait' \| 'landscape'` | Page orientation |
| `show_title` | `boolean` | Show title in viewer |
| `show_member_badge` | `boolean` | Show preparer badge |
| `show_client_logo` | `boolean` | Show client logo |
| `prepared_by_member_id` | `string` | Per-page preparer override |
| `payload` | `JSONB` | Type-specific data (HTML content, pricing items, etc.) |
| `created_at` | `string` | Timestamp |
| `updated_at` | `string` | Timestamp |

#### `Document`

Same structure as `Proposal` with document-specific fields. Shares cover, styling, and page system. No status lifecycle (no accept/decline).

#### `ProposalTemplate`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `company_id` | `string` | FK → companies |
| `name` | `string` | Template name |
| `description` | `string` | Description |
| `page_count` | `number` | Number of pages |
| `section_headers` | `PageNameEntry[]` | Navigation structure |
| `file_path` | `string` | Optional PDF upload |
| Cover & styling fields | Various | Same as Proposal |

#### `ProposalComment`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `proposal_id` | `string` | FK → proposals |
| `author_name` | `string` | Author display name |
| `author_type` | `'team' \| 'client'` | Author category |
| `content` | `string` | Comment text |
| `page_number` | `number` | Associated page |
| `is_internal` | `boolean` | Internal-only flag |
| `parent_id` | `string` | FK → self (threading) |
| `resolved_at` | `string` | Resolution timestamp |
| `resolved_by` | `string` | Who resolved |
| `company_id` | `string` | FK → companies |
| `created_at` | `string` | Timestamp |

---

### Pricing & Packages

#### `ProposalPricing`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `proposal_id` | `string` | FK → proposals |
| `company_id` | `string` | FK → companies |
| `enabled` | `boolean` | Active flag |
| `position` | `number` | Sort order |
| `title` | `string` | Section title |
| `intro_text` | `string` | Intro paragraph |
| `items` | `PricingLineItem[]` | Line items (id, label, description, percentage, amount) |
| `optional_items` | `PricingOptionalItem[]` | Optional add-ons (id, label, description, amount) |
| `payment_schedule` | `PaymentSchedule \| null` | Payment config (one-off, milestones, recurring) |
| `tax_enabled` | `boolean` | Tax toggle |
| `tax_rate` | `number` | Tax percentage |
| `tax_label` | `string` | Tax label (e.g., "GST") |
| `validity_days` | `number` | Quote validity period |
| `indent` | `number` | Navigation indent |
| `proposal_date` | `string` | Date shown on pricing |

#### `PaymentSchedule`

```typescript
{
  one_off:    { enabled, amount, label, note }
  milestones: { enabled, payments: MilestonePayment[] }
  recurring:  { enabled, amount, frequency, label, note }
}
// frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually'
```

#### `ProposalPackages`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `proposal_id` | `string` | FK → proposals |
| `company_id` | `string` | FK → companies |
| `enabled` | `boolean` | Active flag |
| `title` | `string` | Section title |
| `intro_text` | `string` | Intro paragraph |
| `packages` | `PackageTier[]` | Pricing tiers |
| `footer_text` | `string` | Footer content |
| `styling` | `PackageStyling` | Visual styling config |
| `sort_order` | `number` | Sort position |

#### `PackageTier`

```typescript
{
  id, name, price,
  price_prefix,          // e.g., "FROM"
  price_suffix,          // e.g., "/month"
  is_recommended,
  highlight_color,
  conditions: string[],
  features: PackageFeature[],  // { text, bold_prefix, children }
  sort_order,
  card_bg_color?,        // per-tier override
  card_text_color?
}
```

---

### Review System

#### `ReviewProject`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `company_id` | `string` | FK → companies |
| `title` | `string` | Project title |
| `description` | `string` | Description |
| `client_name` | `string` | Client name |
| `client_email` | `string` | Client email |
| `status` | `'active' \| 'archived' \| 'completed'` | Project status |
| `share_token` | `string` | Public share token |
| `board_share_token` | `string` | Whiteboard share token |
| `share_mode` | `'list' \| 'board'` | Default view mode |
| `created_by` | `string` | Creator |

#### `ReviewItem`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `review_project_id` | `string` | FK → review_projects |
| `company_id` | `string` | FK → companies |
| `title` | `string` | Item title |
| `type` | `'webpage' \| 'email' \| 'ad' \| 'image' \| 'video' \| 'sms'` | Content type |
| `status` | `'draft' \| 'in_review' \| 'approved' \| 'revision_needed'` | Review status |
| `sort_order` | `number` | Display order |
| `url` | `string` | Webpage URL |
| `screenshot_url` | `string` | Screenshot storage path |
| `html_content` | `string` | Email/webpage HTML |
| `email_subject` | `string` | Email subject |
| `email_preheader` | `string` | Email preheader |
| `email_body` | `string` | Email body |
| `ad_headline` | `string` | Ad headline |
| `ad_copy` | `string` | Ad body copy |
| `ad_cta` | `string` | Ad CTA text |
| `ad_creative_url` | `string` | Ad creative image |
| `ad_platform` | `string` | Ad platform |
| `sms_body` | `string` | SMS content |
| `image_url` | `string` | Image URL |
| `version` | `number` | Item version |
| `widget_installed_at` | `string` | Widget install timestamp |
| `board_x` | `number` | Whiteboard X position |
| `board_y` | `number` | Whiteboard Y position |
| `share_token` | `string` | Individual item share token |

#### `ReviewComment`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `review_item_id` | `string` | FK → review_items |
| `parent_comment_id` | `string` | FK → self (threading) |
| `thread_number` | `number` | Thread index |
| `author_name` | `string` | Author name |
| `author_email` | `string` | Author email |
| `author_user_id` | `string` | Optional FK → users |
| `author_type` | `'team' \| 'client'` | Author category |
| `content` | `string` | Comment text |
| `comment_type` | `'pin' \| 'text_highlight' \| 'general'` | Annotation type |
| `pin_x` | `number` | Pin X coordinate |
| `pin_y` | `number` | Pin Y coordinate |
| `highlight_start` | `number` | Text highlight start |
| `highlight_end` | `number` | Text highlight end |
| `highlight_text` | `string` | Highlighted text |
| `highlight_element_path` | `string` | DOM element path |
| `resolved` | `boolean` | Resolution status |
| `resolved_by` | `string` | Who resolved |
| `resolved_at` | `string` | Resolution timestamp |

#### `ReviewBoardEdge`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `review_project_id` | `string` | FK → review_projects |
| `source_item_id` | `string` | FK → review_items |
| `target_item_id` | `string` | FK → review_items |
| `source_handle` | `string` | Source connection point |
| `target_handle` | `string` | Target connection point |
| `label` | `string` | Edge label |
| `edge_type` | `string` | Edge visual type |
| `animated` | `boolean` | Animation flag |
| `style` | `Record<string, unknown>` | Custom styles |

#### `ReviewBoardNote`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `review_project_id` | `string` | FK → review_projects |
| `content` | `string` | Note text |
| `color` | `string` | Note color |
| `board_x` | `number` | X position |
| `board_y` | `number` | Y position |
| `width` | `number` | Note width |
| `height` | `number` | Note height |
| `font_size` | `number` | Font size |

---

### Team & Auth

#### `TeamMember`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `user_id` | `string` | FK → Supabase auth.users |
| `company_id` | `string` | FK → companies |
| `name` | `string` | Display name |
| `email` | `string` | Email |
| `role` | `'owner' \| 'admin' \| 'member'` | Role |
| `is_super_admin` | `boolean` | Cross-company admin |
| `avatar_path` | `string` | Avatar storage path |
| `notify_proposal_viewed` | `boolean` | Notification pref |
| `notify_proposal_accepted` | `boolean` | Notification pref |
| `notify_comment_added` | `boolean` | Notification pref |
| `notify_comment_resolved` | `boolean` | Notification pref |
| `notify_review_comment_added` | `boolean` | Notification pref |
| `notify_review_item_status` | `boolean` | Notification pref |

#### `WebhookEndpoint`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `company_id` | `string` | FK → companies |
| `event_type` | `string` | Event trigger (see below) |
| `url` | `string` | Webhook URL |
| `secret` | `string` | HMAC signing secret |
| `enabled` | `boolean` | Active flag |

**Webhook Events:** `proposal_viewed`, `proposal_accepted`, `comment_added`, `comment_resolved`, `review_comment_added`, `review_comment_resolved`, `review_item_approved`, `review_item_revision_needed`

---

### Supporting Types

#### `CompanyBranding`

Company-wide visual configuration including:
- Logo, accent colors, background colors
- Cover background style (gradient/solid), cover colors, button styling
- Font families and weights for heading, body, sidebar
- Text page styling (bg color, text color, border settings)
- Page number styling (circle/text colors)
- Helper functions: `deriveBorderColor()`, `deriveSurfaceColor()`

#### `PageNameEntry`

```typescript
{
  name: string;
  indent: number;         // 0 = top level, 1 = nested child
  type?: 'page' | 'group'; // group = section header, not a real page
  link_url?: string;
  link_label?: string;
  orientation?: 'portrait' | 'landscape';
}
```

#### `TocSettings`

```typescript
{
  enabled: boolean;
  title: string;
  position: number;       // 0 = before first, -1 = after last
  excluded_items: string[]; // "pdf:3", "text:uuid", "pricing", "packages", "group:Name"
}
```

#### `PageOrderEntry`

```typescript
| { type: 'pdf' }
| { type: 'pricing' }
| { type: 'packages'; id: string }
| { type: 'text'; id: string }
| { type: 'toc' }
```

#### `PackageStyling`

```typescript
{
  title_color, card_bg_color, card_bg_independent,
  card_text_color, card_text_independent,
  recommended_text_color, recommended_bg_color,
  feature_icon: 'dot' | 'check' | 'checkCircle' | 'arrow' | 'star' | 'dash',
  border_radius, border_width
}
```

---

## API Routes

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user (optional invite token) |

### Company
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company` | Get company details |
| PATCH | `/api/company` | Update company settings |
| GET | `/api/company/branding?company_id=` | Public branding config |
| POST | `/api/company/logo` | Upload company logo |
| POST | `/api/company/domain` | Set custom domain |
| POST | `/api/company/domain/verify` | Verify domain |

### Proposals
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals` | Create proposal |
| PATCH | `/api/proposals` | Update proposal |
| GET | `/api/proposals/page-urls?share_token=` | Public: get pages with signed URLs |
| GET | `/api/proposals/pages?proposal_id=` | Get all pages |
| POST | `/api/proposals/pages` | Add page (pdf/text/pricing/packages) |
| PUT | `/api/proposals/pages?id=` | Update page |
| DELETE | `/api/proposals/pages` | Delete page |
| POST | `/api/proposals/pages/reorder` | Reorder pages |
| POST | `/api/proposals/split` | Split PDF into per-page rows |
| POST | `/api/proposals/mark-sent` | Mark as sent + fire webhook |
| GET | `/api/proposals/member-info?member_id=` | Get member badge data |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/documents` | Update document |
| GET | `/api/documents/page-urls?share_token=` | Public: get pages with signed URLs |
| GET | `/api/documents/pages?document_id=` | Get all pages |
| POST | `/api/documents/pages` | Add page |
| PUT | `/api/documents/pages?id=` | Update page |
| DELETE | `/api/documents/pages` | Delete page |
| POST | `/api/documents/pages/reorder` | Reorder pages |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/templates` | Update template |
| GET | `/api/templates/page-url?template_id=&page_num=` | Get signed URL |
| GET | `/api/templates/pages?template_id=` | List pages |
| POST | `/api/templates/pages` | Add page |
| PUT | `/api/templates/pages?id=` | Update page |
| DELETE | `/api/templates/pages` | Delete page |
| POST | `/api/templates/pages/reorder` | Reorder pages |
| POST | `/api/templates/section-headers` | Update section headers |
| POST | `/api/templates/copy-data` | Copy between templates |
| POST | `/api/templates/split` | Split PDF |
| POST | `/api/templates/merge` | Merge PDFs |
| POST | `/api/templates/rebuild-merged` | Rebuild merged PDF |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/review/[token]` | Public: get review data |
| POST | `/api/review/[token]/comments` | Public: post comment |
| GET | `/api/project/[token]` | Public: get project + items |
| POST | `/api/reviews/[id]/share` | Generate/revoke share tokens |
| POST | `/api/review-comments/[id]/resolve` | Resolve/unresolve comment |

### Review Widget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/review-widget/[token]/verify` | Verify widget token |
| POST | `/api/review-widget/[token]/script` | Get widget script |
| POST | `/api/review-widget/[token]/comments` | Submit comment via widget |
| POST | `/api/review-widget/[token]/screenshot` | Save screenshot |

### Whiteboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whiteboard/[token]` | Get/update board data |

### Team
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/team` | List team members |
| PATCH | `/api/team/[id]` | Update member settings |
| GET | `/api/team-members?id=` | Get single member |
| GET | `/api/clients` | List client companies |
| POST | `/api/clients` | Create client company |

### Invites
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invites` | Create invite |
| GET | `/api/invites` | List pending invites |
| DELETE | `/api/invites/[id]` | Cancel invite |
| POST | `/api/invites/validate` | Validate invite token |

### Notifications & Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notify` | Fire internal notification |
| POST | `/api/review-notify` | Fire review notification |
| POST | `/api/webhooks/test` | Send test webhook |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/accounts` | List agency accounts (super-admin) |
| POST | `/api/admin/accounts` | Create agency account (super-admin) |
| GET | `/api/member-badge?member_id=` | Public: member name + avatar |

---

## Key Architectural Patterns

### Authentication & Authorization
- **Supabase Auth** with email/password and magic links
- **AuthGuard** component wraps all admin pages
- **3 roles**: `owner` > `admin` > `member`
- **Super admin** flag for cross-company access with company override
- **Agency model**: agency companies can have child client companies
- **Token-based public access** for proposals, documents, reviews, whiteboards

### Unified Page System
- Proposals, documents, and templates share the same page abstraction (`UnifiedPage`)
- Stored in separate tables (`proposal_pages_v2`, `document_pages_v2`, `template_pages_v2`) with identical schema
- Page types: `pdf`, `text`, `pricing`, `packages`, `toc`, `section`
- `payload` JSONB column holds type-specific data
- Centralized CRUD via `lib/page-operations.ts` (barrel re-exporting from `page-types.ts`, `page-queries.ts`, `page-mutations.ts`)

### State Management
- **No global state library** — React hooks + Context API only
- `useAuth` for session/auth state
- `useProposal` / `useDocument` for entity-specific data fetching
- `ToastContext` and `ConfirmContext` for UI feedback
- All data fetched via API routes → Supabase

### Component Architecture (SRP Pattern)
Large components follow a consistent single-responsibility extraction pattern:
- **Custom hook** (`use*.ts`) — all state, effects, handlers, derived values
- **Sub-components** — focused UI sections receiving data via props
- **Parent** — thin orchestrator that wires hook output to sub-components
- **Barrel re-exports** — library modules (page-operations, notifications) use barrel files to preserve existing import paths
- Example: `PricingPaymentSchedule.tsx` → `usePricingSchedule` hook + `OneOffSection` / `MilestonesSection` / `RecurringSection` / `PaymentSummary` components

### Public Sharing
- Token-based routes: `/view/[token]`, `/doc/[token]`, `/review/[token]`, `/whiteboard/[token]`
- No auth required for public viewers
- Signed URLs for Supabase Storage files (time-limited)

### Email Notifications
- **Resend** for transactional email
- Webhook system for external integrations (Zapier, etc.)
- Per-member notification preferences

### PDF Pipeline
- Upload PDF → split into per-page rows (Supabase Storage)
- `react-pdf` for client-side rendering
- `pdf-lib` for server-side manipulation
- `html2canvas` for screenshot capture / export
