// components/admin/connectors/ghl/ghl-types.ts
//
// Types and constants for the GoHighLevel connector.

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface StageMapping {
  entity_type: 'proposal' | 'quote';
  agencyviz_stage: string;
  ghl_stage_id: string | null;
  ghl_stage_name: string | null;
  ghl_opp_status: string | null;
  trigger_workflow: boolean;
}

export interface Connection {
  id: string;
  pipeline_id: string;
  pipeline_name: string | null;
  workflow_id: string | null;
  workflow_enabled: boolean;
  sync_monetary_value: boolean;
  enabled: boolean;
  token_valid: boolean;
  location_id: string;
}

export interface SyncJob {
  id: string;
  entity_type: string;
  to_stage: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export const PROPOSAL_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'revision_requested', label: 'Revision Requested' },
];

export const QUOTE_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

export const OPP_STATUS_OPTIONS = [
  { value: '', label: 'No status change' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'abandoned', label: 'Abandoned' },
];

export const WIZARD_LABELS = ['Pipeline', 'Proposals', 'Quotes', 'Automation'];
