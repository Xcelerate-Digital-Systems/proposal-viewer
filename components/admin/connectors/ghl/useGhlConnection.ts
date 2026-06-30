'use client';

// components/admin/connectors/ghl/useGhlConnection.ts
//
// Custom hook encapsulating all GHL connection state, data loading, and actions.

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type {
  Connection,
  Pipeline,
  PipelineStage,
  StageMapping,
  SyncJob,
} from './ghl-types';
import { PROPOSAL_STAGES, QUOTE_STAGES } from './ghl-types';

interface UseGhlConnectionOptions {
  toast: { error: (msg: string) => void; success: (msg: string) => void };
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    destructive: boolean;
  }) => Promise<boolean>;
}

export function useGhlConnection({ toast, confirm }: UseGhlConnectionOptions) {
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
  const pipelineStages: PipelineStage[] = selectedPipeline?.stages || [];

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

  return {
    // Connection state
    token, setToken,
    locationId, setLocationId,
    connecting,
    connected,
    connection,
    showToken, setShowToken,

    // Pipeline & mapping state
    pipelines,
    selectedPipelineId, setSelectedPipelineId,
    proposalMappings, setProposalMappings,
    quoteMappings, setQuoteMappings,
    loadingPipelines,

    // Workflow & options
    workflowId, setWorkflowId,
    workflowEnabled, setWorkflowEnabled,
    syncMonetary, setSyncMonetary,
    masterEnabled, setMasterEnabled,

    // Sync activity
    recentJobs,
    showActivity, setShowActivity,
    loadActivity,

    // UI state
    saving,
    disconnecting,
    wizardStep, setWizardStep,

    // Derived
    pipelineStages,

    // Actions
    handleConnect,
    handleSave,
    handleDisconnect,
    updateMapping,
    handleStageSelect,
  };
}
