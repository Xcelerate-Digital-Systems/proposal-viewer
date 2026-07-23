'use client';

import Link from 'next/link';
import {
  LayoutGrid, GitBranch, MessageSquare, Settings, Columns3, Users, Network,
} from 'lucide-react';
import type { ProjectType } from '@/lib/types/feedback';

interface ProjectTabsProps {
  projectId: string;
  activeTab: 'assets' | 'board' | 'kanban' | 'comments' | 'setup' | 'settings' | 'sitemap' | 'review';
  hasWebpages?: boolean;
  projectType?: ProjectType;
}

type TabDef = {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  path: string;
  webpageOnly?: boolean;
  types?: ProjectType[];
};

const tabs: TabDef[] = [
  { key: 'kanban', label: 'Kanban', icon: Columns3, path: 'kanban', types: ['campaign'] },
  { key: 'board', label: 'Board', icon: GitBranch, path: 'board', types: ['campaign'] },
  { key: 'sitemap', label: 'Sitemap', icon: Network, path: 'sitemap', types: ['website'] },
  { key: 'assets', label: 'Assets', icon: LayoutGrid, path: 'assets', types: ['campaign', 'website'] },
  { key: 'comments', label: 'Comments', icon: MessageSquare, path: 'comments', types: ['campaign', 'website'] },
  { key: 'setup', label: 'Setup', icon: Settings, path: 'setup', types: ['campaign', 'website'] },
  { key: 'settings', label: 'Members', icon: Users, path: 'settings', types: ['campaign', 'website'] },
];

export default function ProjectTabs({ projectId, activeTab, hasWebpages = false, projectType = 'campaign' }: ProjectTabsProps) {
  return (
    <div className="flex items-center gap-1 -mb-px border-b border-edge">
      {tabs.map((tab) => {
        if (tab.webpageOnly && !hasWebpages) return null;
        if (tab.types && !tab.types.includes(projectType)) return null;

        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        const label = tab.key === 'assets' && projectType === 'website' ? 'Pages' : tab.label;

        return (
          <Link
            key={tab.key}
            href={`/campaigns/${projectId}/${tab.path}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-caption font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-teal text-teal'
                : 'border-transparent text-faint hover:text-ink hover:border-edge-strong'
            }`}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
