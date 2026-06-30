'use client';

// components/admin/connectors/ghl/GhlSyncActivity.tsx
//
// Collapsible recent sync activity list with status dots.

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SyncJob } from './ghl-types';

interface GhlSyncActivityProps {
  recentJobs: SyncJob[];
  showActivity: boolean;
  onToggle: () => void;
}

export function GhlSyncActivity({ recentJobs, showActivity, onToggle }: GhlSyncActivityProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-muted hover:text-ink transition-colors"
      >
        {showActivity ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Recent sync activity
      </button>
      {showActivity && (
        <div className="mt-3 space-y-2">
          {recentJobs.length === 0 ? (
            <p className="text-xs text-faint">No sync activity yet</p>
          ) : (
            recentJobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface text-xs"
              >
                <div className="flex items-center gap-2">
                  <StatusDot status={job.status} />
                  <span className="text-faint">&middot;</span>
                  <span className="text-ink capitalize">{job.entity_type}</span>
                  <span className="text-faint">&rarr;</span>
                  <span className="text-ink font-medium">{job.to_stage}</span>
                </div>
                <div className="flex items-center gap-3">
                  {job.last_error && (
                    <span className="text-red-500 truncate max-w-[200px]" title={job.last_error}>
                      {job.last_error}
                    </span>
                  )}
                  <span className="text-faint">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    completed: { color: 'bg-teal', label: 'Completed' },
    failed: { color: 'bg-amber-500', label: 'Failed' },
    dead: { color: 'bg-red-500', label: 'Dead' },
    processing: { color: 'bg-blue-500', label: 'Processing' },
  };
  const { color, label } = config[status] || { color: 'bg-muted', label: status };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color} inline-block shrink-0`} />
      <span className="text-muted capitalize">{label}</span>
    </span>
  );
}
