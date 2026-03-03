// components/admin/proposals/ProposalTabs.tsx
'use client';

import Link from 'next/link';
import { Pencil, DollarSign, Package, Image, Settings } from 'lucide-react';

interface ProposalTabsProps {
  proposalId: string;
  activeTab: 'pages' | 'pricing' | 'packages' | 'cover' | 'details';
}

const tabs: { key: string; label: string; icon: typeof Pencil; path: string }[] = [
  { key: 'pages',    label: 'Pages',    icon: Pencil,     path: 'pages'    },
  { key: 'pricing',  label: 'Pricing',  icon: DollarSign, path: 'pricing'  },
  { key: 'packages', label: 'Packages', icon: Package,    path: 'packages' },
  { key: 'cover',    label: 'Cover',    icon: Image,      path: 'cover'    },
  { key: 'details',  label: 'Details',  icon: Settings,   path: 'details'  },
];

export default function ProposalTabs({ proposalId, activeTab }: ProposalTabsProps) {
  return (
    <div className="flex items-center gap-1 -mb-px">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={`/proposals/${proposalId}/${tab.path}`}
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