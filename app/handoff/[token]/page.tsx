'use client';

import { useState, useEffect, use } from 'react';
import {
  Building2,
  Image as ImageIcon, Film, FileText, Globe, Mail, MessageSquare,
  MonitorSmartphone, Megaphone,
} from 'lucide-react';
import type { CompanyBranding } from '@/lib/types/branding';
import type { FeedbackItemType } from '@/lib/types/feedback';
import { DEFAULT_BRANDING } from '@/lib/review-defaults';
import GoogleFontLoader from '@/components/viewer/GoogleFontLoader';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import { fontFamily } from '@/lib/google-fonts';
import ItemCard, { type HandoffItem } from '@/components/handoff/HandoffItemCards';

type HandoffProject = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_company: string | null;
  status: string;
};

type ItemGroup = {
  key: string;
  label: string;
  icon: typeof ImageIcon;
  items: HandoffItem[];
};

function groupItems(items: HandoffItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  const byType: Record<string, { key: string; label: string; icon: typeof ImageIcon; items: HandoffItem[] }> = {
    ad: { key: 'ads', label: 'Ads', icon: Megaphone, items: [] },
    image: { key: 'images', label: 'Images', icon: ImageIcon, items: [] },
    video: { key: 'videos', label: 'Videos', icon: Film, items: [] },
    webpage: { key: 'webpages', label: 'Landing Pages', icon: Globe, items: [] },
    email: { key: 'emails', label: 'Emails', icon: Mail, items: [] },
    sms: { key: 'sms', label: 'SMS', icon: MessageSquare, items: [] },
    google_search_ad: { key: 'google', label: 'Google Ads', icon: MonitorSmartphone, items: [] },
    google_banner_ad: { key: 'google', label: 'Google Ads', icon: MonitorSmartphone, items: [] },
    pdf: { key: 'pdfs', label: 'Documents', icon: FileText, items: [] },
  };

  for (const item of items) {
    const group = byType[item.type];
    if (group) group.items.push(item);
  }

  const seen = new Set<string>();
  for (const g of Object.values(byType)) {
    if (g.items.length > 0 && !seen.has(g.key)) {
      groups.push(g);
      seen.add(g.key);
    }
  }

  return groups;
}

export default function HandoffPage(props: { params: Promise<{ token: string }> }) {
  const params = use(props.params);
  const [project, setProject] = useState<HandoffProject | null>(null);
  const [items, setItems] = useState<HandoffItem[]>([]);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/handoff/${params.token}`);
        if (!res.ok) { setNotFound(true); setLoading(false); setBrandingLoaded(true); return; }

        const data = await res.json();
        setProject(data.project);
        setItems(data.items);

        const brandRes = await fetch(`/api/company/branding?company_id=${data.project.company_id}`);
        if (brandRes.ok) {
          const brandData = await brandRes.json();
          setBranding(brandData);
        }
        setBrandingLoaded(true);
        setLoading(false);
      } catch {
        setNotFound(true);
        setLoading(false);
        setBrandingLoaded(true);
      }
    }
    load();
  }, [params.token]);

  useEffect(() => {
    if (project) {
      document.title = `${project.title} — Handoff`;
    }
  }, [project]);

  if (!brandingLoaded) return <div className="fixed inset-0" style={{ backgroundColor: 'transparent' }} />;
  if (loading) return <ViewerLoader branding={branding} loading={true} label="Loading handoff…" />;

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Handoff not found</h1>
          <p className="text-sm text-gray-500">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const groups = groupItems(items);
  const headingFont = fontFamily(branding.font_heading);
  const bodyFont = fontFamily(branding.font_body);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: bodyFont }}>
      <GoogleFontLoader fonts={[branding.font_heading, branding.font_body]} />

      {/* Header */}
      <header
        className="border-b border-gray-200"
        style={{ backgroundColor: branding.bg_secondary || branding.bg_primary || '#043946' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.name || ''}
              className="h-8 w-auto max-w-[160px] object-contain"
            />
          ) : branding.name ? (
            <div className="flex items-center gap-2">
              <Building2 size={18} style={{ color: `${branding.sidebar_text_color || '#ffffff'}55` }} />
              <span
                className="text-sm font-semibold"
                style={{
                  color: branding.sidebar_text_color || '#ffffff',
                  fontFamily: headingFont,
                }}
              >
                {branding.name}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {/* Campaign info */}
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-6">
        <h1
          className="text-xl font-semibold text-gray-900 tracking-tight"
          style={{ fontFamily: headingFont }}
        >
          {project.title}
        </h1>
        {(project.client_company || project.client_name || project.description) && (
          <p className="text-sm text-gray-500 mt-1">
            {project.client_company || project.client_name}
            {(project.client_company || project.client_name) && project.description && ' · '}
            {project.description}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          {items.length} approved asset{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-gray-500">No approved assets in this campaign yet.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 pb-16 space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100">
                <group.icon size={16} className="text-gray-400" />
                <h2
                  className="text-sm font-semibold text-gray-900"
                  style={{ fontFamily: headingFont }}
                >
                  {group.label}
                </h2>
                <span className="text-2xs text-gray-500 font-medium">{group.items.length}</span>
              </div>

              <div className="grid gap-4" style={{
                gridTemplateColumns: group.key === 'webpages' ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              }}>
                {group.items.map((item) => (
                  <ItemCard key={item.id} item={item} branding={branding} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-2xs text-gray-300">
          Powered by AgencyViz
        </p>
      </footer>
    </div>
  );
}
