// components/admin/connectors/GhlConnectorCard.tsx
//
// GoHighLevel integration configuration card for Settings > Integrations tab.
// Wizard flow: Pipeline → Proposal Mapping → Quote Mapping → Automation & Save.

'use client';

import { Check, Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PROPOSAL_STAGES, QUOTE_STAGES } from './ghl/ghl-types';
import { useGhlConnection } from './ghl/useGhlConnection';
import { GhlConnectionForm } from './ghl/GhlConnectionForm';
import { GhlWizardSteps } from './ghl/GhlWizardSteps';
import { GhlStageMappingTable } from './ghl/GhlStageMappingTable';
import { GhlSyncActivity } from './ghl/GhlSyncActivity';
import { GhlAutomationStep } from './ghl/GhlAutomationStep';

export default function GhlConnectorCard() {
  const toast = useToast();
  const confirm = useConfirm();

  const ghl = useGhlConnection({ toast, confirm });

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
              <h2 className="text-base font-semibold text-ink">GoHighLevel — CRM Sync</h2>
              {ghl.connected && (
                <span className={`inline-flex items-center px-2 py-0.5 text-detail font-medium rounded-full ${
                  ghl.connection?.token_valid
                    ? 'bg-teal-tint text-teal'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {ghl.connection?.token_valid ? 'Connected' : 'Token invalid'}
                </span>
              )}
            </div>
            <p className="text-xs text-faint mt-1 leading-relaxed max-w-[58ch]">
              Sub-account pipeline sync for proposals and quotes. Stage changes push to GHL as opportunity updates.
            </p>
          </div>
        </div>
        {ghl.connected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={ghl.handleDisconnect}
            loading={ghl.disconnecting}
            leftIcon={Trash2}
            className="text-faint hover:text-red-600 shrink-0"
          >
            Disconnect
          </Button>
        )}
      </header>

      <div className="px-6 py-5 space-y-6">
        {/* ── Connection Section ─────────────────────────────────────── */}
        {!ghl.connected && (
          <GhlConnectionForm
            token={ghl.token}
            setToken={ghl.setToken}
            locationId={ghl.locationId}
            setLocationId={ghl.setLocationId}
            showToken={ghl.showToken}
            setShowToken={ghl.setShowToken}
            connecting={ghl.connecting}
            onConnect={ghl.handleConnect}
          />
        )}

        {/* ── Wizard (connected state) ──────────────────────────────── */}
        {ghl.connected && (
          <>
            <GhlWizardSteps current={ghl.wizardStep} onStepClick={ghl.setWizardStep} />

            {/* Step 1: Pipeline */}
            {ghl.wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Select a pipeline</h4>
                  <p className="text-xs text-faint mb-3">
                    Choose which GHL pipeline to sync with AgencyViz proposal and quote stages.
                  </p>
                  {ghl.loadingPipelines ? (
                    <div className="flex items-center gap-2 text-sm text-faint">
                      <Loader2 size={14} className="animate-spin" /> Loading pipelines…
                    </div>
                  ) : ghl.pipelines.length === 0 ? (
                    <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted leading-relaxed">
                      No pipelines found. Create a pipeline in GoHighLevel first, then return here.
                    </div>
                  ) : (
                    <select
                      value={ghl.selectedPipelineId}
                      onChange={e => {
                        ghl.setSelectedPipelineId(e.target.value);
                        ghl.setProposalMappings({});
                        ghl.setQuoteMappings({});
                      }}
                      className="w-full px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    >
                      <option value="">Select a pipeline…</option>
                      {ghl.pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Proposal stage mapping */}
            {ghl.wizardStep === 2 && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Proposal stage mapping</h4>
                  <p className="text-xs text-faint mb-3">
                    When a proposal changes stage in AgencyViz, move the GHL opportunity to the mapped stage.
                  </p>
                </div>
                {ghl.selectedPipelineId && ghl.pipelineStages.length > 0 ? (
                  <GhlStageMappingTable
                    stages={PROPOSAL_STAGES}
                    entityType="proposal"
                    pipelineStages={ghl.pipelineStages}
                    mappings={ghl.proposalMappings}
                    workflowEnabled={ghl.workflowEnabled}
                    onStageSelect={ghl.handleStageSelect}
                    onStatusChange={(stage, val) => ghl.updateMapping('proposal', stage, 'ghl_opp_status', val || null)}
                    onWorkflowToggle={(stage, val) => ghl.updateMapping('proposal', stage, 'trigger_workflow', val)}
                  />
                ) : (
                  <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted">
                    Select a pipeline in Step 1 first.
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Quote stage mapping */}
            {ghl.wizardStep === 3 && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink mb-1">Quote stage mapping</h4>
                  <p className="text-xs text-faint mb-3">
                    When a quote changes stage in AgencyViz, move the GHL opportunity to the mapped stage.
                  </p>
                </div>
                {ghl.selectedPipelineId && ghl.pipelineStages.length > 0 ? (
                  <GhlStageMappingTable
                    stages={QUOTE_STAGES}
                    entityType="quote"
                    pipelineStages={ghl.pipelineStages}
                    mappings={ghl.quoteMappings}
                    workflowEnabled={ghl.workflowEnabled}
                    onStageSelect={ghl.handleStageSelect}
                    onStatusChange={(stage, val) => ghl.updateMapping('quote', stage, 'ghl_opp_status', val || null)}
                    onWorkflowToggle={(stage, val) => ghl.updateMapping('quote', stage, 'trigger_workflow', val)}
                  />
                ) : (
                  <div className="px-4 py-3 bg-surface rounded-lg text-xs text-muted">
                    Select a pipeline in Step 1 first.
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Automation & save */}
            {ghl.wizardStep === 4 && (
              <GhlAutomationStep
                masterEnabled={ghl.masterEnabled}
                setMasterEnabled={ghl.setMasterEnabled}
                workflowEnabled={ghl.workflowEnabled}
                setWorkflowEnabled={ghl.setWorkflowEnabled}
                workflowId={ghl.workflowId}
                setWorkflowId={ghl.setWorkflowId}
                syncMonetary={ghl.syncMonetary}
                setSyncMonetary={ghl.setSyncMonetary}
              />
            )}

            {/* Wizard navigation */}
            <div className="flex items-center justify-between pt-2">
              {ghl.wizardStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => ghl.setWizardStep(s => s - 1)}>
                  Back
                </Button>
              ) : <div />}
              {ghl.wizardStep < 4 ? (
                <Button
                  size="sm"
                  onClick={() => ghl.setWizardStep(s => s + 1)}
                  disabled={ghl.wizardStep === 1 && !ghl.selectedPipelineId}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={ghl.handleSave} loading={ghl.saving} leftIcon={Check}>
                  Save Settings
                </Button>
              )}
            </div>

            <hr className="border-edge" />

            {/* Sync activity (outside wizard) */}
            <GhlSyncActivity
              recentJobs={ghl.recentJobs}
              showActivity={ghl.showActivity}
              onToggle={() => {
                ghl.setShowActivity(!ghl.showActivity);
                if (!ghl.showActivity) ghl.loadActivity();
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
