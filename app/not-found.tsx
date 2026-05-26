// app/not-found.tsx
// Global Next.js 404 page. Triggered by `notFound()` calls in server
// components, by Next's own route-miss matching, and by any link to a
// URL that doesn't exist in the app.
//
// Public viewers (proposals, quotes, docs) also surface this when a
// shared token is invalid or expired -- so the copy needs to make sense
// to both an admin user who fat-fingered a URL and a client who clicked
// an old share link.
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { buttonClasses } from '@/components/ui/buttonClasses';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-5">
          <FileQuestion size={36} className="text-faint" />
        </div>
        <h1 className="text-2xl font-semibold text-ink mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been removed.
          If you got here from a shared link, ask the sender for an updated one.
        </p>
        <Link href="/" className={buttonClasses({ size: 'sm' })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
