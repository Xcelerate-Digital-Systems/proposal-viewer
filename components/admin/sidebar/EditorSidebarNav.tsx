// components/admin/sidebar/EditorSidebarNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, Pencil, DollarSign, Package, Settings, Paintbrush,
  PenLine, Image as ImageIcon, CheckCircle2, BarChart3, FileText,
  CheckSquare, SlidersHorizontal, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useEditorSidebar } from './EditorSidebarContext';

type EditorType = 'proposal' | 'document' | 'template' | 'quote';
type TabGroup = 'content' | 'setup';

interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  group: TabGroup;
}

interface SidebarColors {
  bg: string;
  bgHover: string;
  border: string;
  accent: string;
  text: string;
  textMuted: string;
  textFaint: string;
  activeItemBg: string;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

const ROUTE_PREFIXES: Record<EditorType, string> = {
  proposal: 'proposals',
  document: 'documents',
  template: 'templates',
  quote: 'quotes',
};

const PROPOSAL_TABS: TabDef[] = [
  { key: 'cover',      label: 'Cover',     icon: ImageIcon,    path: 'cover',      group: 'content' },
  { key: 'pages',      label: 'Pages',     icon: Pencil,       path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Content',   icon: PenLine,      path: 'text-pages', group: 'content' },
  { key: 'pricing',    label: 'Quote',     icon: DollarSign,   path: 'pricing',    group: 'content' },
  { key: 'packages',   label: 'Packages',  icon: Package,      path: 'packages',   group: 'content' },
  { key: 'decision',   label: 'Decision',  icon: CheckCircle2, path: 'decision',   group: 'content' },
  { key: 'design',     label: 'Design',    icon: Paintbrush,   path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details',   icon: Settings,     path: 'details',    group: 'setup' },
  { key: 'analytics',  label: 'Analytics', icon: BarChart3,    path: 'analytics',  group: 'setup' },
];

const DOCUMENT_TABS: TabDef[] = [
  { key: 'pages',      label: 'Pages',   icon: Pencil,     path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Text',    icon: FileText,   path: 'text-pages', group: 'content' },
  { key: 'design',     label: 'Design',  icon: Paintbrush, path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details', icon: Settings,   path: 'details',    group: 'setup' },
];

const TEMPLATE_TABS: TabDef[] = [
  { key: 'cover',      label: 'Cover',    icon: ImageIcon,    path: 'cover',      group: 'content' },
  { key: 'pages',      label: 'Pages',    icon: Pencil,       path: 'pages',      group: 'content' },
  { key: 'text-pages', label: 'Content',  icon: PenLine,      path: 'text-pages', group: 'content' },
  { key: 'pricing',    label: 'Quote',    icon: DollarSign,   path: 'pricing',    group: 'content' },
  { key: 'packages',   label: 'Packages', icon: Package,      path: 'packages',   group: 'content' },
  { key: 'decision',   label: 'Decision', icon: CheckCircle2, path: 'decision',   group: 'content' },
  { key: 'design',     label: 'Design',   icon: Paintbrush,   path: 'design',     group: 'setup' },
  { key: 'details',    label: 'Details',  icon: Settings,     path: 'details',    group: 'setup' },
];

const QUOTE_TABS: TabDef[] = [
  { key: 'cover',    label: 'Cover',    icon: Paintbrush,        path: 'cover',    group: 'content' },
  { key: '',         label: 'Builder',  icon: PenLine,           path: '',         group: 'content' },
  { key: 'settings', label: 'Design',   icon: SlidersHorizontal, path: 'settings', group: 'setup' },
  { key: 'decision', label: 'Decision', icon: CheckSquare,       path: 'decision', group: 'setup' },
];

const EDITOR_CONFIG: Record<EditorType, { tabs: TabDef[]; backLabel: string; backHref: string; sectionLabel: string }> = {
  proposal: { tabs: PROPOSAL_TABS, backLabel: 'Proposals',  backHref: '/proposals', sectionLabel: 'Proposal' },
  document: { tabs: DOCUMENT_TABS, backLabel: 'Documents',  backHref: '/documents', sectionLabel: 'Document' },
  template: { tabs: TEMPLATE_TABS, backLabel: 'Templates',  backHref: '/templates', sectionLabel: 'Template' },
  quote:    { tabs: QUOTE_TABS,    backLabel: 'Quotes',     backHref: '/quotes',    sectionLabel: 'Quote' },
};

export function detectEditorRoute(pathname: string): { type: EditorType; id: string } | null {
  const match = pathname.match(/^\/(proposals|documents|templates|quotes)\/([^/]+)/);
  if (!match) return null;
  const [, segment, id] = match;
  if (!id || id === 'new') return null;
  const typeMap: Record<string, EditorType> = {
    proposals: 'proposal',
    documents: 'document',
    templates: 'template',
    quotes: 'quote',
  };
  return { type: typeMap[segment], id };
}

interface EditorSidebarNavProps {
  onNavigate?: () => void;
  branded?: boolean;
  colors?: SidebarColors;
}

export default function EditorSidebarNav({ onNavigate, branded, colors: c }: EditorSidebarNavProps) {
  const pathname = usePathname();
  const { state } = useEditorSidebar();
  const editor = detectEditorRoute(pathname ?? '');

  if (!editor) return null;

  const config = EDITOR_CONFIG[editor.type];
  const segments = (pathname ?? '').split('/').filter(Boolean);
  const activeKey = segments[2] ?? '';
  const prefix = ROUTE_PREFIXES[editor.type];
  const groups: TabGroup[] = ['content', 'setup'];
  const hasCompletion = Object.keys(state.completion).length > 0;

  return (
    <div className="animate-nav-fade contents">
      {/* Back button */}
      {branded && c ? (
        <Link
          href={config.backHref}
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors mb-1"
          style={{ color: c.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; }}
        >
          <ArrowLeft size={14} />
          <span>{config.backLabel}</span>
        </Link>
      ) : (
        <Link
          href={config.backHref}
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-white/50 hover:text-white hover:bg-surface-dark-hover transition-colors mb-1"
        >
          <ArrowLeft size={14} />
          <span>{config.backLabel}</span>
        </Link>
      )}

      {/* Tab groups */}
      {groups.map((group) => {
        const groupTabs = config.tabs.filter((t) => t.group === group);
        if (groupTabs.length === 0) return null;

        const sectionLabel = group === 'content' ? config.sectionLabel : 'Setup';

        return (
          <div key={group}>
            {/* Section header */}
            <div className="px-3 pt-3 pb-1.5">
              {branded && c ? (
                <span
                  className="text-2xs font-semibold uppercase tracking-wider"
                  style={{ color: hexWithAlpha(c.text, 0.3) }}
                >
                  {sectionLabel}
                </span>
              ) : (
                <span className="text-2xs font-semibold uppercase tracking-wider text-white/30">
                  {sectionLabel}
                </span>
              )}
            </div>

            {/* Tab links */}
            <div className="space-y-0.5">
              {groupTabs.map((tab) => {
                const isActive = activeKey === tab.key;
                const Icon = tab.icon;
                const href = tab.path
                  ? `/${prefix}/${editor.id}/${tab.path}`
                  : `/${prefix}/${editor.id}`;
                const isConfigured = hasCompletion && state.completion[tab.key];

                if (branded && c) {
                  return (
                    <Link
                      key={tab.key}
                      href={href}
                      onClick={onNavigate}
                      className="flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group"
                      style={{
                        color: isActive ? c.text : c.textMuted,
                        backgroundColor: isActive ? c.activeItemBg : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = c.bgHover; e.currentTarget.style.color = c.text; } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = c.textMuted; } }}
                    >
                      <Icon size={18} style={{ color: isActive ? c.accent : c.textFaint }} />
                      <span className="flex-1">{tab.label}</span>
                      {isConfigured && !isActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: hexWithAlpha(c.accent, 0.5) }}
                        />
                      )}
                      {isActive && <ChevronRight size={14} style={{ color: hexWithAlpha(c.accent, 0.5) }} />}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={tab.key}
                    href={href}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors group ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:text-white hover:bg-surface-dark-hover'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? 'text-surface-dark-accent' : 'text-white/40 group-hover:text-white/60'}
                    />
                    <span className="flex-1">{tab.label}</span>
                    {isConfigured && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-surface-dark-accent/50" />
                    )}
                    {isActive && <ChevronRight size={14} className="text-surface-dark-accent/50" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
