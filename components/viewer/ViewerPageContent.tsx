// components/viewer/ViewerPageContent.tsx
'use client';

import { RefObject } from 'react';
import type { CompanyBranding, PageUrlEntry } from '@/hooks/useProposal';
import type { ProposalPricing, ProposalPackages, TocSettings, PageNameEntry } from '@/lib/supabase';
import PdfViewer from './PdfViewer';
import TextPage from './TextPage';
import TocPage, { type PageSequenceEntry } from './TocPage';
import PricingPage from './PricingPage';
import PackagesPage from './PackagesPage';
import ViewerBackground from './ViewerBackground';

interface ViewerPageContentProps {
  branding: CompanyBranding;
  bgPrimary: string;
  pageOrientation: 'portrait' | 'landscape';
  scrollRef: RefObject<HTMLDivElement>;
  // Page type flags
  onTocPage: boolean;
  onTextPage: boolean;
  onPricingPage: boolean;
  onPackagesPage: boolean;
  // Page data
  tocSettings: TocSettings | null;
  pageSequence: PageSequenceEntry[];
  pageEntries: PageNameEntry[];
  numPages: number;
  currentTextPage: Record<string, unknown> | undefined;
  pricing: unknown;
  currentPackages: unknown;
  // PDF
  pdfUrl: string | null;
  pdfPage: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  accentColor: string;
  pageUrls: PageUrlEntry[];
  // Context
  proposal: Record<string, unknown> | null;
  clientLogoUrl: string | undefined;
}

export default function ViewerPageContent({
  branding, bgPrimary, pageOrientation, scrollRef,
  onTocPage, onTextPage, onPricingPage, onPackagesPage,
  tocSettings, pageSequence, pageEntries, numPages,
  currentTextPage, pricing, currentPackages,
  pdfUrl, pdfPage, onLoadSuccess, accentColor, pageUrls,
  proposal, clientLogoUrl,
}: ViewerPageContentProps) {
  if (onTocPage && tocSettings) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            <TocPage
              branding={branding}
              tocSettings={tocSettings}
              pageSequence={pageSequence}
              pageEntries={pageEntries}
              numPages={numPages}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onTextPage && currentTextPage) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TextPage
              textPage={currentTextPage as any}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              companyName={branding.name}
              userName={proposal?.created_by_name as string | undefined}
              proposalTitle={proposal?.title as string | undefined}
              clientLogoUrl={clientLogoUrl}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onPricingPage && pricing) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            <PricingPage
              pricing={pricing as unknown as ProposalPricing}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  if (onPackagesPage && currentPackages) {
    return (
      <div className="flex-1 relative" style={{ backgroundColor: bgPrimary }}>
        <ViewerBackground branding={branding} />
        <div ref={scrollRef} className="absolute inset-0 overflow-auto">
          <div className="relative min-h-full">
            <PackagesPage
              packages={currentPackages as unknown as ProposalPackages}
              branding={branding}
              clientName={proposal?.client_name as string | undefined}
              orientation={pageOrientation}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PdfViewer
      pdfUrl={pdfUrl}
      currentPage={pdfPage}
      onLoadSuccess={onLoadSuccess}
      scrollRef={scrollRef}
      bgColor={bgPrimary}
      accentColor={accentColor}
      branding={branding}
      pageUrls={pageUrls.filter((p) => p.type === 'pdf')}
    />
  );
}
