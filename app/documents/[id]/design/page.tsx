// app/documents/[id]/design/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Document as DocType } from '@/lib/supabase';
import AdminLayout from '@/components/admin/AdminLayout';
import DocumentDetailHeader from '@/components/admin/documents/DocumentDetailHeader';
import DesignTab from '@/components/admin/shared/DesignTab';

export default function DocumentDesignPage({ params }: { params: { id: string } }) {
  return (
    <AdminLayout>
      {(auth) => (
        <DesignContent documentId={params.id} companyId={auth.companyId!} />
      )}
    </AdminLayout>
  );
}

function DesignContent({ documentId, companyId }: { documentId: string; companyId: string }) {
  const router = useRouter();
  const [document, setDocument] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [companyBgPrimary, setCompanyBgPrimary] = useState('#0f0f0f');

  const fetchDocument = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      router.push('/documents');
      return;
    }
    setDocument(data);
    setLoading(false);
  }, [documentId, companyId, router]);

  const fetchCompany = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('custom_domain, domain_verified, bg_primary')
      .eq('id', companyId)
      .single();
    if (data?.domain_verified && data.custom_domain) {
      setCustomDomain(data.custom_domain);
    }
    if (data?.bg_primary) {
      setCompanyBgPrimary(data.bg_primary);
    }
  }, [companyId]);

  useEffect(() => {
    fetchDocument();
    fetchCompany();
  }, [fetchDocument, fetchCompany]);

  if (loading || !document) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-[#017C87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentDetailHeader
        documentId={documentId}
        activeTab="design"
        customDomain={customDomain}
      />
      <div className="flex-1 px-6 lg:px-10 py-6">
        <DesignTab
          type="document"
          entityId={documentId}
          companyId={companyId}
          initialBgImagePath={document.bg_image_path}
          initialBgImageOverlayOpacity={document.bg_image_overlay_opacity}
          companyBgPrimary={companyBgPrimary}
          onSave={fetchDocument}
          initialPageOrientation={document.page_orientation || 'auto'}
          initialTextPageBgColor={document.text_page_bg_color ?? null}
          initialTextPageTextColor={document.text_page_text_color ?? null}
          initialTextPageHeadingColor={document.text_page_heading_color ?? null}
          initialTextPageFontSize={document.text_page_font_size ?? null}
          initialTextPageBorderEnabled={document.text_page_border_enabled ?? null}
          initialTextPageBorderColor={document.text_page_border_color ?? null}
          initialTextPageBorderRadius={document.text_page_border_radius ?? null}
          initialTextPageLayout={document.text_page_layout ?? null}
          initialTitleFontFamily={document.title_font_family ?? null}
          initialTitleFontWeight={document.title_font_weight ?? null}
          initialTitleFontSize={document.title_font_size ?? null}
        />
      </div>
    </div>
  );
}