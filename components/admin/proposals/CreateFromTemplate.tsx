// components/admin/proposals/CreateFromTemplate.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase, ProposalTemplate } from '@/lib/supabase';
import { FormField } from '@/components/ui/FormField';

interface CreateFromTemplateProps {
  companyId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function CreateFromTemplate({ companyId, onBack, onSuccess }: CreateFromTemplateProps) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [crmIdentifier, setCrmIdentifier] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    supabase
      .from('proposal_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates(data || []);
        setLoading(false);
      });
  }, [companyId]);

  const selectTemplate = async (t: ProposalTemplate) => {
    setSelectedTemplate(t);

    // _v2 uses position + title (not page_number + label)
    const { data } = await supabase
      .from('template_pages_v2')
      .select('*')
      .eq('template_id', t.id)
      .eq('type', 'pdf')
      .order('position', { ascending: true });

    setPages(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !title.trim() || !clientName.trim()) return;

    if (!selectedTemplate.file_path) {
      setStatus('Template has no pages — please add pages to the template first.');
      return;
    }

    setCreating(true);

    try {
      // ── 1. Get creator name ─────────────────────────────────────────
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
      // _v2 pages use `title` and `indent` (not `label`).
      // Non-pdf rows (text, pricing, packages, section, toc) are handled
      // separately by copy-data, so we only map pdf rows here.
      setStatus('Preparing pages...');

      const pageNames: Array<{
        name: string;
        indent: number;
        type?: 'group';
        link_url?: string;
        link_label?: string;
      }> = pages.map((p) => ({
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
      setStatus('Creating proposal...');

      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           title.trim(),
          client_name:     clientName.trim(),
          client_email:    clientEmail.trim()    || null,
          crm_identifier:  crmIdentifier.trim()  || null,
          description:     description.trim()    || null,
          file_path:       selectedTemplate.file_path,
          file_size_bytes: (selectedTemplate as any).file_size_bytes ?? 0,
          page_names:      pageNames,
          company_id:      companyId,
          created_by_name: creatorName,
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
          cover_avatar_path:              selectedTemplate.cover_avatar_path || null,
          bg_image_path:                  selectedTemplate.bg_image_path || null,
          bg_image_overlay_opacity:       selectedTemplate.bg_image_overlay_opacity ?? null,
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
          page_num_circle_color:          selectedTemplate.page_num_circle_color || null,
          page_num_text_color:            selectedTemplate.page_num_text_color || null,
          post_accept_action:             selectedTemplate.post_accept_action || null,
          post_accept_redirect_url:       selectedTemplate.post_accept_redirect_url || null,
          post_accept_message:            selectedTemplate.post_accept_message || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create proposal (${res.status})`);
      }

      const newProposal = await res.json();

      // ── 4. Copy template data (pricing, text pages, packages) ───────
      setStatus('Copying template data...');
      try {
        await fetch('/api/templates/copy-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: selectedTemplate.id,
            proposal_id: newProposal.proposal_id,
            company_id:  companyId,
          }),
        });
      } catch (err) {
        console.error('Copy template data warning (non-fatal):', err);
      }

      setStatus('Done!');
      setTimeout(() => onSuccess(), 300);
    } catch (err: any) {
      console.error('Create from template failed:', err);
      const msg = err?.message || 'Unknown error';
      setStatus(`Failed: ${msg}`);
      setCreating(false);
    }
  };

  // ── Template selection view ──────────────────────────────────────
  if (!selectedTemplate) {
    return (
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h3 className="text-gray-900 font-semibold mb-4">Choose a Template</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No templates yet. Create a template first.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-[#017C87]/40 hover:bg-[#017C87]/5 transition-all"
              >
                <div className="text-sm font-medium text-gray-900">{t.name}</div>
                {t.description && (
                  <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
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
      <button
        onClick={() => { setSelectedTemplate(null); setPages([]); }}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to templates
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#017C87]/10 flex items-center justify-center">
          <Check size={13} className="text-[#017C87]" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{selectedTemplate.name}</div>
          <div className="text-xs text-gray-400">{pages.length} pages</div>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-3">
        <FormField
          config={{ key: 'title', label: 'Proposal Title', required: true, placeholder: 'e.g. Website Redesign for Acme Co.' }}
          value={title}
          onChange={(v) => setTitle(v)}
        />
        <FormField
          config={{ key: 'client_name', label: 'Client Name', required: true, placeholder: 'e.g. Acme Co.' }}
          value={clientName}
          onChange={(v) => setClientName(v)}
        />
        <FormField
          config={{ key: 'client_email', label: 'Client Email', type: 'email', placeholder: 'client@example.com', optional: true }}
          value={clientEmail}
          onChange={(v) => setClientEmail(v)}
        />
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

        {status && (
          <p className={`text-xs ${status.startsWith('Failed') ? 'text-red-500' : 'text-gray-400'}`}>
            {status}
          </p>
        )}

        <button
          type="submit"
          disabled={creating || !title.trim() || !clientName.trim()}
          className="w-full bg-[#017C87] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {status || 'Creating...'}
            </>
          ) : (
            'Create Proposal'
          )}
        </button>
      </form>
    </div>
  );
}