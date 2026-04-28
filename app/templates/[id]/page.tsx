// app/templates/[id]/page.tsx
import { redirect } from 'next/navigation';

export default function TemplateDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/templates/${params.id}/pages`);
}
