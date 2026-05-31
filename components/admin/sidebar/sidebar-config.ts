// components/admin/sidebar/sidebar-config.ts
// Navigation structure definitions and helpers.

import {
  LayoutDashboard, MessageSquareText, FileText, Files, LayoutTemplate,
  Palette, Settings as SettingsIcon, Bookmark, Plug, ReceiptText,
  Workflow, LifeBuoy,
  type LucideIcon,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SectionDef {
  key: string;
  label: string;
  icon: LucideIcon;
  defaultHref: string;
  matchPaths: string[];
  items: NavItem[];
}

/* ─── Section definitions ────────────────────────────────────────────────── */

export const ALL_SECTIONS: SectionDef[] = [
  {
    key: 'pitch',
    label: 'Pitch',
    icon: FileText,
    defaultHref: '/proposals',
    matchPaths: ['/proposals', '/quotes', '/documents', '/templates', '/template-preview'],
    items: [
      { href: '/proposals', label: 'Proposal Builder', icon: FileText },
      { href: '/quotes',    label: 'Quote Builder',    icon: ReceiptText },
      { href: '/documents', label: 'Doc Builder',      icon: Files },
      { href: '/templates', label: 'Template Library', icon: LayoutTemplate },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: MessageSquareText,
    defaultHref: '/campaigns',
    matchPaths: ['/campaigns'],
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: MessageSquareText },
    ],
  },
  {
    key: 'funnels',
    label: 'Funnel Planner',
    icon: Workflow,
    defaultHref: '/funnels',
    matchPaths: ['/funnels'],
    items: [
      { href: '/funnels', label: 'Funnel Planner', icon: Workflow },
    ],
  },
  {
    key: 'swipe',
    label: 'Swipe Vault',
    icon: Bookmark,
    defaultHref: '/ads/swipe',
    matchPaths: ['/ads/swipe'],
    items: [
      { href: '/ads/swipe', label: 'Swipe Vault', icon: Bookmark },
    ],
  },
];

/** Workspace-level top-nav entries that aren't sections (no sub-nav, no
 *  children). Rendered alongside the section entries in renderTopLevelNav. */
export const WORKSPACE_ITEMS: NavItem[] = [
  { href: '/integrations/looker-studio', label: 'Looker Studio', icon: Plug },
];

export const STANDALONE_ITEMS: NavItem[] = [
  { href: '/company',  label: 'Brand Kit', icon: Palette },
  { href: '/support',  label: 'Support',   icon: LifeBuoy },
  { href: '/settings', label: 'Settings',  icon: SettingsIcon },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function getActiveSection(pathname: string, sections: SectionDef[]): SectionDef | null {
  for (const section of sections) {
    for (const matchPath of section.matchPaths) {
      if (matchPath === '/') {
        if (pathname === '/') return section;
      } else {
        if (pathname.startsWith(matchPath)) return section;
      }
    }
  }
  return null;
}

// Re-export LayoutDashboard for the Dashboard link in the sidebar
export { LayoutDashboard };
