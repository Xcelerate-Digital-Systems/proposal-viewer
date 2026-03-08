// components/admin/documents/DocumentTabs.tsx
'use client';

import Link from 'next/link';
import { Pencil, Image, Settings, Paintbrush, List, FileText } from 'lucide-react';

interface DocumentTabsProps {
  documentId: string;
  activeTab: 'pages' | 'text-pages' | 'contents' | 'cover' | 'design' | 'details';
}

const tabs: { key: string; label: string; icon: typeof Pencil; path: string }[] = [
  { key: 'pages',      label: 'Pages',      icon: Pencil,     path: 'pages'      },
  { key: 'contents',   label: 'Table Of Contents',   icon: List,       path: 'contents'   },
  { key: 'design',     label: 'Design',     icon: Paintbrush, path: 'design'     },
  { key: 'cover',      label: 'Cover',      icon: Image,      path: 'cover'      },
  { key: 'text-pages', label: 'Text Pages', icon: FileText,   path: 'text-pages' },
  { key: 'details',    label: 'Details',    icon: Settings,   path: 'details'    },
];

export default function DocumentTabs({ documentId, activeTab }: DocumentTabsProps) {
  return (
    <div className="flex items-center gap-1 -mb-px">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={`/documents/${documentId}/${tab.path}`}
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