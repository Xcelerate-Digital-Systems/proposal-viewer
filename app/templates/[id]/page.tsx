// app/templates/[id]/page.tsx
import { redirect } from 'next/navigation';

export default async function TemplateDetailRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/templates/${params.id}/pages`);
}
