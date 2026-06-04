'use client';

import { GitBranch, Columns3, LayoutGrid } from 'lucide-react';
import type { FeedbackSharedViews } from '@/lib/types/feedback';
import type { BrandPalette } from '@/lib/branding';
import { withAlpha } from '@/lib/branding';

export type PublicTab = 'board' | 'kanban' | 'items';

interface PublicTabBarProps {
  current: PublicTab;
  views: FeedbackSharedViews;
  onChange: (tab: PublicTab) => void;
  bgSecondary?: string;
  sidebarText?: string;
  palette?: BrandPalette;
}

const TABS: { key: PublicTab; label: string; Icon: typeof GitBranch }[] = [
  { key: 'board', label: 'Whiteboard', Icon: GitBranch },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'items', label: 'Items', Icon: LayoutGrid },
];

export default function PublicTabBar({
  current, views, onChange, bgSecondary, sidebarText, palette,
}: PublicTabBarProps) {
  const enabled = TABS.filter((t) => views[t.key]);
  if (enabled.length < 2) return null;

  const fg = sidebarText ?? '#1a1a1a';
  const bg = bgSecondary ?? '#ffffff';

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 shrink-0 border-b"
      style={{ backgroundColor: bg, borderBottomColor: palette?.borderSubtle ?? `${fg}15` }}
    >
      {enabled.map(({ key, label, Icon }) => {
        const active = current === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium transition-colors"
            style={{
              color: active ? fg : (palette?.mutedText ?? `${fg}88`),
              backgroundColor: active ? (palette ? withAlpha(palette.sidebarText, 0.06) : `${fg}10`) : 'transparent',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
