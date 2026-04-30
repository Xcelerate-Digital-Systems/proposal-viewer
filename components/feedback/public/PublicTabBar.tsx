'use client';

import { GitBranch, Columns3, LayoutGrid } from 'lucide-react';
import type { FeedbackSharedViews } from '@/lib/types/feedback';

export type PublicTab = 'board' | 'kanban' | 'items';

interface PublicTabBarProps {
  current: PublicTab;
  views: FeedbackSharedViews;
  onChange: (tab: PublicTab) => void;
  /** Background colour from branding (matches the board header strip). */
  bgSecondary?: string;
  /** Foreground colour for ink/text. */
  sidebarText?: string;
}

const TABS: { key: PublicTab; label: string; Icon: typeof GitBranch }[] = [
  { key: 'board', label: 'Whiteboard', Icon: GitBranch },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'items', label: 'Items', Icon: LayoutGrid },
];

/**
 * Tab strip shown to public reviewers when the project share link exposes
 * more than one view. Hidden when only a single view is enabled — the
 * public viewer falls back to the standalone layout in that case.
 */
export default function PublicTabBar({
  current, views, onChange, bgSecondary, sidebarText,
}: PublicTabBarProps) {
  const enabled = TABS.filter((t) => views[t.key]);
  if (enabled.length < 2) return null;

  const fg = sidebarText ?? '#1a1a1a';
  const bg = bgSecondary ?? '#ffffff';

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 shrink-0 border-b"
      style={{ backgroundColor: bg, borderBottomColor: `${fg}15` }}
    >
      {enabled.map(({ key, label, Icon }) => {
        const active = current === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              color: active ? fg : `${fg}88`,
              backgroundColor: active ? `${fg}10` : 'transparent',
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
