// GoHighLevel API response types.

export interface GhlContact {
  id: string;
  locationId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: string | string[] | number | boolean | null }>;
  dateAdded?: string;
  dateUpdated?: string;
}

export interface GhlContactUpsertResponse {
  contact: GhlContact;
  new?: boolean;
}

export interface GhlPipelineStage {
  id: string;
  name: string;
  position: number;
  showInFunnel?: boolean;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
  locationId: string;
}

export interface GhlPipelinesResponse {
  pipelines: GhlPipeline[];
}

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  contactId: string;
  locationId: string;
  monetaryValue?: number;
  source?: string;
  assignedTo?: string;
  dateAdded?: string;
  dateUpdated?: string;
  customFields?: GhlCustomFieldValue[];
}

export interface GhlCustomFieldValue {
  id: string;
  fieldValue: string | string[] | number | boolean | null;
}

export interface GhlCustomFieldDefinition {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  model?: string;
}

export interface GhlOpportunityResponse {
  opportunity: GhlOpportunity;
}

// ── Invoice / Estimate types (v3 API) ──────────────────────────────────

export interface GhlInvoiceItem {
  _id: string;
  name: string;
  description?: string;
  currency: string;
  amount: number;
  qty: number;
  taxInclusive?: boolean;
  type?: 'one_time' | 'recurring';
}

export interface GhlInvoice {
  _id: string;
  altId: string;
  name: string;
  status: 'draft' | 'sent' | 'payment_processing' | 'paid' | 'void' | 'partially_paid';
  currency: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  invoiceNumber: number;
  invoiceNumberPrefix?: string;
  issueDate: string;
  dueDate: string;
  liveMode: boolean;
  contactDetails: {
    id: string;
    name: string;
    email: string;
    phoneNo?: string;
    companyName?: string;
  };
  invoiceItems: GhlInvoiceItem[];
  title?: string;
  createdAt: string;
  updatedAt: string;
  totalSummary?: { subTotal: number; discount: number; tax: number };
  discount?: { value: number; type: 'percentage' | 'fixed' };
}

export interface GhlEstimate {
  _id: string;
  altId: string;
  name: string;
  status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced' | 'viewed';
  currency: string;
  total: number;
  estimateNumber?: number;
  estimateNumberPrefix?: string;
  issueDate: string;
  expiryDate?: string;
  liveMode: boolean;
  contactDetails: {
    id: string;
    name: string;
    email: string;
    phoneNo?: string;
    companyName?: string;
  };
  items: GhlInvoiceItem[];
  title?: string;
  createdAt: string;
  updatedAt: string;
  discount?: { value: number; type: 'percentage' | 'fixed' };
}

export interface GhlApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// DB row types

export interface GhlConnection {
  id: string;
  company_id: string;
  api_token_encrypted: string;
  location_id: string;
  location_name: string | null;
  pipeline_id: string;
  pipeline_name: string | null;
  workflow_id: string | null;
  workflow_enabled: boolean;
  sync_monetary_value: boolean;
  enabled: boolean;
  token_valid: boolean;
  created_at: string;
  updated_at: string;
}

export interface GhlStageMapping {
  id: string;
  company_id: string;
  connection_id: string;
  entity_type: 'proposal' | 'quote';
  agencyviz_stage: string;
  ghl_stage_id: string | null;
  ghl_stage_name: string | null;
  ghl_opp_status: 'open' | 'won' | 'lost' | 'abandoned' | null;
  trigger_workflow: boolean;
  created_at: string;
  updated_at: string;
}

export interface GhlSyncJob {
  id: string;
  company_id: string;
  entity_type: 'proposal' | 'quote';
  entity_id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string;
  payload: GhlSyncPayload | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GhlSyncPayload {
  client_email: string;
  client_name: string;
  client_phone?: string;
  client_organisation?: string;
  entity_title: string;
  monetary_value?: number;
  client_id?: string;
}

export type AgencyVizProposalStage =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'revision_requested';

export type AgencyVizQuoteStage =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined';
