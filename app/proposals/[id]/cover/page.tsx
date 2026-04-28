// app/proposals/[id]/cover/page.tsx
// Cover and Design were merged into a single tab — redirect any
// existing /cover bookmarks to /design.
import { redirect } from 'next/navigation';

export default function ProposalCoverRedirect({ params }: { params: { id: string } }) {
  redirect(`/proposals/${params.id}/design`);
}
