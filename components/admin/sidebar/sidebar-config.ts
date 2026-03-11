// components/admin/sidebar/sidebar-config.ts
// Navigation structure definitions and helpers.

import {
  LayoutDashboard, MessageSquareText, FileText, Files, LayoutTemplate,
  Palette, Bell, Users,
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
    matchPaths: ['/proposals', '/documents', '/templates', '/template-preview'],
    items: [
      { href: '/proposals', label: 'Proposals', icon: FileText },
      { href: '/documents', label: 'Documents', icon: Files },
      { href: '/templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    key: 'reviews',
    label: 'Creative Review',
    icon: MessageSquareText,
    defaultHref: '/reviews',
    matchPaths: ['/reviews'],
    items: [
      { href: '/reviews', label: 'Projects', icon: MessageSquareText },
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
