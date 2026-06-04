'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Proposal } from '@/lib/supabase';

import PreviewPane from '@/components/admin/proposals/quote-builder/PreviewPane';
import StickyPreviewAside from '@/components/admin/shared/StickyPreviewAside';

import ClientDetailsSection from '@/components/admin/proposals/quote-builder/sections/ClientDetailsSection';
import ProjectPhotosSection from '@/components/admin/proposals/quote-builder/sections/ProjectPhotosSection';
import AboutUsSection from '@/components/admin/proposals/quote-builder/sections/AboutUsSection';
import TestimonialSection from '@/components/admin/proposals/quote-builder/sections/TestimonialSection';
import BadgesSection from '@/components/admin/proposals/quote-builder/sections/BadgesSection';
import NextStepsSection from '@/components/admin/proposals/quote-builder/sections/NextStepsSection';
import TermsSection from '@/components/admin/proposals/quote-builder/sections/TermsSection';

import QuoteProjectDetailsSection from './sections/ProjectDetailsSection';
import ScopeOfWorksSection from './sections/ScopeOfWorksSection';
import QuoteLineItemsSection from './sections/QuoteLineItemsSection';
import PricingSettingsSection from './sections/PricingSettingsSection';
import AttachmentsSection from './sections/AttachmentsSection';
import QuoteActivityTimeline from './QuoteActivityTimeline';
import SectionGroup from './SectionGroup';

interface Props {
  proposal: Proposal;
  companyId: string;
  onRefetch: () => void;
}

const GROUPS = [
  { id: 'client-project', label: 'Client & Project' },
  { id: 'financials', label: 'Financials' },
  { id: 'branding', label: 'Branding' },
  { id: 'closing', label: 'Closing' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

export default function QuoteBuilderV2({ proposal, companyId, onRefetch }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<GroupId>>(() => {
    const s = new Set<GroupId>();
    GROUPS.forEach((g) => s.add(g.id));
    return s;
  });
  const [activeGroup, setActiveGroup] = useState<GroupId>('client-project');
  const [pricingRefreshKey, setPricingRefreshKey] = useState(0);

  const toggleGroup = useCallback((id: GroupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToGroup = useCallback((id: GroupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  useEffect(() => {
    const els = GROUPS.map((g) => document.getElementById(g.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveGroup(entry.target.id as GroupId);
          }
        }
      },
      { rootMargin: '-5% 0px -85% 0px', threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="px-6 lg:px-10 py-6">
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {/* Section nav */}
          <nav className="sticky top-0 z-[5] bg-white pt-1 pb-3 mb-5 shadow-divider">
            <div className="flex items-center gap-1">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => scrollToGroup(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeGroup === g.id
                      ? 'text-teal bg-teal/5'
                      : 'text-dim hover:text-prose hover:bg-surface'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Section groups */}
          <div className="space-y-8">
            <SectionGroup
              id="client-project"
              label="Client & Project"
              isOpen={openGroups.has('client-project')}
              onToggle={() => toggleGroup('client-project')}
            >
              <QuoteActivityTimeline proposal={proposal} />
              <ClientDetailsSection proposal={proposal} companyId={companyId} onSaved={onRefetch} />
              <QuoteProjectDetailsSection proposal={proposal} onSaved={onRefetch} />
              <ScopeOfWorksSection proposal={proposal} onSaved={onRefetch} />
              <ProjectPhotosSection proposal={proposal} onSaved={onRefetch} />
            </SectionGroup>

            <SectionGroup
              id="financials"
              label="Financials"
              isOpen={openGroups.has('financials')}
              onToggle={() => toggleGroup('financials')}
            >
              <QuoteLineItemsSection
                proposal={proposal}
                companyId={companyId}
                onApplied={() => { onRefetch(); setPricingRefreshKey((k) => k + 1); }}
              />
              <PricingSettingsSection proposal={proposal} onSaved={onRefetch} refreshKey={pricingRefreshKey} />
            </SectionGroup>

            <SectionGroup
              id="branding"
              label="Branding"
              isOpen={openGroups.has('branding')}
              onToggle={() => toggleGroup('branding')}
            >
              <AboutUsSection proposal={proposal} onSaved={onRefetch} />
              <TestimonialSection proposal={proposal} onSaved={onRefetch} />
              <BadgesSection proposal={proposal} onSaved={onRefetch} />
            </SectionGroup>

            <SectionGroup
              id="closing"
              label="Closing"
              isOpen={openGroups.has('closing')}
              onToggle={() => toggleGroup('closing')}
            >
              <NextStepsSection proposal={proposal} onSaved={onRefetch} />
              <TermsSection proposal={proposal} onSaved={onRefetch} />
              <AttachmentsSection proposal={proposal} onSaved={onRefetch} />
            </SectionGroup>
          </div>
        </div>

        <StickyPreviewAside sticky={false}>
          <PreviewPane proposal={proposal} companyId={companyId} />
        </StickyPreviewAside>
      </div>
    </div>
  );
}
