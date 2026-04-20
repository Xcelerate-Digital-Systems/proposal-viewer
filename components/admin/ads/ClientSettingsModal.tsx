// components/admin/ads/ClientSettingsModal.tsx
'use client';

import { useState } from 'react';
import { Shield, Users, X } from 'lucide-react';
import StandardsTab from './StandardsTab';
import AudienceTab from './AudienceTab';
import type { TrackerStandards } from '@/lib/types/ads';

type Tab = 'standards' | 'audience';

type Props = {
  trackerId: string;
  companyId: string;
  clientName: string;
  trackerStandards: TrackerStandards;
  onSaveTrackerStandards: (standards: TrackerStandards) => Promise<void>;
  onClose: () => void;
};

export default function ClientSettingsModal({
  trackerId,
  companyId,
  clientName,
  trackerStandards,
  onSaveTrackerStandards,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('standards');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-0 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink">Client settings</h2>
            <p className="text-xs text-faint mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {/* Tab strip */}
        <div className="px-6 mt-4 border-b border-edge shrink-0">
          <div className="flex gap-1">
            <TabButton
              active={tab === 'standards'}
              onClick={() => setTab('standards')}
              icon={<Shield size={14} />}
              label="Standards"
            />
            <TabButton
              active={tab === 'audience'}
              onClick={() => setTab('audience')}
              icon={<Users size={14} />}
              label="Audience"
            />
          </div>
        </div>

        {/* Body — the embedded tab components own their own save state */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'standards' ? (
            <StandardsTab
              trackerId={trackerId}
              companyId={companyId}
              trackerStandards={trackerStandards}
              onSaveTracker={onSaveTrackerStandards}
            />
          ) : (
            <AudienceTab
              trackerStandards={trackerStandards}
              onSaveTrackerStandards={onSaveTrackerStandards}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? 'border-teal text-ink'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
