// components/admin/reviews/ProjectTabs.tsx
'use client';

import Link from 'next/link';
import {
  LayoutGrid, GitBranch, MessageSquare, Settings,
} from 'lucide-react';

interface ProjectTabsProps {
  projectId: string;
  activeTab: 'items' | 'board' | 'feedback' | 'setup';
  hasWebpages?: boolean;
}

const tabs: { key: string; label: string; icon: typeof LayoutGrid; path: string; webpageOnly?: boolean }[] = [
  { key: 'items', label: 'Items', icon: LayoutGrid, path: 'items' },
  { key: 'board', label: 'Board', icon: GitBranch, path: 'board' },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare, path: 'feedback' },
  { key: 'setup', label: 'Setup', icon: Settings, path: 'setup', webpageOnly: true },
];

export default function ProjectTabs({ projectId, activeTab, hasWebpages = false }: ProjectTabsProps) {
  return (
    <div className="flex items-center gap-1 -mb-px">
      {tabs.map((tab) => {
        if (tab.webpageOnly && !hasWebpages) return null;

        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={`/reviews/${projectId}/${tab.path}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-[#017C87] text-[#017C87]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}