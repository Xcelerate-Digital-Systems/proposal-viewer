// components/admin/proposals/ProposalTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, DollarSign, Package, Settings, Paintbrush, FileText, Image as ImageIcon, CheckCircle2, BarChart3 } from 'lucide-react';

interface ProposalTabsProps {
  proposalId: string;
}

type TabGroup = 'content' | 'setup';

const tabs: { key: string; label: string; icon: typeof Pencil; path: string; group: TabGroup }[] = [
  // Content — what the viewer sees
  { key: 'cover',      label: 'Cover',    icon: ImageIcon,  path: 'cover',      group: 'content' },
  { key: 'pages',      label: 'Pages',    icon: Pencil,     path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Text',     icon: FileText,   path: 'text-pages', group: 'content' },
  { key: 'pricing',    label: 'Quote',    icon: DollarSign, path: 'pricing',    group: 'content' },
  { key: 'packages',   label: 'Packages', icon: Package,    path: 'packages',   group: 'content' },
  { key: 'decision',   label: 'Decision', icon: CheckCircle2, path: 'decision', group: 'content' },

  // Setup — how it looks / how it's configured
  { key: 'design',     label: 'Design',   icon: Paintbrush, path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details',  icon: Settings,   path: 'details',    group: 'setup' },
  { key: 'analytics',  label: 'Analytics',icon: BarChart3,  path: 'analytics',  group: 'setup' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  // /proposals/[id]/<tab>...
  const segments = pathname.split('/').filter(Boolean);
  // segments[0]='proposals', segments[1]=id, segments[2]=tab
  return segments[2] ?? '';
}

export default function ProposalTabs({ proposalId }: ProposalTabsProps) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPath(pathname);

  return (
    <div className="flex items-center gap-1 -mb-px">
      {tabs.map((tab, i) => {
        const isActive = activeKey === tab.key;
        const Icon = tab.icon;
        const showDivider = i > 0 && tabs[i - 1].group !== tab.group;

        return (
          <div key={tab.key} className="flex items-center">
            {showDivider && <div className="w-px h-5 bg-gray-200 mx-2" aria-hidden />}
            <Link
              href={`/proposals/${proposalId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
                ? 'border-teal text-teal'
                : 'border-transparent text-dim hover:text-prose hover:border-gray-300'
                }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
