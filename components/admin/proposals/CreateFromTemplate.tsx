// components/admin/proposals/CreateFromTemplate.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase, ProposalTemplate, TemplatePage } from '@/lib/supabase';
import { FormField } from '@/components/ui/FormField';

interface CreateFromTemplateProps {
  companyId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function CreateFromTemplate({ companyId, onBack, onSuccess }: CreateFromTemplateProps) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [pages, setPages] = useState<TemplatePage[]>([]);
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

    const { data } = await supabase
      .from('template_pages')
      .select('*')
      .eq('template_id', t.id)
      .order('page_number', { ascending: true });

    setPages(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !title.trim() || !clientName.trim()) return;

    setCreating(true);

    try {
      // Get current user's name
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

      // 1. Build the page list from template pages
      const mergePages = pages.map((page) => ({
        file_path: page.file_path,
      }));

      // 2. Generate proposal file path and merge
      setStatus('Merging pages...');
      const proposalFilePath = `proposals/${Date.now()}-${title.trim().replace(/\s+/g, '-').toLowerCase()}.pdf`;

      const mergeRes = await fetch('/api/templates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: mergePages, proposal_file_path: proposalFilePath }),
      });

      if (!mergeRes.ok) {
        const errorBody = await mergeRes.text();
        console.error('Merge API failed:', mergeRes.status, errorBody);
        throw new Error(`Merge failed (${mergeRes.status}): ${errorBody}`);
      }
      const mergeData = await mergeRes.json();

      // 3. Build page_names from template pages + section header groups
      //    Start with PDF page entries from template_pages
      const pageNames: Array<{ name: string; indent: number; type?: 'group' }> =
        pages.map((p) => ({ name: p.label, indent: p.indent ?? 0 }));

      //    Interleave section header groups from the template
      //    section_headers are stored as { id, name, position } where
      //    position is relative to PDF pages (0 = before first, N = after Nth, -1 = end)
      const rawHeaders = selectedTemplate.section_headers;
      if (Array.isArray(rawHeaders) && rawHeaders.length > 0) {
        for (const header of rawHeaders as Array<{ id?: string; name: string; position?: number }>) {
          const groupEntry = { name: header.name || 'Section', indent: 0, type: 'group' as const };
          const pos = header.position ?? -1;

          if (pos === -1) {
            pageNames.push(groupEntry);
          } else {
            // Count non-group (PDF) entries to find the correct insert index
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

      // 4. Create proposal record
      setStatus('Creating proposal...');
      const { data: newProposal, error: dbError } = await supabase.from('proposals').insert({
        title: title.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        crm_identifier: crmIdentifier.trim() || null,
        description: description.trim() || null,
        file_path: proposalFilePath,
        file_size_bytes: mergeData.file_size_bytes || 0,
        status: 'draft',
        page_names: pageNames,
        company_id: companyId,
        created_by_name: creatorName,
        prepared_by: selectedTemplate.prepared_by || creatorName,
        prepared_by_member_id: selectedTemplate.prepared_by_member_id || null,
        cover_subtitle: selectedTemplate.cover_subtitle || null,
        cover_image_path: selectedTemplate.cover_image_path || null,
        cover_button_text: selectedTemplate.cover_button_text || null,
        // ── Cover page styling (from template) ──
        cover_enabled: selectedTemplate.cover_enabled ?? true,
        cover_bg_style: selectedTemplate.cover_bg_style || null,
        cover_bg_color_1: selectedTemplate.cover_bg_color_1 || null,
        cover_bg_color_2: selectedTemplate.cover_bg_color_2 || null,
        cover_gradient_type: selectedTemplate.cover_gradient_type || null,
        cover_gradient_angle: selectedTemplate.cover_gradient_angle ?? null,
        cover_overlay_opacity: selectedTemplate.cover_overlay_opacity ?? null,
        cover_text_color: selectedTemplate.cover_text_color || null,
        cover_subtitle_color: selectedTemplate.cover_subtitle_color || null,
        cover_button_bg: selectedTemplate.cover_button_bg || null,
        cover_button_text_color: selectedTemplate.cover_button_text_color || null,
        cover_show_date: selectedTemplate.cover_show_date ?? false,
        cover_date: selectedTemplate.cover_date || null,
        cover_show_prepared_by: selectedTemplate.cover_show_prepared_by ?? true,
        cover_show_client_logo: selectedTemplate.cover_show_client_logo ?? false,
        cover_show_avatar: selectedTemplate.cover_show_avatar ?? false,
        cover_client_logo_path: selectedTemplate.cover_client_logo_path || null,
        cover_avatar_path: selectedTemplate.cover_avatar_path || null,
        bg_image_path: selectedTemplate.bg_image_path || null,
        bg_image_overlay_opacity: selectedTemplate.bg_image_overlay_opacity ?? null,
        page_orientation: selectedTemplate.page_orientation || 'auto',
        text_page_bg_color: selectedTemplate.text_page_bg_color || null,
        text_page_text_color: selectedTemplate.text_page_text_color || null,
        text_page_heading_color: selectedTemplate.text_page_heading_color || null,
        text_page_font_size: selectedTemplate.text_page_font_size || null,
        text_page_border_enabled: selectedTemplate.text_page_border_enabled ?? null,
        text_page_border_color: selectedTemplate.text_page_border_color || null,
        text_page_border_radius: selectedTemplate.text_page_border_radius || null,
        text_page_layout: selectedTemplate.text_page_layout || null,
        toc_settings: selectedTemplate.toc_settings || null,
        title_font_family: selectedTemplate.title_font_family || null,
        title_font_weight: selectedTemplate.title_font_weight || null,
        title_font_size: selectedTemplate.title_font_size || null,
      }).select('id').single();

      if (dbError || !newProposal) throw dbError || new Error('Failed to create proposal');

      // 5. Copy template data (pricing, text pages, packages) to proposal
      setStatus('Copying template data...');
      try {
        await fetch('/api/templates/copy-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: selectedTemplate.id,
            proposal_id: newProposal.id,
            company_id: companyId,
          }),
        });
      } catch (err) {
        console.error('Copy template data warning:', err);
        // Non-fatal — proposal was already created successfully
      }

