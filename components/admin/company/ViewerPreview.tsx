// components/admin/company/ViewerPreview.tsx
'use client';

import { useState } from 'react';
import {
  Building2, CheckCircle2, MessageSquare, ChevronRight, MousePointer2,
  Image as ImageIcon, FileText, Kanban,
  ThumbsUp, ThumbsDown, MessageCircle, Pin,
  BarChart3, Users,
} from 'lucide-react';
import { generateBrandPalette } from '@/lib/branding';
import { fontFamily } from '@/lib/google-fonts';
import DerivedPaletteSection from './DerivedPaletteSection';

type PreviewTab = 'proposal' | 'campaign' | 'portal';

interface ViewerPreviewProps {
  accent: string;
  bgPrimary: string;
  bgSecondary: string;
  bgDivider?: string | null;
  logoUrl: string | null;
  companyName: string;
  sidebarTextColor: string;
  acceptTextColor: string;
  fontSidebar?: string | null;
  fontSidebarWeight?: string | null;
  bgImageUrl?: string | null;
  bgImageOverlayOpacity?: number;
}

// The actual viewer uses branding.bg_secondary directly for the sidebar
// background — NOT palette.bgElevated (which is derived from bgPrimary).
// Sub-previews receive bgSecondary so colours match the real viewer.

export default function ViewerPreview({
  accent,
  bgPrimary,
  bgSecondary,
  bgDivider,
  logoUrl,
  companyName,
  sidebarTextColor,
  acceptTextColor,
  fontSidebar,
  fontSidebarWeight,
  bgImageUrl,
  bgImageOverlayOpacity = 0.85,
}: ViewerPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('proposal');
  const palette = generateBrandPalette(accent, bgPrimary, bgSecondary, sidebarTextColor, acceptTextColor, bgDivider);

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'proposal', label: 'Proposal' },
    { key: 'campaign', label: 'Campaign Review' },
    { key: 'portal', label: 'Client Portal' },
  ];

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-3 p-0.5 bg-surface rounded-lg border border-edge">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-2xs font-medium py-1.5 px-2 rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-ink shadow-sm'
                : 'text-faint hover:text-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preview frame */}
      <div
        className="rounded-2xl overflow-hidden border shadow-2xl shadow-black/40"
        style={{ borderColor: palette.border }}
      >
        {activeTab === 'proposal' && (
          <ProposalPreview
            palette={palette}
            bgSecondary={bgSecondary}
            logoUrl={logoUrl}
            companyName={companyName}
            acceptTextColor={acceptTextColor}
            fontSidebar={fontSidebar}
            fontSidebarWeight={fontSidebarWeight}
            bgImageUrl={bgImageUrl}
            bgImageOverlayOpacity={bgImageOverlayOpacity}
          />
        )}
        {activeTab === 'campaign' && (
          <CampaignPreview
            palette={palette}
            bgSecondary={bgSecondary}
            logoUrl={logoUrl}
            companyName={companyName}
            fontSidebar={fontSidebar}
          />
        )}
        {activeTab === 'portal' && (
          <PortalPreview
            palette={palette}
            bgSecondary={bgSecondary}
            logoUrl={logoUrl}
            companyName={companyName}
            fontSidebar={fontSidebar}
            fontSidebarWeight={fontSidebarWeight}
          />
        )}
      </div>

      {/* Collapsible derived palette */}
      <DerivedPaletteSection palette={palette} />
    </div>
  );
}

// ─── Proposal Preview ──────────────────────────────────────────────────────

