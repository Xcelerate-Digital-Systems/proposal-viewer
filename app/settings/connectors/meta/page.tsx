// app/settings/connectors/meta/page.tsx
//
// The connector UI moved to /ads/looker-studio. This route exists only so
// old bookmarks / OAuth redirects keep landing somewhere sensible.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MetaConnectorSettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.connected) qs.set('connected', searchParams.connected);
  if (searchParams.error) qs.set('error', searchParams.error);
  const suffix = qs.toString();
  redirect(`/ads/looker-studio${suffix ? `?${suffix}` : ''}`);
}