      setStatus('Done!');
      setTimeout(() => onSuccess(), 300);
    } catch (err: any) {
      console.error('Create from template failed:', err);
      console.error('Error message:', err?.message);
      console.error('Error details:', err?.details || err?.hint);
      const msg = err?.message || 'Unknown error';
      setStatus(`Failed: ${msg}`);
      setCreating(false);
    }
  };

  // Template selection view
  if (!selectedTemplate) {
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors">
          <ArrowLeft size={14} />
          Back
        </button>
        <h3 className="text-gray-900 font-semibold mb-4">Choose a Template</h3>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No templates yet. Create one from the Templates page first.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-[#017C87]/40 transition-colors"
              >
                <div className="font-medium text-gray-900 text-sm">{t.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t.page_count} pages{t.description ? ` · ${t.description}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Template customization + form view
  return (
    <div>
      <button
        onClick={() => setSelectedTemplate(null)}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-4 transition-colors"
        disabled={creating}
      >
        <ArrowLeft size={14} />
        Choose different template
      </button>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Proposal details */}
        <FormField
          config={{ key: 'title', label: 'Proposal Title', required: true, placeholder: 'Website Redesign Proposal' }}
          value={title}
          onChange={setTitle}
          disabled={creating}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            config={{ key: 'client_name', label: 'Client Name', required: true, placeholder: 'John Smith' }}
            value={clientName}
            onChange={setClientName}
            disabled={creating}
          />
          <FormField
            config={{ key: 'client_email', label: 'Client Email', type: 'email', placeholder: 'john@example.com' }}
            value={clientEmail}
            onChange={setClientEmail}
            disabled={creating}
          />
        </div>
        <FormField
          config={{ key: 'crm_identifier', label: 'CRM Identifier', placeholder: 'e.g. GHL contact ID', optional: true }}
          value={crmIdentifier}
          onChange={setCrmIdentifier}
          disabled={creating}
        />

        {status && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {creating && <Loader2 size={14} className="animate-spin text-[#017C87]" />}
            {status}
          </div>
        )}

        <button
          type="submit"
          disabled={creating || !title.trim() || !clientName.trim()}
          className="w-full bg-[#017C87] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#01434A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating proposal...' : 'Create Proposal'}
        </button>
      </form>
    </div>
  );
}