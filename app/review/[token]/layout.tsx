import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase-server';

type Props = {
  params: Promise<{ token: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();

  // Try item share_token first, then project share_token (mirrors API route logic)
  let projectTitle = '';
  let clientName = '';
  let companyName = '';
  let logoUrl = '';

  const { data: item } = await supabase
    .from('review_items')
    .select('review_project_id, title')
    .eq('share_token', token)
    .single();

  const projectId = item?.review_project_id;

  if (projectId) {
    const { data: project } = await supabase
      .from('review_projects')
      .select('title, client_name, company_id')
      .eq('id', projectId)
      .single();
    if (project) {
      projectTitle = project.title || '';
      clientName = project.client_name || '';
      // Fetch company branding for logo + name
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', project.company_id)
        .single();
      if (company) {
        companyName = company.name || '';
        logoUrl = company.logo_url || '';
      }
    }
  } else {
    // Try project share_token
    const { data: project } = await supabase
      .from('review_projects')
      .select('title, client_name, company_id')
      .eq('share_token', token)
      .single();
    if (project) {
      projectTitle = project.title || '';
      clientName = project.client_name || '';
      const { data: company } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', project.company_id)
        .single();
      if (company) {
        companyName = company.name || '';
        logoUrl = company.logo_url || '';
      }
    }
  }

  // Build the title: "Project Title — Review for Client" or just project title
  const title = clientName
    ? `${projectTitle} — Review for ${clientName}`
    : projectTitle || 'Review';

  const description = companyName
    ? `${companyName} has shared "${projectTitle}" for your review and feedback.`
    : `"${projectTitle}" has been shared for your review and feedback.`;

  const images = logoUrl ? [{ url: logoUrl, alt: companyName || 'Company logo' }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(images.length > 0 && { images }),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(images.length > 0 && { images }),
    },
  };
}

export default function ReviewTokenLayout({ children }: Props) {
  return children;
}
