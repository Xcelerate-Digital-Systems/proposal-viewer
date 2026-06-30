'use client';

import { Cloud, CloudOff } from 'lucide-react';

export default function SyncStatusPill({ status }: { status: 'idle' | 'saving' | 'error' }) {
  if (status === 'idle') return null;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-medium border shadow-sm ${
      status === 'saving'
        ? 'bg-white border-edge text-muted'
        : 'bg-red-50 border-red-200 text-red-600'
    }`}>
      {status === 'saving' ? (
        <>
          <Cloud size={12} className="animate-pulse" />
          <span>Saving...</span>
        </>
      ) : (
        <>
          <CloudOff size={12} />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}
