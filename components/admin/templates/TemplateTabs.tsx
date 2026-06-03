// components/admin/templates/TemplateTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, DollarSign, Package, Settings, Paintbrush, FileText, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface TemplateTabsProps {
  templateId: string;
}

type TabGroup = 'content' | 'setup';

const tabs: { key: string; label: string; icon: typeof Pencil; path: string; group: TabGroup }[] = [
  // Content
  { key: 'cover',      label: 'Cover',    icon: ImageIcon,  path: 'cover',      group: 'content' },
  { key: 'pages',      label: 'Pages',    icon: Pencil,     path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Text',     icon: FileText,   path: 'text-pages', group: 'content' },
  { key: 'pricing',    label: 'Quote',    icon: DollarSign, path: 'pricing',    group: 'content' },
  { key: 'packages',   label: 'Packages', icon: Package,    path: 'packages',   group: 'content' },
  { key: 'decision',   label: 'Decision', icon: CheckCircle2, path: 'decision', group: 'content' },

  // Setup
  { key: 'design',     label: 'Design',   icon: Paintbrush, path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details',  icon: Settings,   path: 'details',    group: 'setup' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  return segments[2] ?? '';
}

export default function TemplateTabs({ templateId }: TemplateTabsProps) {
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
            {showDivider && <div className="w-px h-5 bg-edge mx-2" aria-hidden />}
            <Link
              href={`/templates/${templateId}/${tab.path}`}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive
                  ? 'border-teal text-teal'
                  : 'border-transparent text-dim hover:text-prose hover:border-edge-hover'
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
