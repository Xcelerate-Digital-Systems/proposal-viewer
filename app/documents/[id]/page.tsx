// app/documents/[id]/page.tsx
import { redirect } from 'next/navigation';

export default async function DocumentDetailRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/documents/${params.id}/pages`);
}
