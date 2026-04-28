// app/documents/[id]/page.tsx
import { redirect } from 'next/navigation';

export default function DocumentDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/documents/${params.id}/pages`);
}
