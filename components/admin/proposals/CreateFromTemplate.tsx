// components/admin/proposals/CreateFromTemplate.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-fetch';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';

interface CreateFromTemplateProps {
  companyId: string;
  onBack: () => void;
  onSuccess: () => void;
  /** When set, only templates of this type are shown and the created proposal inherits the type. */
  entityType?: 'proposal' | 'quote';
}

export default function CreateFromTemplate({
  companyId,
  onBack,
  onSuccess,
  entityType,
}: CreateFromTemplateProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');

  type StepState = { label: string; status: 'pending' | 'active' | 'done' };
  const [steps, setSteps] = useState<StepState[]>([]);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeProgress, setActiveProgress] = useState(0);

  const clearStepTimer = useCallback(() => {
    if (stepTimerRef.current) { clearInterval(stepTimerRef.current); stepTimerRef.current = null; }
  }, []);

  const startStepTimer = useCallback(() => {
    clearStepTimer();
    setActiveProgress(0);
    let p = 0;
    stepTimerRef.current = setInterval(() => {
      p = Math.min(p + (100 - p) * 0.04, 95);
      setActiveProgress(p);
    }, 200);
  }, [clearStepTimer]);

  const markStepActive = useCallback((idx: number, label: string) => {
    setSteps(prev => prev.map((s, i) =>
      i === idx ? { ...s, label, status: 'active' } : i < idx ? { ...s, status: 'done' } : s
    ));
    startStepTimer();
  }, [startStepTimer]);

  const markStepDone = useCallback((idx: number) => {
    clearStepTimer();
    setActiveProgress(100);
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done' } : s));
  }, [clearStepTimer]);

  // Form
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [crmIdentifier, setCrmIdentifier] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let q = supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (entityType) {
      q = q.eq('entity_type', entityType);
    }
    q.then(({ data }) => {
      setTemplates(data || []);
      setLoading(false);
    });
  }, [companyId, entityType]);

  const selectTemplate = async (t: ProposalTemplate) => {
    setSelectedTemplate(t);

    const { data } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', t.id)
      .eq('enabled', true)
      .order('position', { ascending: true });

    setPages(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !title.trim() || !clientName.trim()) return;

    if (pages.length === 0) {
      setStatus('Template has no enabled pages — please add pages to the template first.');
      return;
    }

    const pdfPages = pages.filter((p) => p.type === 'pdf');
    const hasNonPdfPages = pages.some((p) => p.type !== 'pdf');
    const hasPdf = pdfPages.length > 0;

    const stepDefs: StepState[] = [];
    if (hasPdf) stepDefs.push({ label: `Merging ${pdfPages.length} PDF page${pdfPages.length !== 1 ? 's' : ''}`, status: 'pending' });
    stepDefs.push({ label: 'Setting up pitch', status: 'pending' });
    stepDefs.push({ label: 'Creating pitch', status: 'pending' });
    if (hasNonPdfPages) stepDefs.push({ label: 'Copying template content', status: 'pending' });

    setSteps(stepDefs);
    setActiveProgress(0);
    setCreating(true);

    let si = 0;

    try {
      // ── 0. Ensure merged PDF is current ─────────────────────────────
      let freshFilePath: string | null = null;
      if (hasPdf) {
        markStepActive(si, stepDefs[si].label);
        const rebuildRes = await authedFetch('/api/templates/rebuild-merged', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ template_id: selectedTemplate.id }),
        });
        if (!rebuildRes.ok) {
          setStatus('Failed to prepare template. Please try again.');
          clearStepTimer();
          setCreating(false);
          return;
        }
        const rebuildData = await rebuildRes.json();
        freshFilePath = rebuildData.file_path || null;
        markStepDone(si);
        si++;
      }

      // ── 1. Get creator name ─────────────────────────────────────────
      markStepActive(si, stepDefs[si].label);
      const { data: sessionData } = await supabase.auth.getSession();
      let creatorName: string | null = null;
      if (sessionData?.session?.user?.id) {
        const { data: member } = await supabase
          .from('team_members')
          .select('name')
          .eq('user_id', sessionData.session.user.id)
          .single();
        creatorName = member?.name || null;
      }

      // ── 2. Build page_names from template pages + section headers ───

      const pageNames: Array<{
        name: string;
        indent: number;
        type?: 'group';
        link_url?: string;
        link_label?: string;
      }> = pdfPages.map((p) => ({
        name: p.title ?? `Page ${p.position + 1}`,
        indent: p.indent ?? 0,
        ...(p.link_url   ? { link_url:   p.link_url   } : {}),
        ...(p.link_label ? { link_label: p.link_label } : {}),
      }));

      // Interleave section header groups from the template.
      // section_headers: { id, name, position } — position is 0-based relative
      // to PDF pages (0 = before first, N = after Nth, -1 = end).
      const rawHeaders = selectedTemplate.section_headers;
      if (Array.isArray(rawHeaders) && rawHeaders.length > 0) {
        for (const header of rawHeaders as Array<{ id?: string; name: string; position?: number }>) {
          const groupEntry = { name: header.name || 'Section', indent: 0, type: 'group' as const };
          const pos = header.position ?? -1;

          if (pos === -1) {
            pageNames.push(groupEntry);
          } else {
            let pdfCount = 0;
            let insertAt = pageNames.length;
            for (let i = 0; i < pageNames.length; i++) {
              if (pageNames[i].type !== 'group') {
                if (pdfCount >= pos) { insertAt = i; break; }
                pdfCount++;
              }
              insertAt = i + 1;
            }
            pageNames.splice(insertAt, 0, groupEntry);
          }
        }
      }

      // ── 3. Create proposal + split pages ───────────────────────────
      markStepDone(si);
      si++;
      markStepActive(si, stepDefs[si].label);

      // Quote templates carry quote-only fields (scope, GST, attachments, …)
      // in an `extra` JSONB blob. Hydrate them on top of the create-proposal
      // payload so the new quote starts as a complete copy of the snapshot.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateExtra: Record<string, unknown> =
        selectedTemplate.entity_type === 'quote' && (selectedTemplate as any).extra && typeof (selectedTemplate as any).extra === 'object'
          ? ((selectedTemplate as any).extra as Record<string, unknown>)
          : {};

      const res = await authedFetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           title.trim(),
          client_name:     clientName.trim(),
          client_email:    clientEmail.trim()    || null,
          crm_identifier:  crmIdentifier.trim()  || null,
          description:     description.trim()    || null,
          file_path:       freshFilePath,
          file_size_bytes: freshFilePath ? ((selectedTemplate as any).file_size_bytes ?? 0) : 0,
          page_names:      pageNames,
          skip_default_pages: hasNonPdfPages,
          ...templateExtra,
          company_id:      companyId,
          created_by_name: creatorName,
          entity_type:     selectedTemplate.entity_type,
          // ── Cover / design fields copied from template ──────────────
          prepared_by:                    selectedTemplate.prepared_by || creatorName,
          prepared_by_member_id:          selectedTemplate.prepared_by_member_id || null,
          cover_subtitle:                 selectedTemplate.cover_subtitle || null,
          cover_image_path:               selectedTemplate.cover_image_path || null,
          cover_button_text:              selectedTemplate.cover_button_text || null,
          cover_enabled:                  selectedTemplate.cover_enabled ?? true,
          cover_bg_style:                 selectedTemplate.cover_bg_style || null,
          cover_bg_color_1:               selectedTemplate.cover_bg_color_1 || null,
          cover_bg_color_2:               selectedTemplate.cover_bg_color_2 || null,
          cover_gradient_type:            selectedTemplate.cover_gradient_type || null,
          cover_gradient_angle:           selectedTemplate.cover_gradient_angle ?? null,
          cover_gradient_position_x:      selectedTemplate.cover_gradient_position_x ?? null,
          cover_gradient_position_y:      selectedTemplate.cover_gradient_position_y ?? null,
          cover_gradient_stops:           selectedTemplate.cover_gradient_stops ?? null,
          cover_overlay_opacity:          selectedTemplate.cover_overlay_opacity ?? null,
          cover_text_color:               selectedTemplate.cover_text_color || null,
          cover_subtitle_color:           selectedTemplate.cover_subtitle_color || null,
          cover_button_bg:                selectedTemplate.cover_button_bg || null,
          cover_button_text_color:        selectedTemplate.cover_button_text_color || null,
          cover_show_date:                selectedTemplate.cover_show_date ?? false,
          cover_date:                     selectedTemplate.cover_date || null,
          cover_show_prepared_by:         selectedTemplate.cover_show_prepared_by ?? true,
          cover_show_client_logo:         selectedTemplate.cover_show_client_logo ?? false,
          cover_show_avatar:              selectedTemplate.cover_show_avatar ?? false,
          cover_client_logo_path:         selectedTemplate.cover_client_logo_path || null,
          cover_client_logo_tint_color:   selectedTemplate.cover_client_logo_tint_color ?? null,
          cover_avatar_path:              selectedTemplate.cover_avatar_path || null,
          bg_image_path:                  selectedTemplate.bg_image_path || null,
          bg_image_overlay_opacity:       selectedTemplate.bg_image_overlay_opacity ?? null,
          bg_image_blur:                  selectedTemplate.bg_image_blur ?? null,
          page_orientation:               selectedTemplate.page_orientation || 'auto',
          text_page_bg_color:             selectedTemplate.text_page_bg_color || null,
          text_page_text_color:           selectedTemplate.text_page_text_color || null,
          text_page_heading_color:        selectedTemplate.text_page_heading_color || null,
          text_page_font_size:            selectedTemplate.text_page_font_size || null,
          text_page_border_enabled:       selectedTemplate.text_page_border_enabled ?? null,
          text_page_border_color:         selectedTemplate.text_page_border_color || null,
          text_page_border_radius:        selectedTemplate.text_page_border_radius || null,
          text_page_layout:               selectedTemplate.text_page_layout || null,
          toc_settings:                   selectedTemplate.toc_settings || null,
          title_font_family:              selectedTemplate.title_font_family || null,
          title_font_weight:              selectedTemplate.title_font_weight || null,
          title_font_size:                selectedTemplate.title_font_size || null,
          title_font_transform:           selectedTemplate.title_font_transform || null,
          font_heading_family:            selectedTemplate.font_heading_family || null,
          font_heading_weight:            selectedTemplate.font_heading_weight || null,
          font_heading_size:              selectedTemplate.font_heading_size || null,
          font_heading_transform:         selectedTemplate.font_heading_transform || null,
          font_body_family:               selectedTemplate.font_body_family || null,
          font_body_weight:               selectedTemplate.font_body_weight || null,
          font_body_transform:            selectedTemplate.font_body_transform || null,
          page_num_circle_color:          selectedTemplate.page_num_circle_color || null,
          page_num_text_color:            selectedTemplate.page_num_text_color || null,
          post_accept_action:             selectedTemplate.post_accept_action || null,
          post_accept_redirect_url:       selectedTemplate.post_accept_redirect_url || null,
          post_accept_message:            selectedTemplate.post_accept_message || null,
          package_styling:                selectedTemplate.package_styling ?? null,
          quote_page_bg_color:            (selectedTemplate as { quote_page_bg_color?: string | null }).quote_page_bg_color ?? null,
          quote_header_bg_style:          (selectedTemplate as { quote_header_bg_style?: string | null }).quote_header_bg_style ?? null,
          quote_header_bg_color_1:        selectedTemplate.quote_header_bg_color_1 ?? null,
          quote_header_bg_color_2:        selectedTemplate.quote_header_bg_color_2 ?? null,
          quote_header_gradient_type:     (selectedTemplate as { quote_header_gradient_type?: string | null }).quote_header_gradient_type ?? null,
          quote_header_gradient_angle:    (selectedTemplate as { quote_header_gradient_angle?: number | null }).quote_header_gradient_angle ?? null,
          quote_header_gradient_position_x: (selectedTemplate as { quote_header_gradient_position_x?: number | null }).quote_header_gradient_position_x ?? null,
          quote_header_gradient_position_y: (selectedTemplate as { quote_header_gradient_position_y?: number | null }).quote_header_gradient_position_y ?? null,
          quote_header_text_color:        selectedTemplate.quote_header_text_color ?? null,
          quote_header_subtitle_color:    selectedTemplate.quote_header_subtitle_color ?? null,
          decision_page_enabled:          selectedTemplate.decision_page_enabled ?? null,
          decision_page_title:            selectedTemplate.decision_page_title ?? null,
          decision_extras:                selectedTemplate.decision_extras ?? null,
          decision_action_bg_color:       selectedTemplate.decision_action_bg_color ?? null,
          decision_action_text_color:     selectedTemplate.decision_action_text_color ?? null,
          decision_action_heading_color:  selectedTemplate.decision_action_heading_color ?? null,
          decision_action_accent_color:   selectedTemplate.decision_action_accent_color ?? null,
          decision_decline_button_color:  selectedTemplate.decision_decline_button_color ?? null,
          decision_revision_button_color: selectedTemplate.decision_revision_button_color ?? null,
          decision_checkbox_color:        selectedTemplate.decision_checkbox_color ?? null,
          pricing_header_text_color:      selectedTemplate.pricing_header_text_color ?? null,
          pricing_text_color:             selectedTemplate.pricing_text_color ?? null,
          pricing_price_title_color:      selectedTemplate.pricing_price_title_color ?? null,
          pricing_price_color:            selectedTemplate.pricing_price_color ?? null,
          pricing_payment_schedule_name_color: selectedTemplate.pricing_payment_schedule_name_color ?? null,
          pricing_payment_schedule_price_color: selectedTemplate.pricing_payment_schedule_price_color ?? null,
          pricing_accent_bar_color:       selectedTemplate.pricing_accent_bar_color ?? null,
          pricing_dot_color:              selectedTemplate.pricing_dot_color ?? null,
          font_button_family:             selectedTemplate.font_button_family ?? null,
          font_button_weight:             selectedTemplate.font_button_weight ?? null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create proposal (${res.status})`);
      }

      const newProposal = await res.json();

      markStepDone(si);

      // ── 4. Copy template data (pricing, text pages, packages) ───────
      if (hasNonPdfPages) {
        si++;
        markStepActive(si, stepDefs[si].label);
        try {
          const copyRes = await authedFetch('/api/templates/copy-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template_id: selectedTemplate.id,
              proposal_id: newProposal.proposal_id,
              company_id:  companyId,
            }),
          });
          if (!copyRes.ok) {
            console.error('Copy template data failed:', await copyRes.text());
          }
        } catch (err) {
          console.error('Copy template data warning (non-fatal):', err);
        }
        markStepDone(si);
      }

      clearStepTimer();
      setSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
      setActiveProgress(100);

      const dest = selectedTemplate.entity_type === 'quote'
        ? `/quotes/${newProposal.proposal_id}`
        : `/proposals/${newProposal.proposal_id}/pages`;
      onSuccess();
      setTimeout(() => router.push(dest), 300);
    } catch (err: any) {
      console.error('Create from template failed:', err);
      const msg = err?.message || 'Unknown error';
      setStatus(`Failed: ${msg}`);
      clearStepTimer();
      setCreating(false);
    }
  };

  // ── Template selection view ──────────────────────────────────────
  if (!selectedTemplate) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={ArrowLeft}
          onClick={onBack}
          className="mb-4"
        >
          Back
        </Button>
        <h3 className="text-ink font-semibold mb-4">Choose a Template</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-faint text-center py-8">
            No templates yet. Create a template first.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="w-full text-left px-4 py-3 rounded-2xl border border-edge-strong hover:border-teal/40 hover:bg-teal/5 transition-all"
              >
                <div className="text-sm font-medium text-ink">{t.name}</div>
                {t.description && (
                  <div className="text-xs text-faint mt-0.5">{t.description}</div>
                )}
                <div className="text-xs text-gray-300 mt-0.5">
                  {(t as any).page_count ?? pages.length} pages
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Proposal creation form ───────────────────────────────────────
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={ArrowLeft}
        onClick={() => { setSelectedTemplate(null); setPages([]); }}
        className="mb-4"
      >
        Back to templates
      </Button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
          <Check size={13} className="text-teal" />
        </div>
        <div>
          <div className="text-sm font-medium text-ink">{selectedTemplate.name}</div>
          <div className="text-xs text-faint">{pages.length} page{pages.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-3">
        <FormField
          config={{ key: 'title', label: 'Pitch Title', required: true, placeholder: 'e.g. Website Redesign for Acme Co.' }}
          value={title}
          onChange={(v) => setTitle(v)}
        />
        <FormField
          config={{ key: 'client_name', label: 'Client Name', required: true, placeholder: 'e.g. Acme Co.' }}
          value={clientName}
          onChange={(v) => setClientName(v)}
        />
        <div>
          <label htmlFor="client_email" className="block text-sm font-medium text-prose mb-1">
            Client Email <span className="text-faint font-normal">(optional)</span>
          </label>
          <ContactAutocomplete
            value={clientEmail}
            onChange={setClientEmail}
            onSelect={(c) => {
              setClientEmail(c.email);
              if (c.name && !clientName) setClientName(c.name);
            }}
            placeholder="client@example.com"
            className="w-full px-3 py-2.5 rounded-lg border border-edge-strong bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/40 placeholder:text-faint"
          />
        </div>
        <FormField
          config={{ key: 'crm_identifier', label: 'CRM Identifier', placeholder: 'Optional deal ID or reference', optional: true }}
          value={crmIdentifier}
          onChange={(v) => setCrmIdentifier(v)}
        />
        <FormField
          config={{ key: 'description', label: 'Description', type: 'textarea', placeholder: 'Internal notes (not shown to client)', optional: true }}
          value={description}
          onChange={(v) => setDescription(v)}
        />

        {creating && steps.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                  {s.status === 'done' ? (
                    <CheckCircle2 size={16} className="text-teal" />
                  ) : s.status === 'active' ? (
                    <Loader2 size={16} className="text-teal animate-spin" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${s.status === 'pending' ? 'text-faint' : s.status === 'done' ? 'text-teal' : 'text-ink'}`}>
                      {s.label}
                    </span>
                    {s.status === 'active' && (
                      <span className="text-[10px] text-faint tabular-nums">{Math.round(activeProgress)}%</span>
                    )}
                    {s.status === 'done' && (
                      <span className="text-[10px] text-teal">Done</span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${
                        s.status === 'done' ? 'bg-teal' : s.status === 'active' ? 'bg-teal' : 'bg-gray-100'
                      }`}
                      style={{ width: s.status === 'done' ? '100%' : s.status === 'active' ? `${activeProgress}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status.startsWith('Failed') && (
          <p className="text-xs text-red-500">{status}</p>
        )}

        <Button
          type="submit"
          size="md"
          fullWidth
          loading={creating}
          disabled={!title.trim() || !clientName.trim()}
        >
          {entityType === 'quote' ? 'Create Quote' : 'Create Pitch'}
        </Button>
      </form>
    </div>
  );
}