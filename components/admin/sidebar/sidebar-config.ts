// components/admin/sidebar/sidebar-config.ts
// Navigation structure definitions and helpers.

import {
  LayoutDashboard, MessageSquareText, FileText, Files, LayoutTemplate,
  Palette, Bell, Users, Megaphone, Bookmark, Plug, BarChart3, ReceiptText,
  Workflow,
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
    key: 'proposals',
    label: 'Proposals',
    icon: FileText,
    defaultHref: '/proposals',
    matchPaths: ['/proposals', '/quotes', '/documents', '/templates', '/template-preview'],
    items: [
      { href: '/proposals', label: 'Proposals', icon: FileText },
      { href: '/quotes',    label: 'Quotes',    icon: ReceiptText },
      { href: '/documents', label: 'Documents', icon: Files },
      { href: '/templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    key: 'feedback',
    label: 'Feedback',
    icon: MessageSquareText,
    defaultHref: '/feedback',
    matchPaths: ['/feedback'],
    items: [
      { href: '/feedback', label: 'Projects', icon: MessageSquareText },
    ],
  },
  {
    key: 'funnels',
    label: 'Funnels',
    icon: Workflow,
    defaultHref: '/funnels',
    matchPaths: ['/funnels'],
    items: [
      { href: '/funnels', label: 'Funnels', icon: Workflow },
    ],
  },
  {
    key: 'swipe',
    label: 'Swipe File',
    icon: Bookmark,
    defaultHref: '/ads/swipe',
    matchPaths: ['/ads/swipe'],
    items: [
      { href: '/ads/swipe', label: 'Swipe File', icon: Bookmark },
    ],
  },
  {
    key: 'ads',
    label: 'Ad Tracker',
    icon: Megaphone,
    defaultHref: '/ads',
    matchPaths: ['/ads'],
    items: [
      { href: '/ads', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrations',
    icon: Plug,
    defaultHref: '/integrations/looker-studio',
    matchPaths: ['/integrations'],
    items: [
      { href: '/integrations/looker-studio', label: 'Looker Studio', icon: BarChart3 },
    ],
  },
];

export const STANDALONE_ITEMS: NavItem[] = [
  { href: '/company', label: 'Branding', icon: Palette },
  { href: '/settings', label: 'Settings', icon: Bell },
  { href: '/team', label: 'Team', icon: Users },
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
