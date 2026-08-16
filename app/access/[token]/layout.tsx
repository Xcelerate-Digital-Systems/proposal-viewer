import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase-server';

type Props = {
  params: Promise<{ token: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from('client_access_requests')
    .select('company_id, client_name')
    .eq('share_token', token)
    .single();

  if (!request) {
    return { title: 'Access Request' };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', request.company_id)
    .single();

  const agencyName = company?.name ?? 'Agency';
  const title = `Grant Access — ${agencyName}`;
  const description = `${agencyName} is requesting access to your accounts. Click to connect your platforms securely.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary', title, description },
  };
}

export default function AccessTokenLayout({ children }: Props) {
  return children;
}
