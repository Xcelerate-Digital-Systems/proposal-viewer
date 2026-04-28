// app/proposals/[id]/page.tsx
// Server-side redirect to the default tab.
import { redirect } from 'next/navigation';

export default function ProposalDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/proposals/${params.id}/pages`);
}
