// app/templates/[id]/cover/page.tsx
// Cover and Design were merged into a single tab — redirect any
// existing /cover bookmarks to /design.
import { redirect } from 'next/navigation';

export default function TemplateCoverRedirect({ params }: { params: { id: string } }) {
  redirect(`/templates/${params.id}/design`);
}
