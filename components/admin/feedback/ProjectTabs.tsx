'use client';

import Link from 'next/link';
import {
  LayoutGrid, GitBranch, MessageSquare, Settings, Columns3, Bell,
} from 'lucide-react';

interface ProjectTabsProps {
  projectId: string;
  activeTab: 'items' | 'board' | 'kanban' | 'comments' | 'setup' | 'settings';
  hasWebpages?: boolean;
}

const tabs: { key: string; label: string; icon: typeof LayoutGrid; path: string; webpageOnly?: boolean }[] = [
  { key: 'kanban', label: 'Kanban', icon: Columns3, path: 'kanban' },
  { key: 'board', label: 'Board', icon: GitBranch, path: 'board' },
  { key: 'items', label: 'Items', icon: LayoutGrid, path: 'items' },
  { key: 'comments', label: 'Comments', icon: MessageSquare, path: 'comments' },
  { key: 'setup', label: 'Setup', icon: Settings, path: 'setup' },
  { key: 'settings', label: 'Members', icon: Bell, path: 'settings' },
];

export default function ProjectTabs({ projectId, activeTab, hasWebpages = false }: ProjectTabsProps) {
  return (
    <div className="flex items-center gap-1 -mb-px border-b border-gray-100">
      {tabs.map((tab) => {
        if (tab.webpageOnly && !hasWebpages) return null;

        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={`/markup/${projectId}/${tab.path}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-teal text-teal'
                : 'border-transparent text-gray-400 hover:text-ink hover:border-gray-200'
            }`}
          >
            <Icon size={15} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}