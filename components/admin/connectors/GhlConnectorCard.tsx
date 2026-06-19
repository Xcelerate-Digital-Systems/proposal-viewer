// components/admin/connectors/GhlConnectorCard.tsx
//
// GoHighLevel integration configuration card for Settings > Integrations tab.
// Wizard flow: Pipeline → Proposal Mapping → Quote Mapping → Automation & Save.

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Eye, EyeOff,
  Loader2, Plug, ToggleLeft, ToggleRight,
  Trash2, Workflow,
} from 'lucide-react';
import Image from 'next/image';
import { authFetch } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

// ── Types ───────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface StageMapping {
  entity_type: 'proposal' | 'quote';
  agencyviz_stage: string;
  ghl_stage_id: string | null;
  ghl_stage_name: string | null;
  ghl_opp_status: string | null;
  trigger_workflow: boolean;
}

interface Connection {
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

interface SyncJob {
  id: string;
  entity_type: string;
  to_stage: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const PROPOSAL_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'revision_requested', label: 'Revision Requested' },
];

const QUOTE_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

const OPP_STATUS_OPTIONS = [
  { value: '', label: 'No status change' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'abandoned', label: 'Abandoned' },
];

const WIZARD_LABELS = ['Pipeline', 'Proposals', 'Quotes', 'Automation'];

// ── Component ───────────────────────────────────────────────────────────

