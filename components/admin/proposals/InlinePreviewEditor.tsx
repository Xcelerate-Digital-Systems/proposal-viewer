// components/admin/proposals/InlinePreviewEditor.tsx
// Inline "edit in preview" view. Shows every page as a scaled preview with hover
// edit affordances. Clicking a section opens SectionEditorPanel on the right.
'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Pencil, FileText, DollarSign, Package, List, LayoutTemplate, X,
} from 'lucide-react';
import { useProposalById } from '@/hooks/useProposalById';
import { type PageUrlEntry } from '@/hooks/useProposal';
import PricingPreview from '@/components/admin/shared/PricingPreview';
import PackagesPreview from '@/components/admin/shared/PackagesPreview';
import ViewerPagePreview from '@/components/admin/shared/ViewerPagePreview';
import TextPage from '@/components/viewer/TextPage';
import SectionEditorPanel, { type ActiveSection } from './SectionEditorPanel';
import type { ProposalPricing, ProposalPackages } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface InlinePreviewEditorProps {
  proposalId: string;
  onExit: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InlinePreviewEditor({ proposalId, onExit }: InlinePreviewEditorProps) {
  const { proposal, pages, branding, loading, reload } = useProposalById(proposalId);
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

  const handleSaved = useCallback(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Proposal not found.
      </div>
    );
  }

  const enabledPages = pages.filter((p) => p.type !== 'section');

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: page previews ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6 space-y-6">

        {/* Exit bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview Edit Mode</span>
            <span className="text-xs text-gray-400">— click any section to edit</span>
          </div>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <X size={13} />
            Exit Preview
          </button>
        </div>

        {enabledPages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutTemplate size={36} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 mb-4">No pages yet. Add some content in the Layout tab.</p>
            <Link
              href={`/proposals/${proposalId}/pages`}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-[#01434A] transition-colors"
            >
              Go to Layout
            </Link>
          </div>
        )}

        {enabledPages.map((page) => (
          <PagePreviewCard
            key={page.id}
            page={page}
            branding={branding}
            proposal={proposal as Record<string, unknown>}
            isActive={
              activeSection !== null &&
              ((activeSection.type === 'pricing' && page.type === 'pricing') ||
               (activeSection.type === 'packages' && 'pageId' in activeSection && activeSection.pageId === page.id) ||
               (activeSection.type === 'text' && 'pageId' in activeSection && activeSection.pageId === page.id) ||
               (activeSection.type === 'cover' && page.type === 'cover' as string))
            }
            onEdit={() => {
              if (page.type === 'pricing') {
                setActiveSection({ type: 'pricing' });
              } else if (page.type === 'packages') {
                setActiveSection({ type: 'packages', pageId: page.id });
              } else if (page.type === 'text') {
                setActiveSection({ type: 'text', pageId: page.id });
              } else {
                setActiveSection(null);
              }
            }}
          />
        ))}
      </div>

      {/* ── Right: editor panel ──────────────────────────────── */}
      {activeSection && (
        <SectionEditorPanel
          proposalId={proposalId}
          section={activeSection}
          onClose={() => setActiveSection(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PagePreviewCard                                                    */
/* ------------------------------------------------------------------ */

interface PagePreviewCardProps {
  page: PageUrlEntry;
  branding: ReturnType<typeof useProposalById>['branding'];
  proposal: Record<string, unknown>;
  isActive: boolean;
  onEdit: () => void;
}

function PagePreviewCard({ page, branding, proposal, isActive, onEdit }: PagePreviewCardProps) {
  const isEditable = page.type === 'pricing' || page.type === 'packages' || page.type === 'text';

  return (
    <div
      className={`group relative rounded-xl border transition-all ${
        isActive
          ? 'border-teal ring-2 ring-teal/20'
          : isEditable
          ? 'border-gray-200 hover:border-teal/40 cursor-pointer'
          : 'border-gray-200'
      }`}
      onClick={isEditable ? onEdit : undefined}
    >
      {/* Page type badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/90 backdrop-blur-sm border border-gray-200 text-xs font-medium text-gray-600">
        <PageTypeIcon type={page.type} />
        <span className="capitalize">{page.title || page.type}</span>
      </div>

      {/* Edit affordance (editable sections only) */}
      {isEditable && (
        <div className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isActive
            ? 'bg-teal text-white opacity-100'
            : 'bg-white/90 backdrop-blur-sm border border-teal/30 text-teal opacity-0 group-hover:opacity-100'
        }`}>
          <Pencil size={11} />
          {isActive ? 'Editing' : 'Edit'}
        </div>
      )}

      {/* Page preview content */}
      <div className="overflow-hidden rounded-xl">
        <PageContent page={page} branding={branding} proposal={proposal} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PageContent — renders the right preview for each page type        */
/* ------------------------------------------------------------------ */

interface PageContentProps {
  page: PageUrlEntry;
  branding: ReturnType<typeof useProposalById>['branding'];
  proposal: Record<string, unknown>;
}

function PageContent({ page, branding, proposal }: PageContentProps) {
  if (page.type === 'pricing' && page.payload) {
    const pricing = payloadToPricing(page);
    if (pricing) {
      return <PricingPreview pricing={pricing} branding={branding} />;
    }
  }

  if (page.type === 'packages' && page.payload) {
    const packages = payloadToPackages(page);
    if (packages) {
      return <PackagesPreview packages={packages} branding={branding} />;
    }
  }

  if (page.type === 'text' && page.payload?.content) {
    return (
      <ViewerPagePreview branding={branding} label={page.title} icon={<FileText size={11} />}>
        <TextPage
          textPage={page as unknown as Parameters<typeof TextPage>[0]['textPage']}
          branding={branding}
          clientName={proposal.client_name as string | undefined}
          companyName={branding.name}
          userName={proposal.created_by_name as string | undefined}
          proposalTitle={proposal.title as string | undefined}
          orientation="portrait"
        />
      </ViewerPagePreview>
    );
  }

  if (page.type === 'toc') {
    return (
      <PagePlaceholder icon={<List size={20} />} label="Table of Contents" sublabel="Shown in the viewer sidebar" />
    );
  }

  if (page.type === 'pdf') {
    return (
      <PagePlaceholder icon={<FileText size={20} />} label="PDF Page" sublabel="PDF pages render in the viewer" />
    );
  }

  return (
    <PagePlaceholder icon={<FileText size={20} />} label={page.title || page.type} sublabel="No preview available" />
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function PagePlaceholder({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-gray-50 rounded-xl">
      <div className="text-gray-300">{icon}</div>
      <span className="text-sm font-medium text-gray-500">{label}</span>
      {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
    </div>
  );
}

function PageTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'pricing':  return <DollarSign size={11} />;
    case 'packages': return <Package size={11} />;
    case 'text':     return <FileText size={11} />;
    case 'toc':      return <List size={11} />;
    default:         return <FileText size={11} />;
  }
}

function payloadToPricing(page: PageUrlEntry): ProposalPricing | null {
  const p = page.payload;
  if (!p) return null;
  return {
    id: page.id,
    proposal_id: '',
    company_id: '',
    enabled: true,
    position: page.position,
    indent: page.indent,
    title: (p.title as string) || 'Project Investment',
    intro_text: (p.intro_text as string) || '',
    items: (p.items as ProposalPricing['items']) || [],
    optional_items: (p.optional_items as ProposalPricing['optional_items']) || [],
    payment_schedule: (p.payment_schedule as ProposalPricing['payment_schedule']) || { one_off: { enabled: true, amount: 0, label: '', note: '' }, milestones: { enabled: false, payments: [] }, recurring: { enabled: false, amount: 0, frequency: 'monthly', label: '', note: '' } },
    tax_enabled: (p.tax_enabled as boolean) ?? false,
    tax_rate: (p.tax_rate as number) ?? 10,
    tax_label: (p.tax_label as string) || 'GST',
    validity_days: (p.validity_days as number | null) ?? null,
    proposal_date: (p.proposal_date as string | null) ?? null,
    created_at: '',
    updated_at: '',
  };
}

function payloadToPackages(page: PageUrlEntry): ProposalPackages | null {
  const p = page.payload;
  if (!p) return null;
  return {
    id: page.id,
    proposal_id: '',
    company_id: '',
    enabled: true,
    position: page.position,
    indent: page.indent,
    title: (p.title as string) || 'Your Investment',
    intro_text: (p.intro_text as string) || '',
    sort_order: 0,
    packages: (p.packages as ProposalPackages['packages']) || [],
    footer_text: (p.footer_text as string) || '',
    styling: (p.styling as ProposalPackages['styling']) || {},
    created_at: '',
    updated_at: '',
  };
}
