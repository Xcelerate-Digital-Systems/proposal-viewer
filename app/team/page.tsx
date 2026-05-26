// app/team/page.tsx
// The standalone /team page was merged into /settings (Members tab) on
// 2026-05-26. This route stays as a redirect so old bookmarks still land
// on the right screen.
import { redirect } from 'next/navigation';

export default function TeamRedirect() {
  redirect('/settings?tab=members');
}