export default function GhlConnectorCard() {
  const toast = useToast();
  const confirm = useConfirm();

  // Connection state
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Pipeline & mapping state
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [proposalMappings, setProposalMappings] = useState<Record<string, StageMapping>>({});
  const [quoteMappings, setQuoteMappings] = useState<Record<string, StageMapping>>({});
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  // Workflow & options
  const [workflowId, setWorkflowId] = useState('');
  const [workflowEnabled, setWorkflowEnabled] = useState(false);
  const [syncMonetary, setSyncMonetary] = useState(true);
  const [masterEnabled, setMasterEnabled] = useState(false);

  // Sync activity
  const [recentJobs, setRecentJobs] = useState<SyncJob[]>([]);
  const [showActivity, setShowActivity] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // ── Load existing configuration ──────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings/ghl/mappings');
      if (!res.ok) return;
      const { data } = await res.json();
      if (data.connection) {
        setConnection(data.connection);
        setConnected(true);
        setSelectedPipelineId(data.connection.pipeline_id);
        setWorkflowId(data.connection.workflow_id || '');
        setWorkflowEnabled(data.connection.workflow_enabled);
        setSyncMonetary(data.connection.sync_monetary_value);
        setMasterEnabled(data.connection.enabled);
        setLocationId(data.connection.location_id);

        const pm: Record<string, StageMapping> = {};
        const qm: Record<string, StageMapping> = {};
        (data.mappings || []).forEach((m: StageMapping) => {
          if (m.entity_type === 'proposal') pm[m.agencyviz_stage] = m;
          else qm[m.agencyviz_stage] = m;
        });
        setProposalMappings(pm);
        setQuoteMappings(qm);
      }
    } catch {
      // Silent — settings page load shouldn't break
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Load pipelines ───────────────────────────────────────────────────

  const loadPipelines = useCallback(async () => {
    setLoadingPipelines(true);
    try {
      const res = await authFetch('/api/settings/ghl/pipelines');
      if (!res.ok) return;
      const { data } = await res.json();
      setPipelines(data.pipelines || []);
    } catch {
      // Silent
    } finally {
      setLoadingPipelines(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadPipelines();
  }, [connected, loadPipelines]);

  // ── Load sync activity ───────────────────────────────────────────────

  const loadActivity = useCallback(async () => {
    try {
      const res = await authFetch('/api/settings/ghl/status');
      if (!res.ok) return;
      const { data } = await res.json();
      setRecentJobs(data.recentJobs || []);
    } catch {
      // Silent
    }
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!token.trim() || !locationId.trim()) {
      toast.error('Enter both API token and Location ID');
      return;
    }
    setConnecting(true);
    try {
      const res = await authFetch('/api/settings/ghl/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_token: token.trim(), location_id: locationId.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || 'Connection failed');
        return;
      }
      setConnected(true);
      setConnection(body.data.connection);
      setPipelines(body.data.pipelines || []);
      if (body.data.pipelines?.length) {
        setSelectedPipelineId(body.data.pipelines[0].id);
      }
      setToken('');
      toast.success('Connected to GoHighLevel');
    } catch {
      toast.error('Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  // ── Save mappings ────────────────────────────────────────────────────

  const handleSave = async () => {
    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
    if (!selectedPipeline) {
      toast.error('Select a pipeline first');
      return;
    }

    const allMappings: StageMapping[] = [];

    PROPOSAL_STAGES.forEach(s => {
      const existing = proposalMappings[s.key];
      allMappings.push({
        entity_type: 'proposal',
        agencyviz_stage: s.key,
        ghl_stage_id: existing?.ghl_stage_id || null,
        ghl_stage_name: existing?.ghl_stage_name || null,
        ghl_opp_status: existing?.ghl_opp_status || null,
        trigger_workflow: existing?.trigger_workflow ?? false,
      });
    });

    QUOTE_STAGES.forEach(s => {
      const existing = quoteMappings[s.key];
      allMappings.push({
        entity_type: 'quote',
        agencyviz_stage: s.key,
        ghl_stage_id: existing?.ghl_stage_id || null,
        ghl_stage_name: existing?.ghl_stage_name || null,
        ghl_opp_status: existing?.ghl_opp_status || null,
        trigger_workflow: existing?.trigger_workflow ?? false,
      });
    });

    setSaving(true);
    try {
      const res = await authFetch('/api/settings/ghl/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: selectedPipelineId,
          pipeline_name: selectedPipeline.name,
          mappings: allMappings,
          workflow_id: workflowId || null,
          workflow_enabled: workflowEnabled,
          sync_monetary_value: syncMonetary,
          enabled: masterEnabled,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error || 'Failed to save');
        return;
      }
      toast.success('GHL settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    const confirmed = await confirm({
      title: 'Disconnect GoHighLevel?',
      message: 'This will stop all sync activity. Existing GHL opportunity references on proposals/quotes will be preserved.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await authFetch('/api/settings/ghl/disconnect', { method: 'DELETE' });
      setConnected(false);
      setConnection(null);
      setPipelines([]);
      setProposalMappings({});
      setQuoteMappings({});
      setMasterEnabled(false);
      setWizardStep(1);
      toast.success('GoHighLevel disconnected');
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Mapping helpers ──────────────────────────────────────────────────

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const pipelineStages = selectedPipeline?.stages || [];

  const updateMapping = (
    entityType: 'proposal' | 'quote',
    stage: string,
    field: keyof StageMapping,
    value: string | boolean | null,
  ) => {
    const setter = entityType === 'proposal' ? setProposalMappings : setQuoteMappings;
    setter(prev => {
      const existing = prev[stage] || {
        entity_type: entityType,
        agencyviz_stage: stage,
        ghl_stage_id: null,
        ghl_stage_name: null,
        ghl_opp_status: null,
        trigger_workflow: false,
      };
      return { ...prev, [stage]: { ...existing, [field]: value } };
    });
  };

  const handleStageSelect = (
    entityType: 'proposal' | 'quote',
    avStage: string,
    ghlStageId: string,
  ) => {
    const ghlStage = pipelineStages.find(s => s.id === ghlStageId);
    updateMapping(entityType, avStage, 'ghl_stage_id', ghlStageId || null);
    updateMapping(entityType, avStage, 'ghl_stage_name', ghlStage?.name || null);
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-edge">
        <div className="flex items-start gap-3 min-w-0">
          <Image
            src="/integrations/go-high-level-icon.svg"
            alt="GoHighLevel"
            width={40}
            height={40}
            className="rounded-2xl shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-ink">GoHighLevel</h2>
              {connected && (
                <span className={`inline-flex items-center px-2 py-0.5 text-detail font-medium rounded-full ${
                  connection?.token_valid
                    ? 'bg-teal-tint text-teal'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {connection?.token_valid ? 'Connected' : 'Token invalid'}
                </span>
              )}
            </div>
            <p className="text-xs text-faint mt-1 leading-relaxed max-w-[58ch]">
              Two-way pipeline sync for proposals and quotes. Stage changes push to GHL as opportunity updates.
            </p>
          </div>
        </div>
        {connected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            loading={disconnecting}
            leftIcon={Trash2}
            className="text-faint hover:text-red-600 shrink-0"
          >
            Disconnect
          </Button>
        )}
      </header>

      <div className="px-6 py-5 space-y-6">
        {/* ── Connection Section ─────────────────────────────────────── */}
        {!connected && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-faint">
                Connect your GoHighLevel account using a Private Integration token.
              </p>
              <div className="bg-surface border border-edge rounded-lg px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-medium text-muted">Setup steps:</p>
                <ol className="text-detail text-faint list-decimal list-inside space-y-0.5">
                  <li>In GHL, go to <span className="text-ink font-medium">Settings → Private Integrations → Create</span></li>
                  <li>
                    Add these scopes:
                    <span className="inline-flex flex-wrap gap-1 ml-1">
                      {['Locations (Read)', 'Opportunities (Read/Write)', 'Contacts (Read/Write)'].map(s => (
                        <span key={s} className="px-1.5 py-0.5 bg-surface border border-edge rounded text-2xs text-muted font-medium">{s}</span>
                      ))}
                    </span>
                  </li>
                  <li>Copy the <span className="text-ink font-medium">API Token</span> and paste it below</li>
                </ol>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">API Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 pr-10 text-sm border border-edge rounded-lg bg-surface text-ink placeholder:text-faint/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Location ID</label>
              <input
                type="text"
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                placeholder="GHL Location / Sub-Account ID"
                className="w-full px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-ink placeholder:text-faint/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              />
              <p className="text-detail text-faint mt-1">
                Found in GHL → Settings → Business Profile → look for the Location ID (starts with a long string of characters)
              </p>
            </div>

            <Button
              onClick={handleConnect}
              loading={connecting}
              leftIcon={Plug}
            >
              Connect
            </Button>
          </div>
        )}

        {/* ── Wizard (connected state) ──────────────────────────────── */}
        {connected && (
          <>
            <WizardSteps current={wizardStep} onStepClick={setWizardStep} />

            {/* Step 1: Pipeline */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Select a pipeline</h4>
                  <p className="text-xs text-faint mb-3">
                    Choose which GHL pipeline to sync with AgencyViz proposal and quote stages.
                  </p>
                  {loadingPipelines ? (
                    <div className="flex items-center gap-2 text-sm text-faint">
                      <Loader2 size={14} className="animate-spin" /> Loading pipelines…
                    </div>
                  ) : pipelines.length === 0 ? (
                    <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted leading-relaxed">
                      No pipelines found. Create a pipeline in GoHighLevel first, then return here.
                    </div>
                  ) : (
                    <select
                      value={selectedPipelineId}
                      onChange={e => {
                        setSelectedPipelineId(e.target.value);
                        setProposalMappings({});
                        setQuoteMappings({});
                      }}
                      className="w-full px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    >
                      <option value="">Select a pipeline…</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Proposal stage mapping */}
            {wizardStep === 2 && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Proposal stage mapping</h4>
                  <p className="text-xs text-faint mb-3">
                    When a proposal changes stage in AgencyViz, move the GHL opportunity to the mapped stage.
                  </p>
                </div>
                {selectedPipelineId && pipelineStages.length > 0 ? (
                  <StageMappingTable
                    stages={PROPOSAL_STAGES}
                    entityType="proposal"
                    pipelineStages={pipelineStages}
                    mappings={proposalMappings}
                    workflowEnabled={workflowEnabled}
                    onStageSelect={handleStageSelect}
                    onStatusChange={(stage, val) => updateMapping('proposal', stage, 'ghl_opp_status', val || null)}
                    onWorkflowToggle={(stage, val) => updateMapping('proposal', stage, 'trigger_workflow', val)}
                  />
                ) : (
                  <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted">
                    Select a pipeline in Step 1 first.
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Quote stage mapping */}
            {wizardStep === 3 && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Quote stage mapping</h4>
                  <p className="text-xs text-faint mb-3">
                    When a quote changes stage in AgencyViz, move the GHL opportunity to the mapped stage.
                  </p>
                </div>
                {selectedPipelineId && pipelineStages.length > 0 ? (
                  <StageMappingTable
                    stages={QUOTE_STAGES}
                    entityType="quote"
                    pipelineStages={pipelineStages}
                    mappings={quoteMappings}
                    workflowEnabled={workflowEnabled}
                    onStageSelect={handleStageSelect}
                    onStatusChange={(stage, val) => updateMapping('quote', stage, 'ghl_opp_status', val || null)}
                    onWorkflowToggle={(stage, val) => updateMapping('quote', stage, 'trigger_workflow', val)}
                  />
                ) : (
                  <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted">
                    Select a pipeline in Step 1 first.
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Automation & save */}
            {wizardStep === 4 && (
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
                        Find in GHL → Automation → Workflows → click workflow → copy ID from URL
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
            )}

            {/* Wizard navigation */}
            <div className="flex items-center justify-between pt-2">
              {wizardStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setWizardStep(s => s - 1)}>
                  Back
                </Button>
              ) : <div />}
              {wizardStep < 4 ? (
                <Button
                  size="sm"
                  onClick={() => setWizardStep(s => s + 1)}
                  disabled={wizardStep === 1 && !selectedPipelineId}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleSave} loading={saving} leftIcon={Check}>
                  Save Settings
                </Button>
              )}
            </div>

            <hr className="border-edge" />

            {/* Sync activity (outside wizard) */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowActivity(!showActivity);
                  if (!showActivity) loadActivity();
                }}
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
                          <span className="text-faint">·</span>
                          <span className="text-ink capitalize">{job.entity_type}</span>
                          <span className="text-faint">→</span>
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
          </>
        )}
      </div>
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function WizardSteps({ current, onStepClick }: { current: number; onStepClick: (step: number) => void }) {
  return (
    <nav aria-label="Setup progress" className="flex items-center gap-1">
      {WIZARD_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={() => onStepClick(step)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${
                active
                  ? 'bg-teal-tint text-teal'
                  : done
                    ? 'text-teal hover:bg-teal-tint/50'
                    : 'text-faint hover:text-muted'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold shrink-0 ${
                done
                  ? 'bg-teal text-white'
                  : active
                    ? 'bg-teal text-white'
                    : 'bg-surface text-faint'
              }`}>
                {done ? <Check size={10} /> : step}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < WIZARD_LABELS.length - 1 && (
              <div className={`w-4 h-px shrink-0 ${done ? 'bg-teal/40' : 'bg-edge'}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function StageMappingTable({
  stages,
  entityType,
  pipelineStages,
  mappings,
  workflowEnabled,
  onStageSelect,
  onStatusChange,
  onWorkflowToggle,
}: {
  stages: Array<{ key: string; label: string }>;
  entityType: 'proposal' | 'quote';
  pipelineStages: PipelineStage[];
  mappings: Record<string, StageMapping>;
  workflowEnabled: boolean;
  onStageSelect: (entityType: 'proposal' | 'quote', avStage: string, ghlStageId: string) => void;
  onStatusChange: (avStage: string, value: string) => void;
  onWorkflowToggle: (avStage: string, value: boolean) => void;
}) {
  return (
    <div className="border border-edge rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface border-b border-edge">
            <th className="text-left px-3 py-2 font-medium text-faint">AgencyViz Stage</th>
            <th className="text-left px-3 py-2 font-medium text-faint">→ GHL Pipeline Stage</th>
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