function ProposalPreview({
  palette,
  bgSecondary,
  logoUrl,
  companyName,
  acceptTextColor,
  fontSidebar,
  fontSidebarWeight,
  bgImageUrl,
  bgImageOverlayOpacity,
}: {
  palette: ReturnType<typeof generateBrandPalette>;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
  acceptTextColor: string;
  fontSidebar?: string | null;
  fontSidebarWeight?: string | null;
  bgImageUrl?: string | null;
  bgImageOverlayOpacity?: number;
}) {
  return (
    <div className="flex h-[320px]" style={{ backgroundColor: palette.bg }}>
      {/* Sidebar */}
      <div
        className="w-[160px] shrink-0 flex flex-col border-r"
        style={{ backgroundColor: bgSecondary, borderColor: palette.border }}
      >
        <div className="px-3 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: palette.border }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-4 max-w-[120px] object-contain" />
          ) : companyName ? (
            <div className="flex items-center gap-1.5">
              <Building2 size={12} style={{ color: palette.faintText }} />
              <span className="text-2xs font-medium truncate" style={{ color: palette.sidebarText }}>{companyName}</span>
            </div>
          ) : (
            <div className="w-16 h-3 rounded" style={{ backgroundColor: palette.border }} />
          )}
        </div>
        <div className="flex-1 py-2 space-y-0.5 px-1" style={{ fontFamily: fontFamily(fontSidebar), fontWeight: fontSidebarWeight ? Number(fontSidebarWeight) : undefined }}>
          {['Executive Summary', 'Our Approach', 'Project Timeline', 'Investment', 'Case Studies', 'Next Steps', 'Decision'].map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-2xs truncate"
              style={{
                color: i === 0 ? palette.sidebarText : palette.mutedText,
                fontWeight: i === 0 ? 600 : 400,
                backgroundColor: i === 0 ? palette.accentSurface : 'transparent',
              }}
            >
              {i === 1 && <ChevronRight size={8} className="shrink-0" style={{ color: palette.faintText }} />}
              {item}
            </div>
          ))}
        </div>
        <div className="p-2 border-t" style={{ borderColor: palette.border }}>
          <div
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-2xs font-medium"
            style={{
              backgroundColor: palette.isDark ? 'rgba(6,78,59,0.15)' : 'rgba(5,150,105,0.08)',
              color: palette.isDark ? '#34d399' : '#059669',
            }}
          >
            <CheckCircle2 size={10} />
            Approved
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {bgImageUrl && (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImageUrl})` }} />
            <div className="absolute inset-0" style={{ backgroundColor: palette.bg, opacity: bgImageOverlayOpacity }} />
          </>
        )}
        <div className="relative w-full max-w-[260px] space-y-3">
          <div className="rounded-lg p-4 border" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <div className="w-3/4 h-2.5 rounded mb-3" style={{ backgroundColor: palette.border }} />
            <div className="w-full h-2 rounded mb-2" style={{ backgroundColor: palette.borderSubtle }} />
            <div className="w-5/6 h-2 rounded mb-2" style={{ backgroundColor: palette.borderSubtle }} />
            <div className="w-2/3 h-2 rounded mb-4" style={{ backgroundColor: palette.borderSubtle }} />
            <div className="flex gap-2">
              <div className="w-12 h-6 rounded" style={{ backgroundColor: palette.accent, opacity: 0.8 }} />
              <div className="w-12 h-6 rounded border" style={{ borderColor: palette.border }} />
            </div>
          </div>
          <div className="rounded-lg h-16 border flex items-center justify-center" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <ImageIcon size={16} style={{ color: palette.faintText }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Review Preview ───────────────────────────────────────────────

function CampaignPreview({
  palette,
  bgSecondary,
  logoUrl,
  companyName,
  fontSidebar,
}: {
  palette: ReturnType<typeof generateBrandPalette>;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
  fontSidebar?: string | null;
}) {
  return (
    <div className="h-[320px] flex flex-col" style={{ backgroundColor: palette.bg }}>
      {/* Top bar — matches ReviewTopBar layout */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b"
        style={{ backgroundColor: bgSecondary, borderColor: palette.border }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-4 max-w-[90px] object-contain" />
          ) : companyName ? (
            <span className="text-2xs font-semibold" style={{ color: palette.sidebarText, fontFamily: fontFamily(fontSidebar) }}>
              {companyName}
            </span>
          ) : null}
          <span className="text-2xs font-medium" style={{ color: palette.sidebarText }}>Website Redesign</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Comment/Browse toggle */}
          <div className="flex items-center rounded-full p-0.5" style={{ backgroundColor: palette.borderSubtle }}>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold" style={{ backgroundColor: palette.border, color: palette.sidebarText }}>
              <MessageSquare size={8} />
              Comment
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs" style={{ color: palette.mutedText }}>
              <MousePointer2 size={8} />
              Browse
            </span>
          </div>
          {/* Reviewer avatar */}
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-2xs font-semibold" style={{ backgroundColor: palette.accent }}>R</div>
        </div>
      </div>

      {/* Asset grid */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-3 gap-3 h-full">
          {['Homepage Hero', 'About Section', 'Contact Form'].map((name, i) => (
            <div
              key={name}
              className="rounded-lg border flex flex-col overflow-hidden"
              style={{ backgroundColor: palette.bgCard, borderColor: palette.border }}
            >
              {/* Thumbnail area */}
              <div className="flex-1 flex items-center justify-center relative" style={{ backgroundColor: palette.bgElevated }}>
                <ImageIcon size={20} style={{ color: palette.faintText }} />
                {i === 0 && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: palette.accent }}>
                    <Pin size={9} className="text-white" />
                  </div>
                )}
              </div>
              {/* Card footer */}
              <div className="px-2.5 py-2 border-t" style={{ borderColor: palette.borderSubtle }}>
                <div className="text-2xs font-medium truncate" style={{ color: palette.sidebarText }}>{name}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 text-2xs" style={{ color: palette.mutedText }}>
                      <MessageCircle size={9} />
                      <span>{[3, 1, 0][i]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {i === 2 ? (
                      <span className="text-2xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: palette.accentSurface, color: palette.accent }}>Review</span>
                    ) : i === 0 ? (
                      <ThumbsUp size={10} style={{ color: palette.isDark ? '#34d399' : '#059669' }} />
                    ) : (
                      <ThumbsDown size={10} style={{ color: palette.faintText }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Client Portal Preview ─────────────────────────────────────────────────

function PortalPreview({
  palette,
  bgSecondary,
  logoUrl,
  companyName,
  fontSidebar,
  fontSidebarWeight,
}: {
  palette: ReturnType<typeof generateBrandPalette>;
  bgSecondary: string;
  logoUrl: string | null;
  companyName: string;
  fontSidebar?: string | null;
  fontSidebarWeight?: string | null;
}) {
  const navItems = [
    { icon: FileText, label: 'Proposals', active: true },
  ];

  const proposals = [
    { title: 'Q3 Marketing Plan', status: 'Sent', statusColor: palette.accent },
    { title: 'Brand Refresh', status: 'Accepted', statusColor: palette.isDark ? '#34d399' : '#059669' },
    { title: 'SEO Audit Scope', status: 'Draft', statusColor: palette.faintText },
  ];

  return (
    <div className="flex h-[320px]" style={{ backgroundColor: palette.bg }}>
      {/* Sidebar */}
      <div
        className="w-[150px] shrink-0 flex flex-col border-r"
        style={{ backgroundColor: bgSecondary, borderColor: palette.border }}
      >
        <div className="px-3 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: palette.border }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-4 max-w-[110px] object-contain" />
          ) : companyName ? (
            <div className="flex items-center gap-1.5">
              <Building2 size={12} style={{ color: palette.faintText }} />
              <span className="text-2xs font-medium truncate" style={{ color: palette.sidebarText }}>{companyName}</span>
            </div>
          ) : (
            <div className="w-14 h-3 rounded" style={{ backgroundColor: palette.border }} />
          )}
        </div>
        <div className="flex-1 py-2 space-y-0.5 px-1.5" style={{ fontFamily: fontFamily(fontSidebar), fontWeight: fontSidebarWeight ? Number(fontSidebarWeight) : undefined }}>
          {navItems.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-2xs"
              style={{
                color: active ? palette.sidebarText : palette.mutedText,
                fontWeight: active ? 600 : 400,
                backgroundColor: active ? palette.accentSurface : 'transparent',
              }}
            >
              <Icon size={12} />
              {label}
            </div>
          ))}
        </div>
        <div className="px-3 py-2.5 border-t" style={{ borderColor: palette.border }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-semibold" style={{ backgroundColor: palette.accentSurface, color: palette.accent }}>
              A
            </div>
            <span className="text-2xs truncate" style={{ color: palette.mutedText }}>Acme Corp</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold" style={{ color: palette.sidebarText }}>Proposals</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-2xs" style={{ color: palette.mutedText }}>
              <BarChart3 size={10} />
              <span>3 total</span>
            </div>
            <div className="flex items-center gap-1 text-2xs" style={{ color: palette.mutedText }}>
              <Users size={10} />
              <span>2 members</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {proposals.map((p) => (
            <div
              key={p.title}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border"
              style={{ backgroundColor: palette.bgCard, borderColor: palette.borderSubtle }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: palette.accentSurface }}>
                  <FileText size={12} style={{ color: palette.accent }} />
                </div>
                <div className="min-w-0">
                  <div className="text-2xs font-medium truncate" style={{ color: palette.sidebarText }}>{p.title}</div>
                  <div className="text-2xs mt-0.5" style={{ color: palette.faintText }}>Updated 2d ago</div>
                </div>
              </div>
              <span className="text-2xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${p.statusColor}18`, color: p.statusColor }}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
        {/* Stats row */}
        <div className="flex gap-2 mt-4">
          {[
            { label: 'Active', value: '2', icon: Kanban },
            { label: 'Completed', value: '1', icon: CheckCircle2 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ backgroundColor: palette.surface, borderColor: palette.borderSubtle }}
            >
              <stat.icon size={12} style={{ color: palette.accent }} />
              <div>
                <div className="text-2xs font-semibold" style={{ color: palette.sidebarText }}>{stat.value}</div>
                <div className="text-2xs" style={{ color: palette.faintText }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
