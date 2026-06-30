'use client';

// components/admin/connectors/ghl/GhlAutomationStep.tsx
//
// Wizard step 4: sync toggle, workflow trigger, monetary value sync.

import { ToggleLeft, ToggleRight, Workflow } from 'lucide-react';

interface GhlAutomationStepProps {
  masterEnabled: boolean;
  setMasterEnabled: (v: boolean) => void;
  workflowEnabled: boolean;
  setWorkflowEnabled: (v: boolean) => void;
  workflowId: string;
  setWorkflowId: (v: string) => void;
  syncMonetary: boolean;
  setSyncMonetary: (v: boolean) => void;
}

export function GhlAutomationStep({
  masterEnabled,
  setMasterEnabled,
  workflowEnabled,
  setWorkflowEnabled,
  workflowId,
  setWorkflowId,
  syncMonetary,
  setSyncMonetary,
}: GhlAutomationStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-ink mb-3">Automation settings</h4>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Sync enabled</p>
          <p className="text-xs text-faint">When enabled, stage changes push to GHL automatically</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={masterEnabled}
          aria-label="Toggle sync"
          onClick={() => setMasterEnabled(!masterEnabled)}
          className="text-2xl transition-colors"
        >
          {masterEnabled
            ? <ToggleRight size={28} className="text-teal" />
            : <ToggleLeft size={28} className="text-faint" />}
        </button>
      </div>

      <hr className="border-edge" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow size={16} className="text-faint" />
            <div>
              <p className="text-sm font-medium text-ink">Workflow trigger</p>
              <p className="text-xs text-faint">Add contact to a GHL workflow on mapped stage changes</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={workflowEnabled}
            aria-label="Toggle workflow trigger"
            onClick={() => setWorkflowEnabled(!workflowEnabled)}
            className="text-2xl transition-colors"
          >
            {workflowEnabled
              ? <ToggleRight size={28} className="text-teal" />
              : <ToggleLeft size={28} className="text-faint" />}
          </button>
        </div>
        {workflowEnabled && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Workflow ID</label>
            <input
              type="text"
              value={workflowId}
              onChange={e => setWorkflowId(e.target.value)}
              placeholder="GHL Workflow ID"
              className="w-full px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-ink placeholder:text-faint/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
            <p className="text-detail text-faint mt-1">
              Find in GHL &rarr; Automation &rarr; Workflows &rarr; click workflow &rarr; copy ID from URL
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Sync monetary value</p>
          <p className="text-xs text-faint">Push quote totals as opportunity value in GHL</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={syncMonetary}
          aria-label="Toggle monetary sync"
          onClick={() => setSyncMonetary(!syncMonetary)}
          className="text-2xl transition-colors"
        >
          {syncMonetary
            ? <ToggleRight size={28} className="text-teal" />
            : <ToggleLeft size={28} className="text-faint" />}
        </button>
      </div>
    </div>
  );
}
