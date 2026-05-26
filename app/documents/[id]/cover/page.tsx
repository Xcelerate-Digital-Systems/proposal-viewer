// app/documents/[id]/cover/page.tsx
// Cover and Design were merged into a single tab — redirect any
// existing /cover bookmarks to /design.
import { redirect } from 'next/navigation';

export default async function DocumentCoverRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/documents/${params.id}/design`);
}
