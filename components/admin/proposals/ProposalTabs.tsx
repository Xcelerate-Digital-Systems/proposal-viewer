// components/admin/proposals/ProposalTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, DollarSign, Package, Settings, Paintbrush, FileText, Image as ImageIcon, CheckCircle2, BarChart3, PenLine } from 'lucide-react';
import { useProposalDetail } from './ProposalDetailContext';

interface ProposalTabsProps {
  proposalId: string;
}

type TabGroup = 'content' | 'setup';

const tabs: { key: string; label: string; icon: typeof Pencil; path: string; group: TabGroup }[] = [
  { key: 'cover',      label: 'Cover',    icon: ImageIcon,    path: 'cover',      group: 'content' },
  { key: 'pages',      label: 'Pages',    icon: Pencil,       path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Content',   icon: PenLine,      path: 'text-pages', group: 'content' },
  { key: 'pricing',    label: 'Quote',    icon: DollarSign,   path: 'pricing',    group: 'content' },
  { key: 'packages',   label: 'Packages', icon: Package,      path: 'packages',   group: 'content' },
  { key: 'decision',   label: 'Decision', icon: CheckCircle2, path: 'decision',   group: 'content' },

  { key: 'design',     label: 'Design',   icon: Paintbrush,   path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details',  icon: Settings,     path: 'details',    group: 'setup' },
  { key: 'analytics',  label: 'Analytics',icon: BarChart3,    path: 'analytics',  group: 'setup' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  return segments[2] ?? '';
}

function useTabCompletion(): Record<string, boolean> {
  const { proposal } = useProposalDetail();
  const pageNames = Array.isArray(proposal.page_names) ? proposal.page_names : [];
  const hasPages = pageNames.length > 0;
  const hasTextPages = pageNames.some(
    (p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text',
  );
  const hasPricing = pageNames.some(
    (p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'pricing',
  );
  const hasPackages = pageNames.some(
    (p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'packages',
  );

  return {
    cover: !!proposal.cover_enabled,
    pages: hasPages,
    'text-pages': hasTextPages,
    pricing: hasPricing,
    packages: hasPackages,
    decision: !!proposal.decision_page_enabled,
    details: !!(proposal.title && proposal.client_name),
  };
}

export default function ProposalTabs({ proposalId }: ProposalTabsProps) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPath(pathname);
  const completion = useTabCompletion();

  return (
    <div className="flex items-center gap-1 -mb-px">
      {tabs.map((tab, i) => {
        const isActive = activeKey === tab.key;
        const Icon = tab.icon;
        const showDivider = i > 0 && tabs[i - 1].group !== tab.group;
        const isConfigured = completion[tab.key];

        return (
          <div key={tab.key} className="flex items-center">
            {showDivider && <div className="w-px h-5 bg-edge mx-2" aria-hidden />}
            <Link
              href={`/proposals/${proposalId}/${tab.path}`}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
                ? 'border-teal text-teal'
                : 'border-transparent text-dim hover:text-prose hover:border-edge-hover'
                }`}
            >
              <Icon size={16} />
              {tab.label}
              {isConfigured && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal/50" />
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
