// app/templates/[id]/design/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type ProposalTemplate } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import TemplateDetailHeader from '@/components/admin/templates/TemplateDetailHeader';
import DesignTab from '@/components/admin/shared/DesignTab';

export default function TemplateDesignPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <DesignContent templateId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DesignContent({ templateId, companyId }: { templateId: string; companyId: string }) {
  const router = useRouter();
  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

  const fetchTemplate = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposal_templates')
      .select('*')
      .eq('id', templateId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/templates');
      return;
    }
    setTemplate(data);
    setLoading(false);
  }, [templateId, companyId, router]);

  const fetchCompany = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('bg_primary')
      .eq('id', companyId)
      .single();
    if (data?.bg_primary) {
      setCompanyBgPrimary(data.bg_primary);
    }
  }, [companyId]);

  useEffect(() => {
    fetchTemplate();
    fetchCompany();
  }, [fetchTemplate, fetchCompany]);

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TemplateDetailHeader
        templateId={templateId}
        activeTab="design"
      />
      <div className="flex-1 px-6 lg:px-10 py-6">
        <DesignTab
          type="template"
          entityId={templateId}
          companyId={companyId}
          initialBgImagePath={template.bg_image_path}
          initialBgImageOverlayOpacity={template.bg_image_overlay_opacity}
          companyBgPrimary={companyBgPrimary}
          onSave={fetchTemplate}
          initialPageOrientation={template.page_orientation || 'portrait'}
          initialTextPageBgColor={template.text_page_bg_color ?? null}
          initialTextPageTextColor={template.text_page_text_color ?? null}
          initialTextPageHeadingColor={template.text_page_heading_color ?? null}
          initialTextPageFontSize={template.text_page_font_size ?? null}
          initialTextPageBorderEnabled={template.text_page_border_enabled ?? null}
          initialTextPageBorderColor={template.text_page_border_color ?? null}
          initialTextPageBorderRadius={template.text_page_border_radius ?? null}
          initialTextPageLayout={template.text_page_layout ?? null}
          initialTitleFontFamily={template.title_font_family ?? null}
          initialTitleFontWeight={template.title_font_weight ?? null}
          initialTitleFontSize={template.title_font_size ?? null}
          initialPageNumCircleColor={template.page_num_circle_color ?? null}
          initialPageNumTextColor={template.page_num_text_color ?? null}
        />
      </div>
    </div>
  );
}