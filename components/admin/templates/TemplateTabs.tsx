// components/admin/templates/TemplateTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, DollarSign, Package, Settings, Paintbrush, FileText, PenLine, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { useTemplateDetail } from './TemplateDetailContext';

interface TemplateTabsProps {
  templateId: string;
  entityType?: 'proposal' | 'quote';
}

type TabGroup = 'content' | 'setup';

const tabs: { key: string; label: string; icon: typeof Pencil; path: string; group: TabGroup; hint?: string }[] = [
  { key: 'cover',      label: 'Cover',    icon: ImageIcon,    path: 'cover',      group: 'content', hint: 'Cover page layout and content' },
  { key: 'pages',      label: 'Pages',    icon: Pencil,       path: 'pages',      group: 'content', hint: 'Add, remove, and reorder pages' },
  { key: 'text-pages', label: 'Content',  icon: PenLine,      path: 'text-pages', group: 'content', hint: 'Write and edit text page content' },
  { key: 'pricing',    label: 'Quote',    icon: DollarSign,   path: 'pricing',    group: 'content', hint: 'Line items and pricing' },
  { key: 'packages',   label: 'Packages', icon: Package,      path: 'packages',   group: 'content', hint: 'Tiered pricing packages for clients to choose from' },
  { key: 'decision',   label: 'Decision', icon: CheckCircle2, path: 'decision',   group: 'content', hint: 'Accept, decline, and revision form shown to clients' },

  { key: 'design',     label: 'Design',   icon: Paintbrush,   path: 'design',     group: 'setup', hint: 'Fonts, colours, and page styling' },
  { key: 'details',    label: 'Details',  icon: Settings,     path: 'details',    group: 'setup', hint: 'Template name, description, and post-acceptance settings' },
];

function activeKeyFromPath(pathname: string | null): string {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  return segments[2] ?? '';
}

function hasPageType(entries: unknown[], type: string): boolean {
  return entries.some(
    (p) => typeof p === 'object' && p !== null && (p as { type?: string }).type === type,
  );
}

function useTabCompletion(): Record<string, boolean> {
  const { template } = useTemplateDetail();
  const headers = Array.isArray(template.section_headers) ? template.section_headers : [];
  const hasPages = template.page_count > 0;
  const hasTextPages = hasPageType(headers, 'text');
  const hasPricing = hasPageType(headers, 'pricing');
  const hasPackages = hasPageType(headers, 'packages');

  return {
    cover: !!template.cover_enabled,
    pages: hasPages,
    'text-pages': hasTextPages,
    pricing: hasPricing,
    packages: hasPackages,
    decision: !!template.decision_page_enabled,
    details: !!template.name,
  };
}

export default function TemplateTabs({ templateId, entityType }: TemplateTabsProps) {
  const pathname = usePathname();
  const activeKey = activeKeyFromPath(pathname);
  const completion = useTabCompletion();

  const visibleTabs = entityType === 'proposal'
    ? tabs.filter((t) => t.key !== 'pricing' && t.key !== 'packages')
    : tabs;

  return (
    <div className="flex items-center gap-1 -mb-px">
      {visibleTabs.map((tab, i) => {
        const isActive = activeKey === tab.key;
        const Icon = tab.icon;
        const showDivider = i > 0 && visibleTabs[i - 1].group !== tab.group;
        const isConfigured = completion[tab.key];

        return (
          <div key={tab.key} className="flex items-center">
            {showDivider && <div className="w-px h-5 bg-edge mx-2" aria-hidden />}
            <Link
              href={`/templates/${templateId}/${tab.path}`}
              title={tab.hint}
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
