'use client';

// components/admin/connectors/ghl/GhlStageMappingTable.tsx
//
// Table mapping AgencyViz stages to GHL pipeline stages + opp status + workflow toggle.

import type { PipelineStage, StageMapping } from './ghl-types';
import { OPP_STATUS_OPTIONS } from './ghl-types';

interface GhlStageMappingTableProps {
  stages: Array<{ key: string; label: string }>;
  entityType: 'proposal' | 'quote';
  pipelineStages: PipelineStage[];
  mappings: Record<string, StageMapping>;
  workflowEnabled: boolean;
  onStageSelect: (entityType: 'proposal' | 'quote', avStage: string, ghlStageId: string) => void;
  onStatusChange: (avStage: string, value: string) => void;
  onWorkflowToggle: (avStage: string, value: boolean) => void;
}

export function GhlStageMappingTable({
  stages,
  entityType,
  pipelineStages,
  mappings,
  workflowEnabled,
  onStageSelect,
  onStatusChange,
  onWorkflowToggle,
}: GhlStageMappingTableProps) {
  return (
    <div className="border border-edge rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface border-b border-edge">
            <th className="text-left px-3 py-2 font-medium text-faint">AgencyViz Stage</th>
            <th className="text-left px-3 py-2 font-medium text-faint">&rarr; GHL Pipeline Stage</th>
            <th className="text-left px-3 py-2 font-medium text-faint">Opp. Status</th>
            {workflowEnabled && (
              <th className="text-center px-3 py-2 font-medium text-faint w-20">Workflow</th>
            )}
          </tr>
        </thead>
        <tbody>
          {stages.map(s => {
            const m = mappings[s.key];
            return (
              <tr key={s.key} className="border-b border-edge last:border-0">
                <td className="px-3 py-2 text-ink font-medium">{s.label}</td>
                <td className="px-3 py-2">
                  <select
                    value={m?.ghl_stage_id || ''}
                    onChange={e => onStageSelect(entityType, s.key, e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-edge rounded bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-teal/30"
                  >
                    <option value="">Do nothing</option>
                    {pipelineStages.map(ps => (
                      <option key={ps.id} value={ps.id}>{ps.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={m?.ghl_opp_status || ''}
                    onChange={e => onStatusChange(s.key, e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-edge rounded bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-teal/30"
                  >
                    {OPP_STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                {workflowEnabled && (
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={m?.trigger_workflow ?? false}
                      onChange={e => onWorkflowToggle(s.key, e.target.checked)}
                      className="rounded border-edge text-teal focus:ring-teal/30"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
